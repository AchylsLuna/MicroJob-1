import { Router } from 'express';
import {
    getUserList,
    updateUserStatus,
    deleteUser,
    getPrivilegedUsers,
    createUserByAdmin,
    updateUserByAdmin,
} from '../controllers/UserController.js';
import auth from '../middleware/auth.js';
import requireAdmin from '../middleware/admin.js';

const router = Router();

router.get('/userlist', auth, requireAdmin, getUserList);
router.get('/admins', auth, requireAdmin, getPrivilegedUsers);
router.post('/', auth, requireAdmin, createUserByAdmin);
router.patch('/:userId', auth, requireAdmin, updateUserByAdmin);

// Admin actions
router.patch('/:userId/status', auth, requireAdmin, updateUserStatus);
router.delete('/:userId', auth, requireAdmin, deleteUser);


export default router;
