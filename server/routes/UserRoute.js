import { Router } from 'express';
import {
    register,
    login,
    logout,
    getUserList,
    getMe,
    updateMe,
    sendOtp,
    verifyOtp,
    updateUserStatus,
    deleteUser,
    getAdminUsers,
} from '../controllers/UserController.js';
import auth from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/userlist', auth, requireAdmin, getUserList);
router.get('/admins', auth, getAdminUsers);
router.get('/me', auth, getMe);
router.patch('/me', auth, updateMe);
// Backwards-compatible profile alias (mobile/web)
router.get('/profile', auth, getMe);
router.patch('/profile', auth, updateMe);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);

// Admin actions
router.patch('/:userId/status', auth, requireAdmin, updateUserStatus);
router.delete('/:userId', auth, requireAdmin, deleteUser);


export default router;
