export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteDirections {
  points: RoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  formattedDistance: string;
  formattedDuration: string;
  summary?: string;
}

export interface IRouteService {
  getDirections(origin: RoutePoint, destination: RoutePoint): Promise<RouteDirections>;
}
