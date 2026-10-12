import { Trip } from "../../../domain/entities/Trip";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class CreateTripUseCase {
  constructor(
    private tripRepo: TripRepository,
    private orderRepo: OrderRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(data: {
    tripNumber: string;
    orderIds: string[];
    driverId?: string;
    comments?: string;
    totalTons?: number;
  }): Promise<string> {
    if (!data.tripNumber || !data.orderIds?.length) {
      throw new Error("El número de viaje y al menos una orden son requeridos.");
    }

    const uniqueOrderIds = [...new Set(data.orderIds)];
    let calculatedTotalTons = 0;
    let existingTripsCount = 0;

    for (const orderId of uniqueOrderIds) {
      const order = await this.orderRepo.getById(orderId);
      if (!order) {
        throw new Error(`La orden con ID ${orderId} no fue encontrada.`);
      }

      if (order.status !== "approved") {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no puede incluirse en un viaje porque su estado es '${order.status}' (debe estar 'approved').`
        );
      }

      // Obtener viajes existentes de la orden
      let existingTrips: any[] = [];
      if (this.tripRepo.getTripsByOrderId) {
        existingTrips = await this.tripRepo.getTripsByOrderId(orderId);
      } else {
        const singleTrip = await this.tripRepo.getTripByOrderId(orderId);
        if (singleTrip && singleTrip.status !== "canceled") {
          existingTrips = [singleTrip];
        }
      }

      existingTripsCount += existingTrips.length;

      // Tonelaje total de la orden
      const pendingDeliveries = (order.deliveries || []).filter(
        (del) => del.status !== "delivered" && del.delivered !== true
      );
      const deliveriesPendingTons = pendingDeliveries.reduce(
        (sum, del) => sum + (Number(del.quantity) || 0),
        0
      );
      const orderTotalTons =
        Number(order.totalTons) ||
        Number(order.pendingBalance) ||
        deliveriesPendingTons ||
        0;

      if (orderTotalTons <= 0) {
        throw new Error(
          `La orden #${order.orderNumber || orderId} no tiene tonelaje pendiente por transportar.`
        );
      }

      // Calcular tonelaje ya en tránsito o entregado
      const activeTrips = existingTrips.filter((t) =>
        ["available", "assigned", "accepted", "started", "in_progress"].includes(t.status || "")
      );
      const tonsInTransit = activeTrips.reduce((sum, t) => {
        const tTons = Number(t.totalTons);
        return sum + (tTons > 0 ? tTons : orderTotalTons);
      }, 0);
      const alreadyDelivered = Number(order.deliveredTons) || 0;
      const availableToDispatch = Math.max(0, orderTotalTons - alreadyDelivered - tonsInTransit);

      // Si no queda tonelaje disponible y hay un viaje activo, rechazar
      if (availableToDispatch <= 0) {
        const conflictTrip = activeTrips[0] || existingTrips[0];
        throw new Error(
          `La orden #${order.orderNumber || orderId} ya se encuentra asignada al viaje ${conflictTrip?.tripNumber || "activo"}.`
        );
      }

      calculatedTotalTons += availableToDispatch;
    }

    if (calculatedTotalTons <= 0) {
      throw new Error("El total de toneladas calculado para el viaje debe ser mayor a 0.");
    }

    // Ajustar si se envió totalTons explícito menor
    if (data.totalTons && data.totalTons > 0 && data.totalTons < calculatedTotalTons) {
      calculatedTotalTons = data.totalTons;
    }

    // Si se asignó un conductor, limitar a la capacidad de su camión si es menor
    if (data.driverId && this.userRepo) {
      const driverUser = await this.userRepo.getById(data.driverId);
      const driverCap = Number(driverUser?.vehicle?.tons) || 0;
      if (driverCap > 0 && driverCap < calculatedTotalTons) {
        calculatedTotalTons = driverCap;
      }
    }

    const isDriverAssigned = Boolean(data.driverId && data.driverId.trim() !== "");
    const initialStatus = isDriverAssigned ? "assigned" : "available";

    // Mantener nombre limpio sin duplicar sufijos (ej. TRIP-183-2, TRIP-183-3)
    let finalTripNumber = data.tripNumber;
    const hasCorrelativeSuffix = /-\d+$/.test(data.tripNumber);
    if (!hasCorrelativeSuffix && existingTripsCount > 0) {
      finalTripNumber = `${data.tripNumber}-${existingTripsCount + 1}`;
    }

    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    const newTrip: Trip = {
      tripNumber: finalTripNumber,
      orderIds: uniqueOrderIds,
      comments: data.comments,
      totalTons: Number(calculatedTotalTons.toFixed(2)),
      status: initialStatus,
      assignedDriverId: data.driverId || undefined,
      createdAt: new Date().toISOString(),
      deliveryPin: generatedPin,
    };

    return await this.tripRepo.createTripAtomic(newTrip, uniqueOrderIds);
  }
}