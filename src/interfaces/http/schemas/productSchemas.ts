import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z.string().min(1, "El nombre del producto es requerido"),
  unit: z.string().min(1, "La unidad es requerida"),
  price: z.coerce.number().positive("El precio debe ser un número mayor a 0"),
  lotSize: z.coerce.number().int().positive("El tamaño del lote debe ser mayor a 0").optional(),
  lotPrice: z.coerce.number().positive("El precio del lote debe ser mayor a 0").optional(),
  lotPrices: z.record(z.string(), z.coerce.number().positive()).optional(),
  manualLotPrices: z.record(z.string(), z.coerce.number().positive()).optional(),
  imageUrl: z.string().optional(),
  weightKg: z.coerce.number().positive("El peso debe ser un número positivo").optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  price: z.coerce.number().positive("El precio debe ser positivo").optional(),
  lotSize: z.coerce.number().int().positive("El tamaño del lote debe ser mayor a 0").optional(),
  lotPrice: z.coerce.number().positive("El precio del lote debe ser mayor a 0").optional(),
  lotPrices: z.record(z.string(), z.coerce.number().positive()).optional(),
  manualLotPrices: z.record(z.string(), z.coerce.number().positive()).optional(),
  imageUrl: z.string().optional(),
  weightKg: z.coerce.number().positive("El peso debe ser un número positivo").optional(),
}).refine(
  (data) =>
    data.name !== undefined ||
    data.unit !== undefined ||
    data.price !== undefined ||
    data.lotSize !== undefined ||
    data.lotPrice !== undefined ||
    data.lotPrices !== undefined ||
    data.manualLotPrices !== undefined ||
    data.weightKg !== undefined,
  {
    message: "Debe proporcionar al menos un campo para actualizar",
  }
);
