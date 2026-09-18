import test from "node:test";
import assert from "node:assert/strict";
import { UpdateOrderDeliveriesUseCase } from "../src/application/use-cases/order/UpdateOrderDeliveriesUseCase";
import { OrderRepository } from "../src/domain/repositories/OrderRepository";
import { Order } from "../src/domain/entities/Order";

class MockOrderRepository implements Partial<OrderRepository> {
  public order: Order | null = null;
  public updatedDeliveriesCall: any = null;

  async getById(orderId: string): Promise<Order | null> {
    if (this.order && this.order.id === orderId) {
      return this.order;
    }
    return null;
  }

  async updateDeliveries(
    orderId: string,
    deliveryType: string,
    deliveries: any[]
  ): Promise<any> {
    this.updatedDeliveriesCall = { orderId, deliveryType, deliveries };
    return {
      ...this.order,
      deliveryType,
      deliveries,
    };
  }
}

test("Step 2 Audit - UpdateOrderDeliveriesUseCase Domain Rules", async (t) => {
  const mockRepo = new MockOrderRepository();
  const useCase = new UpdateOrderDeliveriesUseCase(mockRepo as unknown as OrderRepository);

  const baseOrder: Order = {
    id: "order-123",
    orderNumber: 1001,
    userId: "user-abc",
    deliveryType: "domicilio",
    status: "pending",
    createdAt: new Date().toISOString(),
    deliveries: [],
    items: [
      {
        productId: "prod-cement",
        name: "Cemento Portland",
        unit: "fundas",
        quantity: 50,
        unitPrice: 400,
        subtotal: 20000,
      },
      {
        productId: "prod-sand",
        name: "Arena Gruesa",
        unit: "m3",
        quantity: 10,
        unitPrice: 1200,
        subtotal: 12000,
      },
    ],
  };

  await t.test("should throw error if order does not exist", async () => {
    mockRepo.order = null;
    await assert.rejects(
      async () => {
        await useCase.execute("non-existent", "domicilio", [
          { productId: "prod-cement", quantity: 10, unit: "fundas" },
        ]);
      },
      { message: "Orden no encontrada" }
    );
  });

  await t.test("should throw error if order is rejected", async () => {
    mockRepo.order = { ...baseOrder, status: "rejected" };
    await assert.rejects(
      async () => {
        await useCase.execute("order-123", "domicilio", [
          { productId: "prod-cement", quantity: 10, unit: "fundas" },
        ]);
      },
      { message: "No se pueden modificar las entregas de una orden rechazada." }
    );
  });

  await t.test("should throw error if delivery contains a product not in the order", async () => {
    mockRepo.order = { ...baseOrder };
    await assert.rejects(
      async () => {
        await useCase.execute("order-123", "domicilio", [
          { productId: "prod-unknown-item", quantity: 5, unit: "fundas" },
        ]);
      },
      /no pertenece a los productos comprados/
    );
  });

  await t.test("should throw error if requested quantity exceeds available quantity", async () => {
    mockRepo.order = { ...baseOrder };
    // Ordered is 50, requested is 60 (30 + 30)
    await assert.rejects(
      async () => {
        await useCase.execute("order-123", "domicilio", [
          { productId: "prod-cement", quantity: 30, unit: "fundas" },
          { productId: "prod-cement", quantity: 30, unit: "fundas" },
        ]);
      },
      /supera la disponibilidad real/
    );
  });

  await t.test("should throw error if quantity is <= 0", async () => {
    mockRepo.order = { ...baseOrder };
    await assert.rejects(
      async () => {
        await useCase.execute("order-123", "domicilio", [
          { productId: "prod-cement", quantity: 0, unit: "fundas" },
        ]);
      },
      /debe ser mayor a cero/
    );
  });

  await t.test("should successfully execute and delegate to repo when valid", async () => {
    mockRepo.order = { ...baseOrder };
    const validDeliveries = [
      {
        productId: "prod-cement",
        quantity: 20,
        unit: "fundas",
        address: { description: "Destino A" },
      },
      {
        productId: "prod-cement",
        quantity: 30,
        unit: "fundas",
        address: { description: "Destino B" },
      },
      {
        productId: "prod-sand",
        quantity: 10,
        unit: "m3",
        address: { description: "Destino A" },
      },
    ];

    const result = await useCase.execute("order-123", "domicilio", validDeliveries as any);
    assert.ok(result);
    assert.equal(mockRepo.updatedDeliveriesCall.orderId, "order-123");
    assert.equal(mockRepo.updatedDeliveriesCall.deliveryType, "domicilio");
    assert.equal(mockRepo.updatedDeliveriesCall.deliveries.length, 3);
  });
});
