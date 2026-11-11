import { Order } from "../../../domain/entities/Order";
import { Trip } from "../../../domain/entities/Trip";
import { User } from "../../../domain/entities/User";
import { OrderRepository } from "../../../domain/repositories/OrderRepository";
import { TripRepository } from "../../../domain/repositories/TripRepository";
import { UserRepository } from "../../../domain/repositories/UserRepository";

export interface DashboardActor {
  uid: string;
  userType: string;
}

export interface DashboardSummaryResult {
  metrics: {
    totalBilled: number;
    totalTons: number;
    pendingOrdersCount: number;
    activeTripsCount: number;
    activeDeliveriesCount: number;
    clientsCount: number;
    driversCount: number;
    sellersCount: number;
    pendingUsersCount: number;
    aiRiskCount: number;
  };
  activeTrips: any[];
  completedTrips: any[];
  clients: Partial<User>[];
  recentOrders: any[];
  pendingOrders: any[];
  pendingUsers: Partial<User>[];
  topSellers: any[];
  driversSummary: any[];
}

function calcOrderBilled(order: Order): number {
  return (order.items || []).reduce(
    (sum: number, it: any) => sum + (Number(it.subtotal) || Number(it.quantity || 0) * Number(it.unitPrice || 0) || 0),
    0
  );
}

function calcOrderTons(order: Order): number {
  if (typeof order.totalTons === "number") return order.totalTons;
  const bags = (order.items || [])
    .filter((it: any) => (it.name || "").toLowerCase().includes("cemento"))
    .reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
  return Number((bags * 0.0425).toFixed(2));
}

