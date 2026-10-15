import { z } from "zod";

export const CreateProductSchema = z.object({
  name: z.string().min(1, "El nombre del producto es requerido"),
  unit: z.string().min(1, "La unidad es requerida"),
  price: z.number().positive("El precio debe ser un número mayor a 0"),
  imageUrl: z.string().optional(),
  weightKg: z.number().positive("El peso debe ser un número positivo").optional(),
});

export const UpdateProductSchema = z.object({
    name: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    price: z.number().positive("El precio debe ser positivo").optional(),
    imageUrl: z.string().optional(),
    weightKg: z.number().positive("El peso debe ser un número positivo").optional(),
})
.refine(
    (data) =>
        data.name !== undefined ||
        data.unit !== undefined ||
        data.price !== undefined ||
        data.weightKg !== undefined,
        {
            message: "Debe proporcionar al menos un campo para actualizar"
        }
)