import axios from "axios";
import { IRouteService, RouteDirections, RoutePoint } from "../../domain/services/IRouteService";

interface CacheEntry {
  data: RouteDirections;
  expiresAt: number;
}

export class HttpRouteService implements IRouteService {
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<RouteDirections>>();
  private readonly TTL_MS = 15 * 60 * 1000; // 15 minutos

  async getDirections(origin: RoutePoint, destination: RoutePoint): Promise<RouteDirections> {
    // Redondear a ~100 metros para maximizar aciertos de caché en paradas cercanas
    const cacheKey = `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}->${destination.latitude.toFixed(3)},${destination.longitude.toFixed(3)}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const fetchPromise = this.fetchFromProvider(origin, destination)
      .then((result) => {
        this.cache.set(cacheKey, {
          data: result,
          expiresAt: Date.now() + this.TTL_MS,
        });
        return result;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  private async fetchFromProvider(origin: RoutePoint, destination: RoutePoint): Promise<RouteDirections> {
    try {
      // OSRM (Open Source Routing Machine) Driving Profile
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;

      const response = await axios.get<any>(url, { timeout: 6000 });
      const route = response.data?.routes?.[0];

      if (route && Array.isArray(route.geometry?.coordinates)) {
        const points: RoutePoint[] = route.geometry.coordinates.map((coord: [number, number]) => ({
          latitude: coord[1],
          longitude: coord[0],
        }));

        const distanceKm = Number((route.distance / 1000).toFixed(1));
        const durationMinutes = Math.max(1, Math.round(route.duration / 60));

        return {
          points,
          distanceKm,
          durationMinutes,
          formattedDistance: `${distanceKm} km`,
          formattedDuration: `~${durationMinutes} min`,
          summary: route.legs?.[0]?.summary || undefined,
        };
      }
    } catch (error) {
      console.warn("[HttpRouteService] Fallback a cálculo geodésico por fallo de red:", error);
    }

    // Fallback de resiliencia si la red externa falla
    return this.createFallbackRoute(origin, destination);
  }

  private createFallbackRoute(origin: RoutePoint, destination: RoutePoint): RouteDirections {
    const R = 6371;
    const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
    const dLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((origin.latitude * Math.PI) / 180) *
        Math.cos((destination.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Number((R * c * 1.35).toFixed(1));
    const durationMinutes = Math.max(3, Math.round((distanceKm / 35) * 60));

    return {
      points: [origin, destination],
      distanceKm,
      durationMinutes,
      formattedDistance: `${distanceKm} km`,
      formattedDuration: `~${durationMinutes} min`,
    };
  }
}
