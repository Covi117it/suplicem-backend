import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export class UpdateOrderStatusUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo?: TripRepository,
    private userRepo?: UserRepository
  ) {}

  async execute(
    orderId: string,
    status: "approved" | "rejected" | "completed",
    reason?: string,
    driverId?: string,
    tripsPlan?: Array<{ totalTons: number; driverId?: string; comments?: string }>
  ): Promise<void> {
    if (status === "rejected" && !reason) {
      throw new Error("Se requiere un motivo para rechazar la orden");
    }

    if (status === "completed") {
      const order = await this.orderRepo.getById(orderId);
      if (!order) {
        throw new Error("Orden no encontrada");
      }
      if (order.status === "rejected" || order.status === "canceled") {
        throw new Error("No se puede completar una orden cancelada o rechazada");
      }
      await this.orderRepo.updateStatus(orderId, "completed");
      return;
    }

    await this.orderRepo.updateStatus(orderId, status, reason);

    if (status === "approved" && this.tripRepo) {
      try {
        const order = await this.orderRepo.getById(orderId);
        if (order && order.deliveryType === "domicilio") {
          const existingTrip = await this.tripRepo.getTripByOrderId(orderId);
          if (!existingTrip || existingTrip.status === "canceled") {
            const baseTripNumber = `TRIP-${order.orderNumber || orderId.slice(0, 6).toUpperCase()}`;

            if (tripsPlan && tripsPlan.length > 0) {
              for (let i = 0; i < tripsPlan.length; i++) {
                const plan = tripsPlan[i];
                const tripNumber = tripsPlan.length > 1 ? `${baseTripNumber}-${i + 1}` : baseTripNumber;
                const tripDriver = plan.driverId || driverId || "";
                const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

                const tripPayload = {
                  tripNumber,
                  orderIds: [orderId],
                  comments: plan.comments || order.comments || `Viaje ${i + 1} de ${tripsPlan.length} por aprobación`,
                  totalTons: Number(plan.totalTons.toFixed(2)),
                  status: tripDriver ? "assigned" : "available",
                  assignedDriverId: tripDriver,
                  createdAt: new Date().toISOString(),
                  deliveryPin: generatedPin,
                };

                if (this.tripRepo.createTripAtomic) {
                  await this.tripRepo.createTripAtomic(tripPayload, [orderId]);
                } else {
                  await this.tripRepo.create(tripPayload);
                }
              }
            } else {
              const rawPending = Number(order.pendingBalance) || Number(order.totalTons) || 0;
              let tripTons = rawPending > 0
                ? rawPending
                : (order.deliveries || []).reduce((sum, d) => {
                    const qty = Number(d.quantity) || 0;
                    const dName = (d.productName || (d as any).name || "").toLowerCase();
                    const isSpecial = dName.includes("blanco") || dName.includes("especial") || dName.includes("estructural") || dName.includes("40kg") || dName.includes("40 kg");
                    let f = 0.0425;
                    if (d.weightKg && d.weightKg > 0) f = d.weightKg / 1000;
                    else if (d.unit === "metro_cubico" || dName.includes("metro")) f = 1.4;
                    else if (d.unit === "quintal" || dName.includes("quintal")) f = 0.04536;
                    else if (d.unit === "tonelada" || d.unit === "toneladas") f = 1.0;
                    else if (isSpecial) f = 0.0400;
                    else if (d.unit === "fundas" || dName.includes("arena")) f = 0.0400;
                    return sum + Number((qty * f).toFixed(2));
                  }, 0) ||
                  (order.items || []).reduce((sum, item) => {
                    const qty = Number(item.quantity) || 0;
                    const iName = (item.name || "").toLowerCase();
                    const isSpecial = iName.includes("blanco") || iName.includes("especial") || iName.includes("estructural") || iName.includes("40kg") || iName.includes("40 kg");
                    let f = 0.0425;
                    if (item.weightKg && item.weightKg > 0) f = item.weightKg / 1000;
                    else if (item.unit === "metro_cubico" || iName.includes("metro")) f = 1.4;
                    else if (item.unit === "quintal" || iName.includes("quintal")) f = 0.04536;
                    else if (item.unit === "tonelada" || item.unit === "toneladas") f = 1.0;
                    else if (isSpecial) f = 0.0400;
                    else if (item.unit === "fundas" || iName.includes("arena")) f = 0.0400;
                    return sum + Number((qty * f).toFixed(2));
                  }, 0) ||
                  1;

              if (driverId && this.userRepo) {
                const driverUser = await this.userRepo.getById(driverId);
                const driverCapacity = Number(driverUser?.vehicle?.tons) || 0;
                if (driverCapacity > 0) {
                  tripTons = Math.min(tripTons, driverCapacity);
                }
              }

              const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

              const tripPayload = {
                tripNumber: baseTripNumber,
                orderIds: [orderId],
                comments: order.comments || "Entrega generada automáticamente por aprobación",
                totalTons: tripTons,
                status: driverId ? "assigned" : "available",
                assignedDriverId: driverId || "",
                createdAt: new Date().toISOString(),
                deliveryPin: generatedPin,
              };

              if (this.tripRepo.createTripAtomic) {
                await this.tripRepo.createTripAtomic(tripPayload, [orderId]);
              } else {
                await this.tripRepo.create(tripPayload);
              }
            }
          }
        }
      } catch (tripError) {
        console.warn("No se pudo auto-crear el viaje para la orden aprobada:", tripError);
      }
    }
  }

}
