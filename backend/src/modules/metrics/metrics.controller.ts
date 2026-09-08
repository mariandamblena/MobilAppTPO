import { Request, Response, NextFunction } from "express";
import * as service from "./metrics.service";

export async function getMyMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await service.computeMetrics(req.auth!.sub);
    res.json(metrics);
  } catch (err) {
    next(err);
  }
}

export async function getClientMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await service.computeMetrics(Number(req.params.id));
    res.json(metrics);
  } catch (err) {
    next(err);
  }
}
