import { User } from "../entities/User";

export class OrderPolicyValidatorService {
  /**
   * Valida que el cliente exista y que, si la orden es asistida por un vendedor,
   * el cliente pertenezca obligatoriamente a la cartera de dicho vendedor.
   */
  validateSellerPortfolio(client: User | null, createdBySellerId?: string): void {
    if (!createdBySellerId) return;

    if (!client) {
      throw new Error("Acceso denegado: El cliente especificado para la venta asistida no existe.");
    }

    const clientSellerId = String(client.sellerId || "").trim();
    const activeSellerId = String(createdBySellerId || "").trim();

    if (clientSellerId !== activeSellerId) {
      throw new Error(
        "Acceso denegado: El cliente no pertenece a la cartera de ventas asignada a este vendedor."
      );
    }
  }

  /**
   * Valida que si el método de pago es crédito, el cliente cuente obligatoriamente
   * con un vendedor activo asignado a su cartera.
   */
  validateCreditEligibility(client: User | null, paymentMethod?: "transfer" | "credit"): void {
    if (paymentMethod !== "credit") return;

    if (!client) {
      throw new Error("Cliente no identificado para validar la solicitud de financiamiento.");
    }

    if (!client.sellerId || !client.sellerId.trim()) {
      throw new Error(
        "El pago a crédito está restringido: el cliente debe contar con un vendedor asignado a su cartera para optar por financiamiento."
      );
    }
  }
}
