import express from 'express';
import { fetchApplications, applyForJob, selectWorker, cancelApplication } from '../controllers/appController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, fetchApplications);
router.post('/', authMiddleware, applyForJob);
router.post('/:id/select', authMiddleware, selectWorker);
router.post('/:id/cancel', authMiddleware, cancelApplication);

export default router;
