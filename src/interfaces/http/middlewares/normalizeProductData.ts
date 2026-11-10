import { Request, Response, NextFunction } from "express";

export const normalizeProductData = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.body) {
    req.body = {};
    return next();
  }

  if (typeof req.body.price === "string") {
    const parsed = parseFloat(req.body.price);
    if (!isNaN(parsed)) {
      req.body.price = parsed;
    }
  }

  if (typeof req.body.weightKg === "string") {
    const parsedWeight = parseFloat(req.body.weightKg);
    if (!isNaN(parsedWeight)) {
      req.body.weightKg = parsedWeight;
    }
  }

  if (typeof req.body.manualLotPrices === "string") {
    try {
      req.body.manualLotPrices = JSON.parse(req.body.manualLotPrices);
    } catch (e) {}
  }

  if (typeof req.body.lotPrices === "string") {
    try {
      req.body.lotPrices = JSON.parse(req.body.lotPrices);
    } catch (e) {}
  }

  next();
};