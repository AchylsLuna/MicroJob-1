import express from 'express';
import { 
    getCategoryList, 
    createCategory, 
    editCategory, 
    deleteCategory 
} from '../controllers/CategoryController.js';
import verifyToken from '../middleware/auth.js'; 
import requireAdmin, { requireSuperadmin } from '../middleware/admin.js';

const router = express.Router();

router.get('/', getCategoryList);

router.post('/', verifyToken, requireAdmin, requireSuperadmin, createCategory);
router.put('/:id', verifyToken, requireAdmin, requireSuperadmin, editCategory);
router.delete('/:id', verifyToken, requireAdmin, requireSuperadmin, deleteCategory);

export default router;
