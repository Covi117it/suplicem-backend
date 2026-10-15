import { test, describe } from "node:test";
import assert from "node:assert";
import { SplitSingleTripUseCase } from "../../src/application/use-cases/trip/SplitSingleTripUseCase";

describe("SplitSingleTripUseCase - Fraccionamiento de un viaje individual", () => {
  const createMockOrderRepo = () => ({
    getById: async () => null,
  } as any);

  const createMockTripRepo = (initialTrip: any) => {
    const trips: any[] = [initialTrip];
    return {
      trips,
      getById: async (id: string) => trips.find((t) => t.id === id) || null,
      updateTripStatus: async (tripId: string, status: string, reason?: string) => {
        const t = trips.find((item) => item.id === tripId);
        if (t) {
          t.status = status;
          t.cancellationReason = reason;
        }
      },
      createTripAtomic: async (trip: any) => {
        const id = `new-trip-${trips.length + 1}`;
        trips.push({ ...trip, id });
        return id;
      },
    } as any;
  };

  test("Escenario 1: Fracciona un viaje de 41.25 t en 2 sub-viajes (20.63 t y 20.62 t)", async () => {
    const initialTrip = {
      id: "trip-original-1",
      tripNumber: "TRIP-1002-1",
      orderIds: ["ord-1002"],
      totalTons: 41.25,
      status: "available",
    };

    const tripRepo = createMockTripRepo(initialTrip);
    const orderRepo = createMockOrderRepo();
    const useCase = new SplitSingleTripUseCase(tripRepo, orderRepo);

    const result = await useCase.execute("trip-original-1", [
      { totalTons: 20.63, driverId: "driver-1" },
      { totalTons: 20.62, driverId: "driver-2" },
    ]);

    assert.strictEqual(result.length, 2);
    // El viaje original debe estar cancelado
    assert.strictEqual(initialTrip.status, "canceled");
    // Nuevos viajes creados
    assert.strictEqual(tripRepo.trips.length, 3);
    assert.strictEqual(tripRepo.trips[1].tripNumber, "TRIP-1002-1-A");
    assert.strictEqual(tripRepo.trips[1].assignedDriverId, "driver-1");
    assert.strictEqual(tripRepo.trips[1].status, "assigned");
    assert.strictEqual(tripRepo.trips[2].tripNumber, "TRIP-1002-1-B");
    assert.strictEqual(tripRepo.trips[2].assignedDriverId, "driver-2");
    assert.strictEqual(tripRepo.trips[2].status, "assigned");
  });

  test("Escenario 2: Rechaza si el tonelaje dividido supera el tonelaje del viaje original", async () => {
    const initialTrip = {
      id: "trip-original-2",
      tripNumber: "TRIP-1002-2",
      orderIds: ["ord-1002"],
      totalTons: 41.25,
      status: "available",
    };

    const tripRepo = createMockTripRepo(initialTrip);
    const orderRepo = createMockOrderRepo();
    const useCase = new SplitSingleTripUseCase(tripRepo, orderRepo);

    await assert.rejects(
      async () => {
        await useCase.execute("trip-original-2", [
          { totalTons: 30 },
          { totalTons: 20 },
        ]);
      },
      (err: any) => err.message.includes("supera la carga")
    );

    // El viaje original NO debe cancelarse si falla la validación
    assert.strictEqual(initialTrip.status, "available");
  });

  test("Escenario 3: Rechaza si no se divide en al menos 2 sub-viajes", async () => {
    const initialTrip = {
      id: "trip-original-3",
      tripNumber: "TRIP-1002-3",
      orderIds: ["ord-1002"],
      totalTons: 41.25,
      status: "available",
    };

    const tripRepo = createMockTripRepo(initialTrip);
    const orderRepo = createMockOrderRepo();
    const useCase = new SplitSingleTripUseCase(tripRepo, orderRepo);

    await assert.rejects(
      async () => {
        await useCase.execute("trip-original-3", [{ totalTons: 41.25 }]);
      },
      (err: any) => err.message.includes("al menos 2 sub-viajes")
    );
  });
});
