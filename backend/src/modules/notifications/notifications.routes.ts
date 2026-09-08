import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import * as controller from "./notifications.controller";

const router = Router();

// GET /me/notifications?unreadOnly=true
router.get("/me/notifications", requireAuth, controller.listNotifications);

// POST /notifications/:id/read
router.post("/notifications/:id/read", requireAuth, controller.markAsRead);

export default router;
