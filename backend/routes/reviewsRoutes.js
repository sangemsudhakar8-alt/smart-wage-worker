import express from 'express';
import { submitReview, fetchReviews } from '../controllers/reviewsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.post('/', authMiddleware, submitReview);
router.get('/:workerId', authMiddleware, fetchReviews);

export default router;
