/**
 * Controlador del módulo auctions.
 * Traduce requests HTTP → service → response.
 * Sin lógica de negocio aquí — solo orquestación.
 *
 */

import { Request, Response, NextFunction } from "express";
import * as auctionsService from "./auctions.service";

// ── GET /auctions ─────────────────────────────────────────────────────────────

export async function listAuctions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctions = await auctionsService.listAuctions({
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      currency: req.query.currency as string | undefined,
      date: req.query.date as string | undefined,
    });
    res.status(200).json(auctions);
  } catch (err) {
    next(err);
  }
}

// ── GET /auctions/:id ─────────────────────────────────────────────────────────

export async function getAuction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const detail = await auctionsService.getAuctionDetail(auctionId);
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions (admin) ────────────────────────────────────────────────────

export async function createAuction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await auctionsService.createAuction(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/collection (admin / dev) ────────────────────────────────────

export async function createCollectionAuction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const responsibleId = req.auth!.sub;
    const result = await auctionsService.createCollectionAuction({
      ...req.body,
      responsibleId,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ── PATCH /auctions/:id (admin) ───────────────────────────────────────────────

export async function updateAuction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const result = await auctionsService.updateAuction(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── GET /auctions/:id/catalog ─────────────────────────────────────────────────

export async function getAuctionCatalog(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const result = await auctionsService.getAuctionCatalog(id, !!req.auth);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── GET /auctions/:id/streaming ───────────────────────────────────────────────

export async function getStreaming(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const clientId = req.auth!.sub;
    const result = await auctionsService.getStreamingUrl(auctionId, clientId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/attendees ──────────────────────────────────────────────

/**
 * Self-registro: el clientId sale del token (req.auth.sub).
 * Admin puede pasar clientId en el body para registrar a otro.
 */
export async function registerAttendee(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const isAdmin = req.auth!.roles.includes("ADMIN");
    const clientId =
      isAdmin && req.body.clientId ? req.body.clientId : req.auth!.sub;

    const attendee = await auctionsService.registerAttendee(auctionId, clientId);
    res.status(201).json(attendee);
  } catch (err) {
    next(err);
  }
}

// ── GET /auctions/:id/attendees ───────────────────────────────────────────────

export async function listAttendees(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const attendees = await auctionsService.listAttendees(auctionId);
    res.status(200).json(attendees);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/connect ────────────────────────────────────────────────

export async function connect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const clientId = req.auth!.sub;
    const session = await auctionsService.connectToAuction(auctionId, clientId);
    res.status(200).json(session);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/disconnect ─────────────────────────────────────────────

export async function disconnect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const clientId = req.auth!.sub;
    await auctionsService.disconnectFromAuction(auctionId, clientId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── GET /auctions/:id/live-status ─────────────────────────────────────────────

export async function getLiveStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const clientId = req.auth!.sub;
    const status = await auctionsService.getLiveStatus(auctionId, clientId);
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/items/:itemId/open (ADMIN) ────────────────────────────

export async function openItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const result = await auctionsService.openItem(auctionId, itemId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/items/:itemId/close (ADMIN) ───────────────────────────

export async function closeItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const result = await auctionsService.closeItem(auctionId, itemId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /auctions/:id/close (ADMIN) ─────────────────────────────────────────

export async function closeAuction(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auctionId = Number(req.params.id);
    const result = await auctionsService.closeAuction(auctionId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
