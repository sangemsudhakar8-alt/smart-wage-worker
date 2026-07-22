import express from 'express';
import { fetchLeaves, requestLeave, updateLeaveStatus } from '../controllers/reviewsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, fetchLeaves);
router.post('/', authMiddleware, requestLeave);
router.put('/:id', authMiddleware, updateLeaveStatus);

export default router;
