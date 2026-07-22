import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';
import { updateWorkerTrustScore } from '../services/trustService.js';

export const markAttendance = async (req, res) => {
  const { jobId, date, type, photoURL } = req.body;
  const workerId = req.user.uid;

  if (!jobId || !date || !type) {
    return res.status(400).json({ error: 'Missing required parameters: jobId, date, type' });
  }

  const attendanceId = `${workerId}_${jobId}_${date}`;

  try {
    const attRef = db.collection('attendance').doc(attendanceId);
    
    const updateData = {
      jobId,
      workerId,
      date,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (type === 'start') {
      updateData.startTime = new Date().toISOString();
      updateData.startImage = photoURL || '';
      updateData.present = true;
      updateData.status = 'started';
      updateData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (type === 'end') {
      updateData.endTime = new Date().toISOString();
      updateData.endImage = photoURL || '';
      updateData.status = 'completed';
    }

    await attRef.set(updateData, { merge: true });

    // Trigger trust score update asynchronously
    let trustResult = {};
    try {
      trustResult = await updateWorkerTrustScore(workerId);
    } catch (err) {
      console.error('Failed to update worker trust score in markAttendance:', err);
    }

    return res.json({ success: true, id: attendanceId, trustScore: trustResult.finalScore || null });
  } catch (error) {
    console.error('Error in markAttendance:', error);
    return res.status(500).json({ error: 'Server error marking attendance' });
  }
};

export const fetchAttendance = async (req, res) => {
  try {
    const snapshot = await db.collection('attendance').orderBy('updatedAt', 'desc').get();
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(records);
  } catch (error) {
    console.error('Error in fetchAttendance:', error);
    return res.status(500).json({ error: 'Server error fetching attendance' });
  }
};

export const updateLiveLocation = async (req, res) => {
  const workerId = req.user.uid;
  const { lat, lng } = req.body;

  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Coordinates lat and lng are required' });
  }

  try {
    // 1. Update live location in users collection
    const userRef = db.collection('users').doc(workerId);
    await userRef.update({
      currentLocation: {
        lat: Number(lat),
        lng: Number(lng),
        updatedAt: new Date().toISOString()
      }
    });

    // 2. Also update in worker_locations collection (used by maps subscription in client)
    const locRef = db.collection('worker_locations').doc(workerId);
    await locRef.set({
      lat: Number(lat),
      lng: Number(lng),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in updateLiveLocation:', error);
    return res.status(500).json({ error: 'Server error updating location' });
  }
};

export const fetchActiveLocations = async (req, res) => {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'worker').get();
    const locations = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.currentLocation || u.isPermanentlyOnline);
      
    return res.json(locations);
  } catch (error) {
    console.error('Error in fetchActiveLocations:', error);
    return res.status(500).json({ error: 'Server error fetching active locations' });
  }
};
