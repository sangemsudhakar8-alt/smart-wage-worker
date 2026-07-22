import express from 'express';
import {
    startGeoFence,
    updateLocation,
    endGeoFence,
    getGeoFenceHistory,
} from '../controllers/geoFenceController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All geofence routes require authentication
router.post('/start',           authMiddleware, startGeoFence);
router.post('/update-location', authMiddleware, updateLocation);
router.post('/end',             authMiddleware, endGeoFence);
router.get('/history/:attendanceId', authMiddleware, getGeoFenceHistory);

export default router;
