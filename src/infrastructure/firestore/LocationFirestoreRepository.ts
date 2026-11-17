import { firestore } from "../../config/firebase";
import { LocationRepository } from "../../domain/repositories/LocationRepository";
import { TtlCache } from "../cache/TtlCache";

interface DriverLocationRecord {
  lat: number;
  lng: number;
  updatedAt: string;
}

export class LocationFirestoreRepository implements LocationRepository {
  private collection = firestore.collection("locations");
  // Caché en RAM de 20 segundos con single-flight y límite de 300 choferes para mitigar la latencia inter-cloud (AWS -> GCP)
  private static readonly locationCache = new TtlCache<DriverLocationRecord | null>(20_000, 300);
  private static readonly lastPersistedAt = new Map<string, number>();
  private static readonly lastPersistedCoords = new Map<string, { lat: number; lng: number }>();
  private static readonly PERSIST_INTERVAL_MS = 20_000;

  async update(driverId: string, lat: number, lng: number) {
    const record: DriverLocationRecord = {
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    };

    // Actualización inmediata en memoria para lecturas instantáneas (0 ms y 0 lecturas BD)
    LocationFirestoreRepository.locationCache.set(driverId, record);

    const now = Date.now();
    const lastTime = LocationFirestoreRepository.lastPersistedAt.get(driverId) || 0;
    const lastCoords = LocationFirestoreRepository.lastPersistedCoords.get(driverId);

    const hasSignificantMove =
      !lastCoords ||
      Math.abs(lastCoords.lat - lat) > 0.0005 ||
      Math.abs(lastCoords.lng - lng) > 0.0005;

    if (now - lastTime >= LocationFirestoreRepository.PERSIST_INTERVAL_MS || hasSignificantMove) {
      LocationFirestoreRepository.lastPersistedAt.set(driverId, now);
      LocationFirestoreRepository.lastPersistedCoords.set(driverId, { lat, lng });
      this.collection
        .doc(driverId)
        .set(record)
        .catch((err) => {
          console.warn("[LocationRepo] Advertencia al persistir ubicación en Firestore:", err?.message || err);
        });
    }
  }

  async get(driverId: string): Promise<DriverLocationRecord | null> {
    if (!driverId || !driverId.trim()) return null;

    return LocationFirestoreRepository.locationCache.getOrLoad(driverId, async () => {
      const snap = await this.collection.doc(driverId).get();
      if (!snap.exists) return null;
      return snap.data() as DriverLocationRecord;
    });
  }
}
