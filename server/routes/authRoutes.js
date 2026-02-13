import express from "express";
import {
  getMe,
  login,
  logout,
  register,
  sendOtp,
  updateMe,
  verifyOtp,
} from "../controllers/UserController.js";
import verifyToken from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "auth-register",
});
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: "auth-login",
});
const otpSendRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 8,
  prefix: "auth-otp-send",
});
const otpVerifyRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  prefix: "auth-otp-verify",
});

// Keep /api/auth paths for backwards compatibility, but share controller logic with /api/users.
router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/logout", verifyToken, logout);
router.post("/otp/send", otpSendRateLimiter, sendOtp);
router.post("/otp/verify", otpVerifyRateLimiter, verifyOtp);
router.get("/me", verifyToken, getMe);
router.patch("/me", verifyToken, updateMe);
router.get("/profile", verifyToken, getMe);
router.patch("/profile", verifyToken, updateMe);

export default router;
