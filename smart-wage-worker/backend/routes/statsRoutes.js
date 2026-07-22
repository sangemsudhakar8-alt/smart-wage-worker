import express from 'express';
import { getUserStats, fetchNotifications, createNotification } from '../controllers/statsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/users/:id/stats', authMiddleware, getUserStats);
router.get('/notifications', authMiddleware, fetchNotifications);
router.post('/notifications', authMiddleware, createNotification);

export default router;

