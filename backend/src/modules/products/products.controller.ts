import { Request, Response, NextFunction } from "express";
import path from "path";
import * as productsService from "./products.service";

export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const product = await productsService.createProduct({
      ownerId: req.owner!.id,
      fullDescription: req.body.fullDescription,
      catalogDescription: req.body.catalogDescription,
      date: req.body.date,
      pieceCount: req.body.pieceCount,
      artist: req.body.artist,
      historicalDate: req.body.historicalDate,
      history: req.body.history,
    });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

export async function addPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Se requiere una foto" });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    const photoUrl = `${baseUrl}/${relativePath}`;

    const photo = await productsService.addPhoto(
      Number(req.params.id),
      req.owner!.id,
      photoUrl
    );
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
}

export async function listProducts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isAdmin = req.auth?.roles.includes("ADMIN") ?? false;

    // OWNER solo puede ver los suyos; ADMIN puede filtrar por ownerId
    const ownerIdRaw = req.query.ownerId;
    const ownerId = isAdmin
      ? ownerIdRaw !== undefined ? Number(ownerIdRaw) : undefined
      : req.owner!.id;

    const availableRaw = req.query.available;
    const available = availableRaw !== undefined
      ? (availableRaw as string) === "true"
      : undefined;

    const products = await productsService.listProducts({
      ownerId,
      available,
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
}

/** GET /products/:id — detalle de producto con fotos, location e insuranceDetail. optionalAuth. */
export async function getProductDetail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.id, 10);
    const product = await productsService.getProductDetail(productId);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/** PATCH /products/:id — actualiza producto. Requiere JWT; solo dueño o admin. */
export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const productId = parseInt(req.params.id, 10);
    const callerId = req.auth!.sub;
    const isAdmin = req.auth!.roles.includes("ADMIN");

    const product = await productsService.updateProduct(productId, callerId, isAdmin, {
      date: req.body.date,
      available: req.body.available,
      catalogDescription: req.body.catalogDescription,
      fullDescription: req.body.fullDescription,
      reviewerId: req.body.reviewerId,
      insurancePolicy: req.body.insurancePolicy,
      pieceCount: req.body.pieceCount,
      artist: req.body.artist,
      historicalDate: req.body.historicalDate,
      history: req.body.history,
    });

    res.json(product);
  } catch (err) {
    next(err);
  }
}
