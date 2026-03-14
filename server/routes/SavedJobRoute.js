import { Router } from 'express';
import auth from '../middleware/auth.js';
import { listSavedJobs, saveJob, removeSavedJob } from '../controllers/SavedJobController.js';

const router = Router();

router.get('/', auth, listSavedJobs);
router.post('/', auth, saveJob);
router.delete('/:jobId', auth, removeSavedJob);

export default router;
