import { Router } from "express";
import { ProductController } from "../controllers/ProductController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/authorize";

export const productRoutes = (router: Router) => {
  const productController = new ProductController();

  router.get("/products/search", (req, res) => productController.search(req, res));
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
    (req, res) => productController.create(req, res)
  );
  router.put(
    "/products/:id",
    authenticate,
    requireRole(["admin"]),
    (req, res) => productController.update(req, res)
  );
  router.delete(
    "/products/:id",
    authenticate,
    requireRole(["admin"]),
    (req, res) => productController.delete(req, res)
  );
};
