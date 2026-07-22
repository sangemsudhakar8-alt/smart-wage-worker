import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';

export const fetchJobs = async (req, res) => {
  try {
    const snapshot = await db.collection('jobs').orderBy('createdAt', 'desc').get();
    const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(jobs);
  } catch (error) {
    console.error('Error in fetchJobs:', error);
    return res.status(500).json({ error: 'Server error fetching jobs' });
  }
};

export const createJob = async (req, res) => {
  const { title, description, location, wage } = req.body;
  const employerId = req.user.uid;

  if (!title || !wage) {
    return res.status(400).json({ error: 'Title and wage are required' });
  }

  try {
    const jobData = {
      employerId,
      title,
      description: description || '',
      location: location || '',
      wage: Number(wage),
      status: 'open',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('jobs').add(jobData);
    
    // Convert Firestore Timestamp to string or ISO for response
    const job = { id: docRef.id, ...jobData, createdAt: new Date().toISOString() };
    return res.json(job);
  } catch (error) {
    console.error('Error in createJob:', error);
    return res.status(500).json({ error: 'Server error creating job' });
  }
};

export const deleteJob = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.uid;

  try {
    const jobRef = db.collection('jobs').doc(id);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify owner
    if (jobSnap.data().employerId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this job' });
    }

    // Run delete inside transaction or batch to clean up applications
    const batch = db.batch();
    batch.delete(jobRef);

    const appsSnap = await db.collection('applications').where('jobId', '==', id).get();
    appsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return res.json({ message: 'Deleted' });
  } catch (error) {
    console.error('Error in deleteJob:', error);
    return res.status(500).json({ error: 'Server error deleting job' });
  }
};
