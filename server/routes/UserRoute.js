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
import requireAdmin, { requirePermission } from '../middleware/admin.js';

const router = Router();

router.get('/userlist', auth, requireAdmin, requirePermission('users.view'), getUserList);
router.get('/admins', auth, requireAdmin, requirePermission('staff.view'), getPrivilegedUsers);
router.post('/', auth, requireAdmin, requirePermission('users.suspend'), createUserByAdmin);
router.patch('/:userId', auth, requireAdmin, requirePermission('users.suspend'), updateUserByAdmin);

// `users.suspend` is the matrix's write-access permission for marketplace
// users, matching `canWriteUsers` in AdminUserManagement.tsx. Privileged
// targets stay superadmin-only via lib/adminUserPolicy.js.
router.patch('/:userId/status', auth, requireAdmin, requirePermission('users.suspend'), updateUserStatus);
router.delete('/:userId', auth, requireAdmin, requirePermission('users.suspend'), deleteUser);


export default router;
