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
  // Caché en RAM de 4 segundos con single-flight para mitigar la latencia inter-cloud (AWS -> GCP)
  private static readonly locationCache = new TtlCache<DriverLocationRecord | null>(4_000);

  async update(driverId: string, lat: number, lng: number) {
    const record: DriverLocationRecord = {
      lat,
      lng,
      updatedAt: new Date().toISOString(),
    };

    // Actualización inmediata en memoria para lecturas instantáneas
    LocationFirestoreRepository.locationCache.set(driverId, record);

    await this.collection.doc(driverId).set(record);
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
