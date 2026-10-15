import { Request, Response } from "express";
import { uploadProductImage } from "../../../domain/services/ImageStorageService";
import { ProductFirestoreRepository } from "../../../infrastructure/firestore/ProductFirestoreRepository";
import { CreateProductUseCase } from "../../../application/use-cases/product/CreateProductUseCase";
import { GetAllProductsUseCase } from "../../../application/use-cases/product/GetAllProductsUseCase";
import { SearchProductsUseCase } from "../../../application/use-cases/product/SearchProductsUseCase";
import { UpdateProductUseCase } from "../../../application/use-cases/product/UpdateProductUseCase";
import { DeleteProductUseCase } from "../../../application/use-cases/product/DeleteProductUseCase";

const defaultRepo = new ProductFirestoreRepository();
const defaultCreateUseCase = new CreateProductUseCase(defaultRepo);
const defaultGetAllUseCase = new GetAllProductsUseCase(defaultRepo);
const defaultSearchUseCase = new SearchProductsUseCase(defaultRepo);
const defaultUpdateUseCase = new UpdateProductUseCase(defaultRepo);
const defaultDeleteUseCase = new DeleteProductUseCase(defaultRepo);

export class ProductController {
  constructor(
    private createProductUseCase: CreateProductUseCase = defaultCreateUseCase,
    private getAllProductsUseCase: GetAllProductsUseCase = defaultGetAllUseCase,
    private searchProductsUseCase: SearchProductsUseCase = defaultSearchUseCase,
    private updateProductUseCase: UpdateProductUseCase = defaultUpdateUseCase,
    private deleteProductUseCase: DeleteProductUseCase = defaultDeleteUseCase
  ) {}

    async create(req: Request, res: Response) {
    try {
      let { name, unit, price, imageUrl, weightKg } = req.body;
      if (req.file) {
        imageUrl = await uploadProductImage(req.file);
      }
      const id = await this.createProductUseCase.execute({
        name,
        unit,
        price: Number(price),
        imageUrl,
        weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
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
      const products = await this.getAllProductsUseCase.execute();
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
      const products = await this.searchProductsUseCase.execute(
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
      const { name, unit, price, imageUrl, weightKg } = req.body;

      await this.updateProductUseCase.execute(id, {
        name,
        unit,
        price: price !== undefined ? Number(price) : undefined,
        imageUrl,
        weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
      });

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
      await this.deleteProductUseCase.execute(id);

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