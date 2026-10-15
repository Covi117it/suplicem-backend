import test from "node:test";
import assert from "node:assert/strict";
import { AcceptTripUseCase } from "../../src/application/use-cases/trip/AcceptTripUseCase";
import { UpdateTripStatusUseCase } from "../../src/application/use-cases/trip/UpdateTripStatusUseCase";
import { TripRepository } from "../../src/domain/repositories/TripRepository";
import { UserRepository } from "../../src/domain/repositories/UserRepository";
import { Trip } from "../../src/domain/entities/Trip";

test("Aceptación de múltiples viajes por capacidad y restricción de inicio único concurrente", async (t) => {
  const driverId = "driver-123";
  const driverUser = {
    id: driverId,
    uid: driverId,
    userType: "driver",
    vehicle: {
      tons: 20, // Camión con capacidad de 20 toneladas
      plate: "A123456",
    },
  };

  const tripsStore: Map<string, Trip> = new Map([
    [
      "trip-1",
      {
        id: "trip-1",
        tripNumber: "101",
        status: "available",
        totalTons: 8,
        orderIds: ["ord-1"],
        createdAt: new Date().toISOString(),
      } as Trip,
    ],
    [
      "trip-2",
      {
        id: "trip-2",
        tripNumber: "102",
        status: "available",
        totalTons: 10,
        orderIds: ["ord-2"],
        createdAt: new Date().toISOString(),
      } as Trip,
    ],
    [
      "trip-3",
      {
        id: "trip-3",
        tripNumber: "103",
        status: "available",
        totalTons: 5,
        orderIds: ["ord-3"],
        createdAt: new Date().toISOString(),
      } as Trip,
    ],
  ]);

  const mockTripRepo: TripRepository = {
    async getById(tripId: string) {
      return tripsStore.get(tripId) || null;
    },
    async getDriverActualTrips(userId: string) {
      return Array.from(tripsStore.values()).filter(
        (tr) =>
          tr.assignedDriverId === userId &&
          ["accepted", "started", "in_progress"].includes(tr.status)
      );
    },
    async acceptTrip(tripId: string, dId: string) {
      const tr = tripsStore.get(tripId);
      if (tr) {
        tr.status = "accepted";
        tr.assignedDriverId = dId;
      }
    },
    async updateTripStatus(tripId: string, status: string) {
      const tr = tripsStore.get(tripId);
      if (tr) {
        tr.status = status;
      }
    },
    create: async () => "",
    createTripAtomic: async () => "",
    getAvailable: async () => [],
    getAll: async () => [],
    getDriverTripHistory: async () => [],
    assignDriver: async () => {},
    completeTrip: async () => {},
    getByIdWithOrders: async () => ({} as any),
    getTripByOrderId: async () => null,
    getTripsByOrderId: async () => [],
  };

  const mockUserRepo: UserRepository = {
    async getById(id: string) {
      if (id === driverId) return driverUser as any;
      return null;
    },
    create: async () => {},
    update: async () => {},
    getAll: async () => [],
  };

  const acceptTripUseCase = new AcceptTripUseCase(mockTripRepo, mockUserRepo);
  const updateTripStatusUseCase = new UpdateTripStatusUseCase(mockTripRepo);

  await t.test("Paso 1: Conductor acepta Trip-1 (8 t) exitosamente", async () => {
    const res = await acceptTripUseCase.execute("trip-1", driverId);
    assert.equal(res.alreadyAccepted, false);
    const updated = await mockTripRepo.getById("trip-1");
    assert.equal(updated?.status, "accepted");
    assert.equal(updated?.assignedDriverId, driverId);
  });

  await t.test("Paso 2: Conductor acepta Trip-2 (10 t) exitosamente (acumulado: 8 + 10 = 18 t <= 20 t)", async () => {
    const res = await acceptTripUseCase.execute("trip-2", driverId);
    assert.equal(res.alreadyAccepted, false);
    const updated = await mockTripRepo.getById("trip-2");
    assert.equal(updated?.status, "accepted");
  });

  await t.test("Paso 3: Rechaza Trip-3 (5 t) porque acumulado sería 18 + 5 = 23 t > 20 t capacidad", async () => {
    await assert.rejects(
      async () => {
        await acceptTripUseCase.execute("trip-3", driverId);
      },
      (err: any) => {
        assert.match(err.message, /supera la capacidad máxima de tu camión/);
        return true;
      }
    );
  });

  await t.test("Paso 4: Conductor inicia Trip-1 ('started') exitosamente", async () => {
    await updateTripStatusUseCase.execute("trip-1", "started", driverId, "driver");
    const updated = await mockTripRepo.getById("trip-1");
    assert.equal(updated?.status, "started");
  });

  await t.test("Paso 5: Bloquea iniciar Trip-2 ('started') porque Trip-1 ya está en curso", async () => {
    await assert.rejects(
      async () => {
        await updateTripStatusUseCase.execute("trip-2", "started", driverId, "driver");
      },
      (err: any) => {
        assert.match(err.message, /Ya tienes el viaje #101 en curso/);
        return true;
      }
    );
  });

  await t.test("Paso 6: Conductor completa Trip-1 ('completed') simulando PIN o contingencia admin", async () => {
    // Admin o contingencia pasa Trip-1 a completed
    await updateTripStatusUseCase.execute("trip-1", "completed", "admin-1", "admin");
    const updated = await mockTripRepo.getById("trip-1");
    assert.equal(updated?.status, "completed");
  });

  await t.test("Paso 7: Conductor ahora sí puede iniciar Trip-2 tras finalizar Trip-1", async () => {
    await updateTripStatusUseCase.execute("trip-2", "started", driverId, "driver");
    const updated = await mockTripRepo.getById("trip-2");
    assert.equal(updated?.status, "started");
  });
});
