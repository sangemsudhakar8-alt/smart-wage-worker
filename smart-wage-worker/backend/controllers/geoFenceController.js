import { db } from '../config/firebaseAdmin.js';
import {
    validateRadius,
    writeGeoFenceLog,
    detectStateTransition,
    updateAttendanceGeoFields,
    writeNotification,
} from '../services/geoFenceService.js';
import { isValidCoordinate } from '../utils/geoValidator.js';

// ─────────────────────────────────────────────────────────
// POST /api/geofence/start
// Body: { attendanceId, jobId, latitude, longitude }
// ─────────────────────────────────────────────────────────
export const startGeoFence = async (req, res) => {
    const workerId = req.user.uid;
    const { attendanceId, jobId, latitude, longitude } = req.body;

    if (!attendanceId || !jobId || latitude == null || longitude == null) {
        return res.status(400).json({
            error: 'attendanceId, jobId, latitude and longitude are required.',
        });
    }

    if (!isValidCoordinate(latitude, longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates provided.' });
    }

    // Security check: Verify the worker owns this attendance record
    if (!attendanceId.startsWith(workerId)) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another worker\'s attendance record.' });
    }

    try {
        // Fetch job to get site coordinates and radius
        const jobSnap = await db.collection('jobs').doc(jobId).get();
        if (!jobSnap.exists) {
            return res.status(404).json({ error: 'Job not found.' });
        }

        const job = jobSnap.data();
        const radius = Number(job.radius) || 100;

        let insideRadius = true;
        let distance = 0;

        // Only compute if the job has site coordinates
        if (job.lat != null && job.lng != null) {
            ({ distance, insideRadius } = validateRadius(
                job.lat, job.lng,
                Number(latitude), Number(longitude),
                radius
            ));
        }

        // Set attendance to Active and initialise geofence fields
        await updateAttendanceGeoFields(attendanceId, {
            status: insideRadius ? 'Active' : 'Outside Radius',
            violationCount: 0,
            lastKnownLocation: {
                lat: Number(latitude),
                lng: Number(longitude),
                updatedAt: new Date().toISOString(),
            },
        });

        // Write first log entry
        await writeGeoFenceLog({
            attendanceId,
            workerId,
            jobId,
            latitude: Number(latitude),
            longitude: Number(longitude),
            distance,
            insideRadius,
        });

        return res.json({
            success: true,
            insideRadius,
            distance,
            radius,
            status: insideRadius ? 'Active' : 'Outside Radius',
        });
    } catch (err) {
        console.error('[geoFenceController] startGeoFence error:', err);
        return res.status(500).json({ error: 'Server error starting geofence session.' });
    }
};

