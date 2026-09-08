import { Request, Response, NextFunction } from "express";
import * as service from "./notifications.service";

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const unreadOnly = req.query.unreadOnly === "true";
    const result = await service.listNotifications(req.auth!.sub, unreadOnly);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await service.markAsRead(Number(req.params.id), req.auth!.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
