import { z } from "zod";

export const AddressSchema = z.object({
  id: z.string().optional(),
  placeId: z.string().optional(),
  description: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  additionalInfo: z.string().optional(),
  recipientName: z.string().optional(),
  recipientDocument: z.string().optional(),
  recipientDocumentType: z.string().optional(),
  userUid: z.string().optional(),
});

export const CreateOrderSchema = z
  .object({
    deliveryType: z.enum(["almacen", "domicilio"], {
      message: "deliveryType debe ser 'almacen' o 'domicilio'",
    }),
    deliveries: z
      .array(
        z.object({
          productId: z.string().min(1, "productId es requerido"),
          quantity: z.number().positive("quantity debe ser mayor a 0"),
          unit: z.string().min(1, "unit es requerido"),
          address: z.any().optional(),
        })
      )
      .optional()
      .default([]),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "productId es requerido"),
          quantity: z.number().positive("quantity debe ser mayor a 0"),
          name: z.string().optional(),
          unit: z.string().optional(),
          unitPrice: z.number().positive().optional(),
          subtotal: z.number().positive().optional(),
        })
      )
      .min(1, "Debe incluir al menos un producto"),
    comments: z.string().optional(),
    receiptImage: z.string().optional(),
    paymentMethod: z.enum(["transfer", "credit"]).optional(),
    bankAccountId: z.string().optional(),
    creditNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.deliveryType === "domicilio" &&
      (!data.deliveries || data.deliveries.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe incluir al menos una entrega para pedidos a domicilio",
        path: ["deliveries"],
      });
    }
  });

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    message: "status debe ser 'approved' o 'rejected'",
  }),
  reason: z.string().optional(),
  driverId: z.string().optional(),
});

export const UpdateOrderDeliveriesSchema = z.object({
  deliveryType: z.enum(["almacen", "domicilio"], {
    message: "deliveryType debe ser 'almacen' o 'domicilio'",
  }),
  deliveries: z
    .array(
      z.object({
        id: z.string().optional(),
        productId: z.string().min(1, "productId es requerido"),
        quantity: z.number().positive("La cantidad debe ser mayor a 0"),
        unit: z.string().optional().default("fundas"),
        status: z.string().optional(),
        address: AddressSchema.optional().nullable(),
      })
    )
    .min(1, "Debe incluir al menos una entrega"),
});

export const CompleteDeliverySchema = z
  .object({
    comment: z.string().optional(),
  })
  .optional()
  .default({});