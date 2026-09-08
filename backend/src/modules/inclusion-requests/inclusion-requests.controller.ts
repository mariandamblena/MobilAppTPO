import { Request, Response, NextFunction } from "express";
import * as service from "./inclusion-requests.service";

export async function createInclusionRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const request = await service.createInclusionRequest({
      ownerId: req.owner!.id,
      productId: req.body.productId,
      itemDescription: req.body.itemDescription,
      ownershipDeclared: req.body.ownershipDeclared,
      legalityDeclared: req.body.legalityDeclared,
    });
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

export async function listInclusionRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isAdmin = req.auth?.roles.includes("ADMIN") ?? false;
    // listInclusionRequestsSchema (validate) ya transformó ownerId a number | undefined.
    const queryOwnerId = (req.query as { ownerId?: number }).ownerId;
    const ownerId = isAdmin ? queryOwnerId ?? req.owner!.id : req.owner!.id;

    const requests = await service.listInclusionRequests({
      ownerId,
      status: req.query.status as string | undefined,
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function getInclusionRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isAdmin = req.auth?.roles.includes("ADMIN") ?? false;
    const request = await service.getInclusionRequest(
      Number(req.params.id),
      req.owner!.id,
      isAdmin
    );
    res.json(request);
  } catch (err) {
    next(err);
  }
}

export async function adminInspect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updated = await service.adminInspect(
      Number(req.params.id),
      req.body,
      req.auth!.sub
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function ownerResponse(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updated = await service.ownerResponse(
      Number(req.params.id),
      req.owner!.id,
      req.body.accepted
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
