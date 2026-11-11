import { NotificationRepository } from "../../domain/repositories/NotificationRepository";
import { Notification } from "../../domain/entities/Notification";

export class NotificationDispatcherService {
  constructor(private notificationRepo: NotificationRepository) {}

  async notifyOrderCreated(params: {
    orderNumber: number;
    sellerId?: string;
    clientName: string;
    totalAmount?: string;
    totalTons?: number;
    address?: string;
  }): Promise<void> {
    if (!params.sellerId) return;

    const notif: Omit<Notification, "id"> = {
      recipientId: params.sellerId,
      recipientRole: "seller",
      type: "order_created",
      category: "orders",
      actorName: params.clientName,
      actorRole: "Cliente de Cartera",
      title: "ha creado un nuevo pedido",
      description: `Pedido de ${params.totalTons ? `${params.totalTons} Ton` : "cemento"} registrado en el sistema.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      preview: {
        orderNumber: params.orderNumber,
        badgeLabel: "Por Aprobar",
        badgeColor: "warning",
        totalAmount: params.totalAmount,
        details: params.address || "Entrega programada",
        actionUrl: `/admin/orders?search=${params.orderNumber}`,
      },
    };

    await this.notificationRepo.create(notif);
  }

  async notifyOrderStatusChanged(params: {
    orderNumber: number;
    sellerId?: string;
    status: "approved" | "rejected";
    reason?: string;
    clientName: string;
  }): Promise<void> {
    if (!params.sellerId) return;

    const isApproved = params.status === "approved";
    const notif: Omit<Notification, "id"> = {
      recipientId: params.sellerId,
      recipientRole: "seller",
      type: isApproved ? "order_approved" : "order_rejected",
      category: "orders",
      actorName: "Administración",
      actorRole: "Finanzas",
      title: isApproved ? `aprobó el Pedido #${params.orderNumber}` : `rechazó el Pedido #${params.orderNumber}`,
      description: isApproved
        ? `El pago para ${params.clientName} ha sido verificado.`
        : `Motivo: ${params.reason || "Revisar comprobante adjunto"}`,
      isRead: false,
      createdAt: new Date().toISOString(),
      preview: {
        orderNumber: params.orderNumber,
        badgeLabel: isApproved ? "Aprobado" : "Rechazado",
        badgeColor: isApproved ? "success" : "error",
        details: `Cliente: ${params.clientName}`,
        actionUrl: `/admin/orders?search=${params.orderNumber}`,
      },
    };

    await this.notificationRepo.create(notif);
  }
}
