import test from "node:test";
import assert from "node:assert/strict";
import { OrderController } from "../src/interfaces/http/controllers/OrderController";

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.jsonData = null;
  res.status = function (code: number) {
    this.statusCode = code;
    return this;
  };
  res.json = function (data: any) {
    this.jsonData = data;
    return this;
  };
  return res;
}

test("Step 3 Audit - OrderController Dependency Injection & Thin Execution", async (t) => {
  const mockUpdateDeliveriesUseCase: any = {
    execute: async (id: string, deliveryType: string, deliveries: any[]) => {
      if (id === "error-order") {
        throw new Error("Error de validación simulado");
      }
      return { id, deliveryType, deliveries };
    },
  };

  const mockAttachProofUseCase: any = {
    execute: async (dto: any) => {
      return;
    },
  };

  const mockGetOrderByIdUseCase: any = {
    execute: async (id: string) => {
      if (id === "missing") return null;
      return { id, userId: "user-owner" };
    },
  };

  const controller = new OrderController(
    {} as any, // createOrderUseCase
    {} as any, // getMyOrdersUseCase
    {} as any, // getOrderTrackingUseCase
    mockGetOrderByIdUseCase,
    {} as any, // getAllOrdersUseCase
    {} as any, // updateOrderStatusUseCase
    {} as any, // markDeliveryCompletedUseCase
    mockAttachProofUseCase,
    mockUpdateDeliveriesUseCase,
    {} as any // orderRepo
  );

  await t.test("updateDeliveries: should return 200 when successful", async () => {
    const req: any = {
      params: { id: "order-1" },
      body: {
        deliveryType: "domicilio",
        deliveries: [{ productId: "p1", quantity: 10 }],
      },
    };
    const res = createMockRes();

    await controller.updateDeliveries(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.order.id, "order-1");
  });

  await t.test("updateDeliveries: should return 400 when use case rejects", async () => {
    const req: any = {
      params: { id: "error-order" },
      body: {
        deliveryType: "domicilio",
        deliveries: [{ productId: "p1", quantity: 10 }],
      },
    };
    const res = createMockRes();

    await controller.updateDeliveries(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
    assert.match(res.jsonData.message, /Error de validación simulado/);
  });

  await t.test("attachToDelivery: should reject NaN index with 400", async () => {
    const req: any = {
      params: { id: "order-1", index: "not-a-number" },
      body: {},
    };
    const res = createMockRes();

    await controller.attachToDelivery(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.jsonData.success, false);
  });

  await t.test("attachToDelivery: should succeed with valid index", async () => {
    const req: any = {
      params: { id: "order-1", index: "0" },
      body: { comment: "Foto entregada" },
    };
    const res = createMockRes();

    await controller.attachToDelivery(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
  });

  await t.test("getById: should block client accessing another client's order (BOLA)", async () => {
    const req: any = {
      params: { id: "order-1" },
      user: { uid: "intruder-user", userType: "client" },
    };
    const res = createMockRes();

    await controller.getById(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.jsonData.success, false);
  });

  await t.test("getById: should allow owner client to view order", async () => {
    const req: any = {
      params: { id: "order-1" },
      user: { uid: "user-owner", userType: "client" },
    };
    const res = createMockRes();

    await controller.getById(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.jsonData.success, true);
    assert.equal(res.jsonData.order.id, "order-1");
  });
});
