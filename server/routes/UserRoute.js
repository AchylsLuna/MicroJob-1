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
import { requireAdminPermission } from '../middleware/adminPermission.js';

const router = Router();

router.get('/userlist', auth, requireAdmin, requireAdminPermission('users.view'), getUserList);
router.get('/admins', auth, requireAdmin, requireAdminPermission('staff.view'), getPrivilegedUsers);
router.post('/', auth, requireAdmin, requireAdminPermission('admin.dashboard'), createUserByAdmin);
router.patch('/:userId', auth, requireAdmin, requireAdminPermission('users.suspend'), updateUserByAdmin);

// Admin actions
router.patch('/:userId/status', auth, requireAdmin, requireAdminPermission('users.suspend'), updateUserStatus);
router.delete('/:userId', auth, requireAdmin, requireAdminPermission('users.ban'), deleteUser);


export default router;
