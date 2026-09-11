import { Request, Response } from "express";
import { ProductFirestoreRepository } from "../../../infrastructure/firestore/ProductFirestoreRepository";
import { CreateProductUseCase } from "../../../application/use-cases/product/CreateProductUseCase";
import { GetAllProductsUseCase } from "../../../application/use-cases/product/GetAllProductsUseCase";
import { SearchProductsUseCase } from "../../../application/use-cases/product/SearchProductsUseCase";

const productRepo = new ProductFirestoreRepository();
const createProductUseCase = new CreateProductUseCase(productRepo);
const getAllProductsUseCase = new GetAllProductsUseCase(productRepo);
const searchProductsUseCase = new SearchProductsUseCase(productRepo);

export class ProductController {
  async create(req: Request, res: Response) {
    try {
      const { name, unit, price, imageUrl } = req.body;

      const id = await createProductUseCase.execute({
        name,
        unit,
        price,
        imageUrl,
      });

      res.status(201).json({
        success: true,
        message: "Producto creado correctamente",
        id,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al guardar el producto",
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const products = await getAllProductsUseCase.execute();
      res.status(200).json({
        success: true,
        products,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al obtener los productos",
      });
    }
  }

  async search(req: Request, res: Response) {
    try {
      const { search } = req.query;

      const products = await searchProductsUseCase.execute(
        typeof search === "string" ? search : undefined
      );

      res.status(200).json({
        success: true,
        products,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al buscar productos",
      });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, unit, price, imageUrl } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (unit !== undefined) updateData.unit = unit;
      if (price !== undefined) updateData.price = Number(price);
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

      await productRepo.update(id, updateData);

      res.status(200).json({
        success: true,
        message: "Producto actualizado correctamente",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar producto",
      });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await productRepo.delete(id);

      res.status(200).json({
        success: true,
        message: "Producto eliminado correctamente",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Error al eliminar producto",
      });
    }
  }
}
