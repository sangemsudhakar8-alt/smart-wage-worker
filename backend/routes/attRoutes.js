import express from 'express';
import { markAttendance, fetchAttendance, updateLiveLocation, fetchActiveLocations } from '../controllers/attController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, fetchAttendance);
router.post('/', authMiddleware, markAttendance);
router.put('/location', authMiddleware, updateLiveLocation);
router.get('/active-locations', authMiddleware, fetchActiveLocations);

export default router;
