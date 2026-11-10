import { z } from "zod";

export const AddressSchema = z.object({
  id: z.string().optional(),
  placeId: z.string().optional(),
  description: z.string().optional(),
  latitude: z.coerce
    .number()
    .optional()
    .transform((val) => (val === 0 || isNaN(val as number) ? undefined : val)),
  longitude: z.coerce
    .number()
    .optional()
    .transform((val) => (val === 0 || isNaN(val as number) ? undefined : val)),
  additionalInfo: z.string().optional(),
  recipientName: z.string().optional(),
  recipientDocument: z.string().optional(),
  recipientDocumentType: z.string().optional(),
  userUid: z.string().optional(),
});

export const CreateOrderSchema = z
  .object({
    userId: z.string().optional(),
    deliveryType: z.enum(["almacen", "domicilio"], {
      message: "deliveryType debe ser 'almacen' o 'domicilio'",
    }),
    deliveries: z
      .array(
        z.object({
          productId: z.string().min(1, "productId es requerido"),
          quantity: z.number().positive("quantity debe ser mayor a 0"),
          unit: z.string().min(1, "unit es requerido"),
          address: AddressSchema.optional().nullable(),
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
    idempotencyKey: z.string().optional(),
    createdBySellerId: z.string().optional(),
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

    // Regla de Negocio: Pedidos directos vs Venta Asistida de cemento
    const isSellerAssisted = Boolean(data.createdBySellerId);

    data.items.forEach((item, index) => {
      const isCement = item.unit === "fundas" || (item.name && item.name.toLowerCase().includes("cemento"));
      if (isCement) {
        if (!isSellerAssisted && (item.quantity < 50 || item.quantity > 1000 || item.quantity % 50 !== 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `La cantidad de cemento (${item.quantity}) para pedidos directos debe ser entre 50 y 1,000 fundas (en múltiplos de 50). Para compras mayores a 1,000 fundas, gestione su compra con un vendedor.`,
            path: ["items", index, "quantity"],
          });
        } else if (isSellerAssisted && (item.quantity < 50 || item.quantity % 50 !== 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `La cantidad de cemento (${item.quantity}) en venta asistida debe ser a partir de 50 fundas y en múltiplos de 50.`,
            path: ["items", index, "quantity"],
          });
        }
      }
    });

    if (data.deliveries) {
      data.deliveries.forEach((del, index) => {
        if (del.unit === "fundas") {
          if (!isSellerAssisted && (del.quantity < 50 || del.quantity > 1000 || del.quantity % 50 !== 0)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `La cantidad en entrega (${del.quantity}) para pedidos directos debe ser entre 50 y 1,000 fundas y en múltiplos de 50`,
              path: ["deliveries", index, "quantity"],
            });
          } else if (isSellerAssisted && (del.quantity < 50 || del.quantity % 50 !== 0)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `La cantidad en entrega (${del.quantity}) en venta asistida debe ser a partir de 50 fundas y en múltiplos de 50`,
              path: ["deliveries", index, "quantity"],
            });
          }
        }
      });
    }
  });

export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum(["approved", "rejected", "completed"], {
      message: "status debe ser 'approved', 'rejected' o 'completed'",
    }),
    reason: z.string().optional(),
    driverId: z.string().optional(),
    tripsPlan: z
      .array(
        z.object({
          totalTons: z.number().positive("totalTons debe ser mayor a 0"),
          driverId: z.string().optional(),
          comments: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.status !== "rejected" || (data.reason || "").trim().length >= 5,
    {
      message: "El motivo de rechazo debe tener al menos 5 caracteres.",
      path: ["reason"],
    }
  );


export const UpdateOrderDeliveriesSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    data.deliveries.forEach((del, index) => {
      if (del.unit === "fundas" && (del.quantity < 50 || del.quantity % 50 !== 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Cada entrega de cemento (${del.quantity}) debe ser a partir de 50 fundas y en múltiplos de 50`,
          path: ["deliveries", index, "quantity"],
        });
      }
    });
  });

export const CompleteDeliverySchema = z
  .object({
    comment: z.string().optional(),
  })
  .optional()
  .default({});

  export const AttachDeliveryProofSchema = z.object({
  comment: z.string().optional(),
}).optional().default({});