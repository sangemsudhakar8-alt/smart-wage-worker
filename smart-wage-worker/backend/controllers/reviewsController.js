import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';
import { updateWorkerTrustScore } from '../services/trustService.js';

// ========================
// REVIEWS
// ========================
export const submitReview = async (req, res) => {
  const { workerId, jobId, rating, comment } = req.body;
  const employerId = req.user.uid;

  if (!workerId || !jobId || !rating) {
    return res.status(400).json({ error: 'workerId, jobId, and rating are required' });
  }

  try {
    // Check for duplicate review
    const duplicateSnap = await db.collection('reviews')
      .where('workerId', '==', workerId)
      .where('employerId', '==', employerId)
      .where('jobId', '==', jobId)
      .get();

    if (!duplicateSnap.empty) {
      return res.status(400).json({ error: 'Review already submitted for this job' });
    }

    const reviewData = {
      workerId,
      employerId,
      jobId,
      rating: Number(rating),
      comment: comment || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('reviews').add(reviewData);

    // Update worker trust score
    let trustResult = {};
    try {
      trustResult = await updateWorkerTrustScore(workerId);
    } catch (err) {
      console.error('Failed to update worker trust score in submitReview:', err);
    }

    // Add notification to worker
    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
      userId: workerId,
      message: `You received a ${rating}-star rating!`,
      type: 'info',
      date: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ id: docRef.id, ...reviewData, trustScore: trustResult.finalScore || null });
  } catch (error) {
    console.error('Error in submitReview:', error);
    return res.status(500).json({ error: 'Server error submitting review' });
  }
};

export const fetchReviews = async (req, res) => {
  const { workerId } = req.params;

  try {
    const snapshot = await db.collection('reviews')
      .where('workerId', '==', workerId)
      .orderBy('createdAt', 'desc')
      .get();

    const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(reviews);
  } catch (error) {
    console.error('Error in fetchReviews:', error);
    return res.status(500).json({ error: 'Server error fetching reviews' });
  }
};

// ========================
// LEAVES
// ========================
export const fetchLeaves = async (req, res) => {
  try {
    const snapshot = await db.collection('leaves').orderBy('createdAt', 'desc').get();
    const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(leaves);
  } catch (error) {
    console.error('Error in fetchLeaves:', error);
    return res.status(500).json({ error: 'Server error fetching leaves' });
  }
};

export const requestLeave = async (req, res) => {
  const { employerId, date, reason } = req.body;
  const workerId = req.user.uid;

  if (!employerId || !date) {
    return res.status(400).json({ error: 'employerId and date are required' });
  }

  try {
    const leaveData = {
      workerId,
      employerId,
      date,
      reason: reason || '',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('leaves').add(leaveData);

    // Notify Employer
    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
      userId: employerId,
      message: `A worker requested leave for ${date}.`,
      type: 'info',
      date: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ id: docRef.id, ...leaveData });
  } catch (error) {
    console.error('Error in requestLeave:', error);
    return res.status(500).json({ error: 'Server error requesting leave' });
  }
};

export const updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'
  const employerId = req.user.uid;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (approved or rejected) is required' });
  }

  try {
    const leaveRef = db.collection('leaves').doc(id);
    const leaveSnap = await leaveRef.get();

    if (!leaveSnap.exists) {
      return res.status(404).json({ error: 'Leave request not found' });
    }

    const leaveData = leaveSnap.data();
    if (leaveData.employerId !== employerId) {
      return res.status(403).json({ error: 'Forbidden: You cannot modify this leave request' });
    }

    await leaveRef.update({ status });

    // Notify Worker
    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
      userId: leaveData.workerId,
      message: `Your leave for ${leaveData.date} was ${status}.`,
      type: status === 'approved' ? 'success' : 'error',
      date: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ id, ...leaveData, status });
  } catch (error) {
    console.error('Error in updateLeaveStatus:', error);
    return res.status(500).json({ error: 'Server error updating leave status' });
  }
};
