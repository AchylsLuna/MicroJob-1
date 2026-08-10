import express from 'express';
import verifyToken from '../middleware/auth.js';
import {
  getProfile,
  uploadAvatar,
  uploadResume,
  deleteAvatar,
  deleteResume,
  createFileAccessLink,
  updateJobPreferences,
} from '../controllers/ProfileController.js';
import {
  getPublicProfile,
  updateMe,
  requestSelfDelete,
} from '../controllers/UserController.js';
import {
  addSkill,
  deleteSkill,
  updateSkillDescription,
  addWorkExperience,
  updateWorkExperience,
  deleteWorkExperience,
} from '../controllers/skillsController.js';
import {
  uploadAvatarFile,
  uploadResumeFile,
} from '../middleware/uploadConfig.js';
const router = express.Router();

router.get(['/profile', '/me'], verifyToken, getProfile);
router.get('/profiles/:userId', verifyToken, getPublicProfile);
router.patch(['/profile', '/me'], verifyToken, updateMe);
router.patch('/profile/job-preferences', verifyToken, updateJobPreferences);
router.post('/me/delete', verifyToken, requestSelfDelete);
router.post('/profile/avatar', verifyToken, uploadAvatarFile, uploadAvatar);
router.delete('/profile/avatar', verifyToken, deleteAvatar);
router.post('/profile/resume', verifyToken, uploadResumeFile, uploadResume);
router.delete('/profile/resume', verifyToken, deleteResume);
router.get(
  ['/files/:fileName/access-link', '/profile/files/:fileName/access-link'],
  verifyToken,
  createFileAccessLink
);
router.post('/profile/skills', verifyToken, addSkill);
router.delete('/profile/skills/:skillId', verifyToken, deleteSkill);
router.patch('/profile/skills/:skillId', verifyToken, updateSkillDescription);
router.post('/profile/experience', verifyToken, addWorkExperience);
router.patch('/profile/experience/:experienceId', verifyToken, updateWorkExperience);
router.delete('/profile/experience/:experienceId', verifyToken, deleteWorkExperience);

export default router;
