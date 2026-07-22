import express from 'express';
import { fetchJobs, createJob, deleteJob } from '../controllers/jobController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, fetchJobs);
router.post('/', authMiddleware, createJob);
router.delete('/:id', authMiddleware, deleteJob);

export default router;
