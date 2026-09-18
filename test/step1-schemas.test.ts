import test from "node:test";
import assert from "node:assert/strict";
import {
  UpdateOrderDeliveriesSchema,
  CompleteDeliverySchema,
  UpdateOrderStatusSchema,
  CreateOrderSchema,
} from "../src/interfaces/http/schemas/orderSchemas";

test("Step 1 Audit - Schema Validations", async (t) => {
  await t.test("UpdateOrderDeliveriesSchema: should reject invalid deliveryType", () => {
    const result = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "avion",
      deliveries: [
        {
          productId: "prod-1",
          quantity: 10,
        },
      ],
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /deliveryType/i);
    }
  });

  await t.test("UpdateOrderDeliveriesSchema: should reject empty deliveries array", () => {
    const result = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "domicilio",
      deliveries: [],
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /al menos una entrega/i);
    }
  });

  await t.test("UpdateOrderDeliveriesSchema: should reject zero or negative quantity", () => {
    const resultZero = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "domicilio",
      deliveries: [{ productId: "p1", quantity: 0 }],
    });
    assert.equal(resultZero.success, false);

    const resultNegative = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "domicilio",
      deliveries: [{ productId: "p1", quantity: -4 }],
    });
    assert.equal(resultNegative.success, false);
  });

  await t.test("UpdateOrderDeliveriesSchema: should reject missing productId", () => {
    const result = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "almacen",
      deliveries: [{ productId: "", quantity: 5 }],
    });
    assert.equal(result.success, false);
  });

  await t.test("UpdateOrderDeliveriesSchema: should accept valid payload", () => {
    const result = UpdateOrderDeliveriesSchema.safeParse({
      deliveryType: "domicilio",
      deliveries: [
        {
          productId: "prod-cement",
          quantity: 25,
          unit: "fundas",
          address: {
            placeId: "ChIJ12345",
            description: "Calle Principal #12, Santo Domingo",
            recipientName: "Juan Perez",
            recipientDocument: "00112345678",
            recipientDocumentType: "Cédula",
          },
        },
      ],
    });
    assert.equal(result.success, true);
  });

  await t.test("CompleteDeliverySchema: should accept valid payload", () => {
    const resultWithComment = CompleteDeliverySchema.safeParse({
      comment: "Entregado conforme en la obra",
    });
    assert.equal(resultWithComment.success, true);

    const resultEmpty = CompleteDeliverySchema.safeParse({});
    assert.equal(resultEmpty.success, true);
  });

  await t.test("UpdateOrderStatusSchema: should enforce approved / rejected only", () => {
    const resultValid = UpdateOrderStatusSchema.safeParse({
      status: "approved",
      driverId: "drv-999",
    });
    assert.equal(resultValid.success, true);

    const resultInvalid = UpdateOrderStatusSchema.safeParse({
      status: "en_camino",
    });
    assert.equal(resultInvalid.success, false);
  });
});
