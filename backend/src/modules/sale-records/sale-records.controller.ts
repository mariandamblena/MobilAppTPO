import { Request, Response, NextFunction } from "express";
import * as saleRecordsService from "./sale-records.service";

export async function getSaleRecordById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await saleRecordsService.getSaleRecordById(id, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSaleRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      auctionId: req.query.auctionId ? parseInt(req.query.auctionId as string, 10) : undefined,
      clientId: req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined,
      ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string, 10) : undefined,
    };
    const result = await saleRecordsService.getSaleRecords(filters, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createSaleRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await saleRecordsService.createSaleRecord(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateShipping(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await saleRecordsService.updateShipping(id, req.body, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function paySaleRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await saleRecordsService.paySaleRecord(id, req.body, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
