import { Router, RequestHandler } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { AppError, ErrorCode } from "../../lib/errors";
import { analyzeProductPhoto, requirePhotoAnalysisConfiguration } from "./photo-analysis.service";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

function invalidPhoto(message = "Elegí una foto válida en formato JPEG, PNG o WebP.", status = 400): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, status, message);
}

/** Identify the file signature as well as checking the client-supplied MIME. */
function imageType(bytes: Buffer): string | undefined {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0) return "image/png";
  if (bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" &&
      ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))) return "image/webp";
  return undefined;
}

const upload = multer({
  storage: multer.memoryStorage(),
  // Busboy raises partsLimit when the boundary reaches the limit (including
  // the final boundary); files/fields still restrict this to one photo only.
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) callback(invalidPhoto());
    else callback(null, true);
  },
}).single("photo");

/** A bounded, process-local limiter for this MVP; no image or key is retained. */
function createAnalysisLimiter(): RequestHandler {
  const windowMs = 60_000;
  const users = new Map<number, { expiresAt: number; count: number; active: boolean }>();
  let activeRequests = 0;

  return (req, res, next) => {
    const now = Date.now();
    for (const [id, state] of users) {
      if (state.expiresAt <= now && !state.active) users.delete(id);
    }
    const userId = req.auth!.sub;
    let state = users.get(userId);
    if (state?.active || (state && state.count >= 6) || activeRequests >= 4 || (!state && users.size >= 1000)) {
      res.setHeader("Retry-After", "60");
      return next(new AppError(ErrorCode.PHOTO_ANALYSIS_RATE_LIMIT, 429,
        "Hay demasiados análisis en curso o alcanzaste el límite. Esperá un minuto y volvé a intentar."));
    }
    if (!state) {
      state = { expiresAt: now + windowMs, count: 0, active: false };
      users.set(userId, state);
    }
    state.count++;
    state.active = true;
    activeRequests++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      state!.active = false;
      activeRequests--;
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

export function createPhotoAnalysisRouter(): Router {
  const router = Router();
  router.post("/analyze-photo", requireAuth, (_req, _res, next) => {
    try {
      requirePhotoAnalysisConfiguration();
      next();
    } catch (error) {
      next(error);
    }
  }, createAnalysisLimiter(), (req, res, next) => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        return next(error.code === "LIMIT_FILE_SIZE"
          ? invalidPhoto("La foto debe pesar como máximo 10 MB.", 413)
          : invalidPhoto("Adjuntá una sola foto en el campo photo."));
      }
      if (error) return next(error instanceof AppError ? error : invalidPhoto());
      if (!req.file) return next(invalidPhoto("Se requiere una foto."));
      if (imageType(req.file.buffer) !== req.file.mimetype) return next(invalidPhoto());
      next();
    });
  }, async (req, res, next) => {
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    res.once("close", disconnect);
    try {
      const result = await analyzeProductPhoto(req.file!, controller.signal);
      if (!res.destroyed) res.json(result);
    } catch (error) {
      if (!res.destroyed) next(error);
    } finally {
      res.removeListener("close", disconnect);
    }
  });
  return router;
}

export default createPhotoAnalysisRouter();
