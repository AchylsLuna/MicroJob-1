import { Router } from 'express';
import {
    register,
    login,
    logout,
    getUserList,
    sendOtp,
    verifyOtp,
    updateUserStatus,
    deleteUser,
} from '../controllers/UserController.js';
import auth from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', auth, logout);
router.get('/userlist', auth, requireAdmin, getUserList);
router.post('/otp/send', sendOtp);
router.post('/otp/verify', verifyOtp);

// Admin actions
router.patch('/:userId/status', auth, requireAdmin, updateUserStatus);
router.delete('/:userId', auth, requireAdmin, deleteUser);


export default router;
