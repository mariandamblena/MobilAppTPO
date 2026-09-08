import { Request, Response, NextFunction } from "express";
import * as insuranceService from "./insurance.service";

export async function getInsurance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await insuranceService.getInsurance(req.params.policyNumber, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function increaseCoverage(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await insuranceService.increaseCoverage(
      req.params.policyNumber,
      req.body,
      req.auth!
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProductLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await insuranceService.getProductLocation(id, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPayoutAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const ownerId = parseInt(req.params.id, 10);
    const result = await insuranceService.getPayoutAccounts(ownerId, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createPayoutAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const ownerId = parseInt(req.params.id, 10);
    const result = await insuranceService.createPayoutAccount(ownerId, req.body, req.auth!);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
