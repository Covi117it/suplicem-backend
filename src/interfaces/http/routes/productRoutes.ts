import { Router } from "express";
import multer from "multer";
import { ProductController } from "../controllers/ProductController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import { normalizeProductData } from "../middlewares/normalizeProductData";
import { CreateProductSchema, UpdateProductSchema } from "../schemas/productSchemas";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB límite
});

export const productRoutes = (router: Router) => {
  const productController = new ProductController();

  router.get("/products/search", (req, res) => productController.search(req, res));
  router.get("/products/:id", authenticate, (req, res) => productController.getById(req, res));
  router.get("/products", authenticate, (req, res) => {
    if (req.query.search !== undefined) {
      return productController.search(req, res);
    }
    return productController.getAll(req, res);
  });
  router.post(
    "/products",
    authenticate,
    requireRole(["admin"]),
    upload.single("image"),
    normalizeProductData,
    validate(CreateProductSchema),
    (req, res) => productController.create(req, res)
  );
  router.put(
    "/products/:id",
    authenticate,
    requireRole(["admin"]),
    upload.single("image"),
    normalizeProductData,
    validate(UpdateProductSchema),
    (req, res) => productController.update(req, res)
  );
  router.delete(
    "/products/:id",
    authenticate,
    requireRole(["admin"]),
    (req, res) => productController.delete(req, res)
  );
};