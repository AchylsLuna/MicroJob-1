import { Router } from "express";
import auth from "../middleware/auth.js";
import { listAlerts, updateAlertStatus, deleteAlert } from "../controllers/AlertController.js";

const router = Router();

router.get("/", auth, listAlerts);
router.patch("/:alertId/status", auth, updateAlertStatus);
router.delete("/:alertId", auth, deleteAlert);

export default router;