// ─────────────────────────────────────────────────────────
// POST /api/geofence/update-location
// Body: { attendanceId, latitude, longitude }
// ─────────────────────────────────────────────────────────
export const updateLocation = async (req, res) => {
    const workerId = req.user.uid;
    const { attendanceId, latitude, longitude } = req.body;

    if (!attendanceId || latitude == null || longitude == null) {
        return res.status(400).json({
            error: 'attendanceId, latitude and longitude are required.',
        });
    }

    if (!isValidCoordinate(latitude, longitude)) {
        return res.status(400).json({ error: 'Invalid coordinates provided.' });
    }

    try {
        // Fetch attendance document
        const attRef  = db.collection('attendance').doc(attendanceId);
        const attSnap = await attRef.get();

        if (!attSnap.exists) {
            return res.status(404).json({ error: 'Attendance record not found.' });
        }

        const att = attSnap.data();

        // Security: only the worker who owns this record may update it
        if (att.workerId !== workerId) {
            return res.status(403).json({ error: 'Forbidden: you do not own this attendance record.' });
        }

        // Fetch the related job for site coords + radius
        const jobSnap = await db.collection('jobs').doc(att.jobId).get();
        if (!jobSnap.exists) {
            return res.status(404).json({ error: 'Associated job not found.' });
        }

        const job    = jobSnap.data();
        const radius = Number(job.radius) || 100;

        // Default to inside if site coords are not available
        let distance    = 0;
        let insideRadius = true;

        if (job.lat != null && job.lng != null) {
            ({ distance, insideRadius } = validateRadius(
                job.lat, job.lng,
                Number(latitude), Number(longitude),
                radius
            ));
        }

        const previousStatus = att.status;
        const transition     = detectStateTransition(previousStatus, insideRadius);

        // Build update payload
        const attUpdate = {
            lastKnownLocation: {
                lat: Number(latitude),
                lng: Number(longitude),
                updatedAt: new Date().toISOString(),
            },
        };

        // Handle state transitions
        if (transition === 'exited') {
            attUpdate.status         = 'Outside Radius';
            attUpdate.violationCount = (att.violationCount || 0) + 1;

            // Notify employer
            const workerSnap = await db.collection('users').doc(workerId).get();
            const workerName = workerSnap.exists ? workerSnap.data().name : 'A worker';

            await writeNotification(
                job.employerId,
                `⚠️ ${workerName} has left the work zone for "${job.title}". (${Math.round(distance)} m away)`,
                'error'
            );
        } else if (transition === 'entered') {
            attUpdate.status = 'Active';

            const workerSnap = await db.collection('users').doc(workerId).get();
            const workerName = workerSnap.exists ? workerSnap.data().name : 'A worker';

            await writeNotification(
                job.employerId,
                `✅ ${workerName} has returned to the work zone for "${job.title}".`,
                'success'
            );
        }

        // Persist attendance update
        await attRef.set(attUpdate, { merge: true });

        // Write geo-fence log — log every update, not only violations
        await writeGeoFenceLog({
            attendanceId,
            workerId,
            jobId: att.jobId,
            latitude: Number(latitude),
            longitude: Number(longitude),
            distance,
            insideRadius,
        });

        return res.json({
            success: true,
            insideRadius,
            distance,
            radius,
            status: attUpdate.status || previousStatus,
            violationCount: attUpdate.violationCount ?? att.violationCount ?? 0,
            transition,
        });
    } catch (err) {
        console.error('[geoFenceController] updateLocation error:', err);
        return res.status(500).json({ error: 'Server error processing location update.' });
    }
};

// ─────────────────────────────────────────────────────────
// POST /api/geofence/end
// Body: { attendanceId }
// ─────────────────────────────────────────────────────────
export const endGeoFence = async (req, res) => {
    const workerId    = req.user.uid;
    const { attendanceId } = req.body;

    if (!attendanceId) {
        return res.status(400).json({ error: 'attendanceId is required.' });
    }

    try {
        const attRef  = db.collection('attendance').doc(attendanceId);
        const attSnap = await attRef.get();

        if (!attSnap.exists) {
            return res.status(404).json({ error: 'Attendance record not found.' });
        }

        if (attSnap.data().workerId !== workerId) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        await attRef.set({ status: 'Completed' }, { merge: true });

        return res.json({ success: true, status: 'Completed' });
    } catch (err) {
        console.error('[geoFenceController] endGeoFence error:', err);
        return res.status(500).json({ error: 'Server error ending geofence session.' });
    }
};

// ─────────────────────────────────────────────────────────
// GET /api/geofence/history/:attendanceId
// ─────────────────────────────────────────────────────────
export const getGeoFenceHistory = async (req, res) => {
    const { attendanceId } = req.params;

    if (!attendanceId) {
        return res.status(400).json({ error: 'attendanceId param is required.' });
    }

    try {
        const logsSnap = await db
            .collection('geoFenceLogs')
            .where('attendanceId', '==', attendanceId)
            .orderBy('timestamp', 'desc')
            .get();

        const logs = logsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        return res.json(logs);
    } catch (err) {
        console.error('[geoFenceController] getGeoFenceHistory error:', err);
        return res.status(500).json({ error: 'Server error fetching geofence history.' });
    }
};
