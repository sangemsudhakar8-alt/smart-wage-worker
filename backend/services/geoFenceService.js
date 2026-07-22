import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';

/**
 * Haversine Formula — calculates the great-circle distance between two
 * points on a sphere given their latitudes and longitudes.
 *
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lon1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lon2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in meters
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const EARTH_RADIUS_M = 6_371_000; // metres

    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return parseFloat((EARTH_RADIUS_M * c).toFixed(2));
};

/**
 * Checks whether the given coordinates are within the permitted radius.
 *
 * @param {number} jobLat    - Job-site latitude
 * @param {number} jobLon    - Job-site longitude
 * @param {number} workerLat - Worker latitude
 * @param {number} workerLon - Worker longitude
 * @param {number} radius    - Allowed radius in metres (default 100 m)
 * @returns {{ distance: number, insideRadius: boolean }}
 */
export const validateRadius = (jobLat, jobLon, workerLat, workerLon, radius = 100) => {
    const distance = haversineDistance(jobLat, jobLon, workerLat, workerLon);
    return {
        distance,
        insideRadius: distance <= radius,
    };
};

/**
 * Writes one log entry to the `geoFenceLogs` Firestore collection.
 */
export const writeGeoFenceLog = async (logData) => {
    const { attendanceId, workerId, jobId, latitude, longitude, distance, insideRadius } = logData;

    const logRef = db.collection('geoFenceLogs').doc();
    await logRef.set({
        attendanceId,
        workerId,
        jobId,
        latitude,
        longitude,
        distance,
        insideRadius,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return logRef.id;
};

/**
 * Determines whether a state-transition has occurred (inside ↔ outside).
 *
 * @param {string|null} previousStatus - Previous attendance status field
 * @param {boolean}     insideNow      - Current geofence result
 * @returns {'entered' | 'exited' | 'no_change'}
 */
export const detectStateTransition = (previousStatus, insideNow) => {
    const wasOutside = previousStatus === 'Outside Radius';
    const wasActive  = previousStatus === 'Active' || previousStatus === 'started';

    if (insideNow && wasOutside) return 'entered';
    if (!insideNow && wasActive)  return 'exited';
    return 'no_change';
};

/**
 * Updates the attendance document's geofence-related fields.
 *
 * @param {string} attendanceId    - Document ID in the `attendance` collection
 * @param {object} fields          - Partial fields to merge
 */
export const updateAttendanceGeoFields = async (attendanceId, fields) => {
    const attRef = db.collection('attendance').doc(attendanceId);
    await attRef.set(fields, { merge: true });
};

/**
 * Writes an in-app notification.
 *
 * @param {string} userId   - Recipient user ID
 * @param {string} message  - Notification body
 * @param {string} type     - 'info' | 'success' | 'error' | 'warning'
 */
export const writeNotification = async (userId, message, type = 'info') => {
    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
        userId,
        message,
        type,
        date: new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};
