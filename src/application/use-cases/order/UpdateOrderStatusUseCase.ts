import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";
import { selectBestDriver } from "../../../domain/services/DriverAssignmentService";
import { NotificationDispatcherService } from "../../services/NotificationDispatcherService";

export class UpdateOrderStatusUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo?: TripRepository,
    private userRepo?: UserRepository,
    private notificationDispatcher?: NotificationDispatcherService
  ) {}

  private async resolveDriverId(
    requiredTons: number,
    preferredDriverId?: string,
    cachedContext?: { drivers: any[]; trips: any[] }
  ): Promise<string> {
    const preferred = (preferredDriverId || "").trim();
    if (preferred) return preferred;
    if (!this.userRepo || !this.tripRepo) return "";

    if (!cachedContext) {
      const [drivers, trips] = await Promise.all([
        this.userRepo.getAll({ status: "active", userType: "driver" }),
        this.tripRepo.getActiveTrips ? this.tripRepo.getActiveTrips() : this.tripRepo.getAll(),
      ]);
      return selectBestDriver(drivers, trips, requiredTons) || "";
    }

    const selected = selectBestDriver(cachedContext.drivers, cachedContext.trips, requiredTons) || "";
    if (selected) {
      cachedContext.trips.push({
        assignedDriverId: selected,
        driverId: selected,
        status: "assigned",
        totalTons: requiredTons,
      });
    }
    return selected;
  }

  async execute(
    orderId: string,
    status: "approved" | "rejected" | "completed",
    reason?: string,
    driverId?: string,
    tripsPlan?: Array<{ totalTons: number; driverId?: string; comments?: string }>
  ): Promise<void> {
    if (status === "rejected" && (!reason || reason.trim().length < 5)) {
      throw new Error("El motivo de rechazo debe tener al menos 5 caracteres");
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

      if (this.notificationDispatcher) {
        Promise.resolve()
          .then(async () => {
            let sellerId = order.sellerId || order.createdBySellerId;
            if (!sellerId && order.userId && this.userRepo) {
              const client = await this.userRepo.getById(order.userId).catch(() => null);
              sellerId = client?.sellerId;
            }
            if (!sellerId) return;

            const clientName = `${order.userNames || ""} ${order.userLastNames || ""}`.trim() || "Cliente";
            const isPickup = order.deliveryType === "almacen";

            await this.notificationDispatcher!.notifyDeliveryCompleted({
              sellerId,
              driverName: isPickup ? "Almacén" : "Administración",
              actorRole: isPickup ? "Despacho" : "Administración",
              title: `entregó el Pedido #${order.orderNumber}`,
              description: isPickup
                ? `Retiro en almacén completado para ${clientName}.`
                : `Entrega completada para ${clientName}.`,
              clientName,
              orderNumber: order.orderNumber,
              details: `Cliente: ${clientName}`,
            });
          })
          .catch((err) =>
            console.warn("[Notification] Error al notificar orden completada:", err?.message || err)
          );
      }
      return;
    }

    await this.orderRepo.updateStatus(orderId, status, reason);

    if (this.notificationDispatcher && (status === "approved" || status === "rejected")) {
      this.orderRepo.getById(orderId).then((order) => {
        if (order && (order.sellerId || order.createdBySellerId)) {
          const sellerId = order.sellerId || order.createdBySellerId;
          const clientName = `${order.userNames || ""} ${order.userLastNames || ""}`.trim() || "Cliente";
          this.notificationDispatcher?.notifyOrderStatusChanged({
            orderNumber: order.orderNumber,
            sellerId,
            status,
            reason,
            clientName,
          }).catch((err) => console.warn("[Notification] Error al notificar cambio de estado:", err?.message || err));
        }
      }).catch((err) => console.warn("[Notification] Error al consultar orden:", err?.message || err));
    }

    if (status === "approved" && this.tripRepo) {
      try {
        const order = await this.orderRepo.getById(orderId);
        if (order && order.deliveryType === "domicilio") {
          const existingTrip = await this.tripRepo.getTripByOrderId(orderId);
          if (!existingTrip || existingTrip.status === "canceled") {
            const baseTripNumber = `TRIP-${order.orderNumber || orderId.slice(0, 6).toUpperCase()}`;

            if (tripsPlan && tripsPlan.length > 0) {
              const needsAutoDriver = tripsPlan.some((p) => !(p.driverId || driverId || "").trim());
              const driverContext =
                needsAutoDriver && this.userRepo && this.tripRepo
                  ? await Promise.all([
                      this.userRepo.getAll({ status: "active", userType: "driver" }),
                      this.tripRepo.getActiveTrips ? this.tripRepo.getActiveTrips() : this.tripRepo.getAll(),
                    ]).then(([drivers, trips]) => ({ drivers, trips: [...trips] }))
                  : undefined;

              for (let i = 0; i < tripsPlan.length; i++) {
                const plan = tripsPlan[i];
                const tripNumber = tripsPlan.length > 1 ? `${baseTripNumber}-${i + 1}` : baseTripNumber;
                const tripDriver = await this.resolveDriverId(
                  plan.totalTons,
                  plan.driverId || driverId,
                  driverContext
                );
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

              const resolvedDriverId = await this.resolveDriverId(tripTons, driverId);
              const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

              const tripPayload = {
                tripNumber: baseTripNumber,
                orderIds: [orderId],
                comments: order.comments || "Entrega generada automáticamente por aprobación",
                totalTons: tripTons,
                status: resolvedDriverId ? "assigned" : "available",
                assignedDriverId: resolvedDriverId,
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
