import express from 'express';
import { 
    getCategoryList, 
    createCategory, 
    editCategory, 
    deleteCategory 
} from '../controllers/CategoryController.js';
import verifyToken from '../middleware/auth.js'; 
import requireAdmin from '../middleware/admin.js';

const router = express.Router();

router.get('/', getCategoryList);

router.post('/', verifyToken, requireAdmin, createCategory);
router.put('/:id', verifyToken, requireAdmin, editCategory);
router.delete('/:id', verifyToken, requireAdmin, deleteCategory);

export default router;