function toTimestamp(val?: string): number {
  if (!val) return 0;
  const ms = new Date(val).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function trimUserSummary(u: User): Partial<User> {
  return {
    uid: u.uid,
    names: u.names,
    lastNames: u.lastNames,
    email: u.email,
    phone: u.phone,
    userType: u.userType,
    status: u.status,
    sellerId: u.sellerId,
    sellerCode: u.sellerCode,
    driverCode: u.driverCode,
    companyName: u.companyName,
    vehicle: u.vehicle,
    aiRiskFlag: (u as any).aiRiskFlag,
  };
}

export class GetDashboardSummaryUseCase {
  constructor(
    private orderRepo: OrderRepository,
    private tripRepo: TripRepository,
    private userRepo: UserRepository
  ) {}

  async execute(actor: DashboardActor): Promise<DashboardSummaryResult> {
    const isSeller = actor.userType === "seller";

    const [orders, allTrips, users] = isSeller
      ? await Promise.all([
          this.orderRepo.getAll({ sellerId: actor.uid }),
          this.tripRepo.getAll(),
          Promise.all([
            this.userRepo.getAll({ userType: "client", sellerId: actor.uid }),
            this.userRepo.getAll({ userType: "driver" }),
          ]).then(([sellerClients, drivers]) => [...sellerClients, ...drivers]),
        ])
      : await Promise.all([
          this.orderRepo.getAll(),
          this.tripRepo.getAll(),
          this.userRepo.getAll(),
        ]);

    const sortedOrders = [...orders].sort(
      (a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt)
    );

    const scopedOrders = isSeller
      ? sortedOrders.filter(
          (o: any) => o.createdBySellerId === actor.uid || o.sellerId === actor.uid
        )
      : sortedOrders;

    const sellerOrderIds = new Set<string>();
    if (isSeller) {
      scopedOrders.forEach((o) => {
        if (o.id) sellerOrderIds.add(o.id);
        if (o.orderNumber !== undefined) sellerOrderIds.add(String(o.orderNumber));
      });
    }

    const trips = isSeller
      ? allTrips.filter((t) => (t.orderIds || []).some((id) => sellerOrderIds.has(id)))
      : allTrips;

    const userById = new Map<string, User>();
    users.forEach((u) => userById.set(u.uid, u));

    const validOrders = scopedOrders.filter(
      (o: any) => o.status !== "cancelled" && o.status !== "rejected"
    );

    const totalBilled = validOrders.reduce((acc, o) => acc + calcOrderBilled(o), 0);
    const totalTons = Number(
      validOrders.reduce((acc, o) => acc + calcOrderTons(o), 0).toFixed(2)
    );

    const pendingOrders = scopedOrders.filter((o) => o.status === "pending");
    const clients = users.filter((u) => u.userType === "client");
    const drivers = users.filter((u) => u.userType === "driver" && u.status === "active");
    const sellers = users.filter((u) => u.userType === "seller");
    const pendingUsers = users.filter((u) => u.status === "pending");
    const aiRiskUsers = users.filter((u) => (u as any).aiRiskFlag === true);

    const activeStatuses = isSeller
      ? ["started", "accepted", "in_progress"]
      : ["started", "in_progress", "accepted", "assigned"];

    const activeTrips = trips
      .filter((t) => activeStatuses.includes(t.status))
      .map((t: any) => {
        const matchedDriver = userById.get(t.assignedDriverId || t.driverId || "");
        return {
          ...t,
          driver:
            t.driver ||
            (matchedDriver
              ? {
                  names: matchedDriver.names,
                  lastNames: matchedDriver.lastNames,
                  phone: matchedDriver.phone,
                }
              : undefined),
          driverName: matchedDriver
            ? `${matchedDriver.names} ${matchedDriver.lastNames || ""}`.trim()
            : t.driver?.names || "Conductor por asignar",
          driverPhone: matchedDriver?.phone,
        };
      });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoMs = sevenDaysAgo.getTime();

    const completedTrips = trips
      .filter((t: any) => {
        if (t.status !== "completed") return false;
        return toTimestamp(t.completedAt || t.updatedAt || t.createdAt) >= sevenDaysAgoMs;
      })
      .map((t: any) => {
        const matchedOrder = scopedOrders.find(
          (o) =>
            (t.orderIds || []).includes(o.id) ||
            (t.orderIds || []).includes(String(o.orderNumber))
        ) as any;
        const matchedDriver = userById.get(t.assignedDriverId || t.driverId || "");
        return {
          ...t,
          clientName: matchedOrder
            ? `${matchedOrder.userNames || ""} ${matchedOrder.userLastNames || ""}`.trim()
            : undefined,
          driverName: matchedDriver
            ? `${matchedDriver.names} ${matchedDriver.lastNames || ""}`.trim()
            : t.driver?.names || undefined,
        };
      });

    const topSellers = isSeller
      ? []
      : sellers
          .map((s) => {
            const sellerClients = clients.filter((c) => c.sellerId === s.uid);
            const sellerClientIds = new Set(sellerClients.map((c) => c.uid));
            const sellerOrders = validOrders.filter(
              (o: any) =>
                o.sellerId === s.uid ||
                o.createdBySellerId === s.uid ||
                (o.userId && sellerClientIds.has(o.userId))
            );
            const billed = sellerOrders.reduce((acc, o) => acc + calcOrderBilled(o), 0);
            const tons = sellerOrders.reduce((acc, o) => acc + (Number(o.totalTons) || 0), 0);
            const code =
              s.sellerCode || (s.uid ? `VEND-${s.uid.slice(0, 5).toUpperCase()}` : "VEND-XXXX");

            return {
              uid: s.uid,
              names: s.names,
              lastNames: s.lastNames || "",
              sellerCode: code,
              phone: s.phone,
              totalBilled: billed,
              totalTons: Number(tons.toFixed(2)),
              clientsCount: sellerClients.length,
              ordersCount: sellerOrders.length,
            };
          })
          .sort((a, b) => b.ordersCount - a.ordersCount)
          .slice(0, 6);

    const driversSummary = isSeller
      ? []
      : drivers
          .map((d) => {
            const activeTrip = trips.find(
              (t: any) =>
                (t.assignedDriverId === d.uid || t.driverId === d.uid) &&
                ["started", "in_progress"].includes(t.status)
            );
            const driverCompletedTrips = trips.filter(
              (t: any) =>
                (t.assignedDriverId === d.uid || t.driverId === d.uid) &&
                t.status === "completed"
            );
            const deliveredTons = driverCompletedTrips.reduce(
              (acc, t) => acc + (Number(t.totalTons) || 0),
              0
            );
            return {
              uid: d.uid,
              names: d.names,
              lastNames: d.lastNames || "",
              phone: d.phone,
              vehicle: d.vehicle,
              isOnRoute: !!activeTrip,
              completedTripsCount: driverCompletedTrips.length,
              totalDeliveredTons: Number(deliveredTons.toFixed(2)),
            };
          })
          .slice(0, 6);

    return {
      metrics: {
        totalBilled,
        totalTons,
        pendingOrdersCount: pendingOrders.length,
        activeTripsCount: activeTrips.length,
        activeDeliveriesCount: activeTrips.length,
        clientsCount: clients.length,
        driversCount: drivers.length,
        sellersCount: sellers.length,
        pendingUsersCount: pendingUsers.length,
        aiRiskCount: aiRiskUsers.length,
      },
      activeTrips,
      completedTrips,
      clients: clients.slice(0, 10).map(trimUserSummary),
      recentOrders: scopedOrders.slice(0, isSeller ? 5 : 6),
      pendingOrders: pendingOrders.slice(0, 5),
      pendingUsers: pendingUsers.slice(0, 5).map(trimUserSummary),
      topSellers,
      driversSummary,
    };
  }
}
