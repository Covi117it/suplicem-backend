import { test, describe } from "node:test";
import assert from "node:assert";
import { SplitOrderTripsUseCase } from "../../src/application/use-cases/trip/SplitOrderTripsUseCase";

describe("SplitOrderTripsUseCase - Planificación y fraccionamiento de viajes", () => {
  const createMockOrderRepo = (orderData: any) => ({
    getById: async (id: string) => (id === orderData.id ? orderData : null),
    create: async () => "order-1",
    getAll: async () => [],
    updateStatus: async () => {},
    updateDeliveries: async () => orderData,
  } as any);

  const createMockTripRepo = () => {
    const trips: any[] = [];
    return {
      trips,
      getTripsByOrderId: async (orderId: string) => trips.filter((t) => t.orderIds.includes(orderId)),
      updateTripStatus: async (tripId: string, status: string, reason?: string) => {
        const t = trips.find((item) => item.id === tripId);
        if (t) {
          t.status = status;
          t.cancellationReason = reason;
        }
      },
      createTripAtomic: async (trip: any) => {
        const id = `trip-${trips.length + 1}`;
        trips.push({ ...trip, id });
        return id;
      },
      create: async () => "trip-id",
      getAvailable: async () => [],
      getById: async () => null,
      getAll: async () => [],
      getDriverTripHistory: async () => [],
      getDriverActualTrips: async () => [],
      assignDriver: async () => {},
      completeTrip: async () => {},
      getByIdWithOrders: async () => ({} as any),
      getTripByOrderId: async () => null,
    } as any;
  };

  test("Escenario 1: Divide orden de 1000 fundas (42.5 t) en 2 viajes de 21.25 t con conductores", async () => {
    const mockOrder = {
      id: "ord-1002",
      orderNumber: "1002",
      status: "approved",
      totalTons: 42.5,
      pendingBalance: 42.5,
      deliveredTons: 0,
      deliveryType: "domicilio",
    };

    const orderRepo = createMockOrderRepo(mockOrder);
    const tripRepo = createMockTripRepo();
    const useCase = new SplitOrderTripsUseCase(tripRepo, orderRepo);

    const result = await useCase.execute("ord-1002", [
      { totalTons: 21.25, driverId: "driver-1" },
      { totalTons: 21.25, driverId: "driver-2" },
    ]);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(tripRepo.trips.length, 2);
    assert.strictEqual(tripRepo.trips[0].tripNumber, "TRIP-1002-1");
    assert.strictEqual(tripRepo.trips[0].totalTons, 21.25);
    assert.strictEqual(tripRepo.trips[0].assignedDriverId, "driver-1");
    assert.strictEqual(tripRepo.trips[0].status, "assigned");

    assert.strictEqual(tripRepo.trips[1].tripNumber, "TRIP-1002-2");
    assert.strictEqual(tripRepo.trips[1].totalTons, 21.25);
    assert.strictEqual(tripRepo.trips[1].assignedDriverId, "driver-2");
    assert.strictEqual(tripRepo.trips[1].status, "assigned");
  });

  test("Escenario 2: Cancela viaje unificado previo en 'available' al re-fraccionar la orden", async () => {
    const mockOrder = {
      id: "ord-1002",
      orderNumber: "1002",
      status: "approved",
      totalTons: 42.5,
      pendingBalance: 42.5,
      deliveredTons: 0,
      deliveryType: "domicilio",
    };

    const orderRepo = createMockOrderRepo(mockOrder);
    const tripRepo = createMockTripRepo();
    // Simular viaje unificado previo de 42.5 t creado automáticamente
    tripRepo.trips.push({
      id: "old-single-trip",
      tripNumber: "TRIP-1002",
      orderIds: ["ord-1002"],
      totalTons: 42.5,
      status: "available",
    });

    const useCase = new SplitOrderTripsUseCase(tripRepo, orderRepo);

    const result = await useCase.execute("ord-1002", [
      { totalTons: 20.0, driverId: "driver-a" },
      { totalTons: 22.5, driverId: "" },
    ]);

    assert.strictEqual(result.length, 2);
    const oldTrip = tripRepo.trips.find((t: any) => t.id === "old-single-trip");
    assert.strictEqual(oldTrip.status, "canceled");
  });

  test("Escenario 3: Rechaza si el tonelaje planificado excede el total de la orden", async () => {
    const mockOrder = {
      id: "ord-1002",
      orderNumber: "1002",
      status: "approved",
      totalTons: 40.0,
      deliveredTons: 0,
      deliveryType: "domicilio",
    };

    const orderRepo = createMockOrderRepo(mockOrder);
    const tripRepo = createMockTripRepo();
    const useCase = new SplitOrderTripsUseCase(tripRepo, orderRepo);

    await assert.rejects(
      async () => {
        await useCase.execute("ord-1002", [
          { totalTons: 25.0 },
          { totalTons: 20.0 }, // 45 t > 40 t
        ]);
      },
      {
        message: /supera el remanente disponible/,
      }
    );
  });
});
