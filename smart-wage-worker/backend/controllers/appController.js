import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';

// Helper to enrich a single application document
const enrichApplicationData = async (appDoc) => {
  const app = { id: appDoc.id, ...appDoc.data() };
  
  // Fetch worker details
  const workerSnap = await db.collection('users').doc(app.workerId).get();
  if (workerSnap.exists) {
    const worker = workerSnap.data();
    app.workerName = worker.name;
    app.workerSkills = worker.skills;
    app.workerTrustScore = worker.trustScore;
    app.workerPhone = worker.phone;
    app.workerCompletedJobs = worker.completedJobs || 0;
    
    // Calculate rating
    const revSnap = await db.collection('reviews').where('workerId', '==', app.workerId).get();
    if (!revSnap.empty) {
      const total = revSnap.docs.reduce((sum, r) => sum + Number(r.data().rating || 0), 0);
      app.workerRating = (total / revSnap.size).toFixed(1);
    } else {
      app.workerRating = "5.0";
    }
  }

  // Fetch Job details
  const jobSnap = await db.collection('jobs').doc(app.jobId).get();
  if (jobSnap.exists) {
    const jobData = jobSnap.data();
    app.jobTitle = jobData.title;

    // Attach Employer Phone if selected (for worker view)
    if (app.status === 'selected' && jobData.employerId) {
      const employerSnap = await db.collection('users').doc(jobData.employerId).get();
      if (employerSnap.exists) {
        app.employerPhone = employerSnap.data().phone;
      }
    }
  }

  return app;
};

export const fetchApplications = async (req, res) => {
  const userId = req.user.uid;

  try {
    // Determine user's role to only fetch authorized applications
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userSnap.data();
    let appsSnap;

    if (userData.role === 'worker') {
      appsSnap = await db.collection('applications').where('workerId', '==', userId).get();
    } else {
      // Employer: fetch all applications for jobs posted by this employer
      const jobsSnap = await db.collection('jobs').where('employerId', '==', userId).get();
      const jobIds = jobsSnap.docs.map(doc => doc.id);

      if (jobIds.length === 0) {
        return res.json([]);
      }

      // Firestore limits 'in' queries to 30 items. We batch if needed.
      // But since we want to be safe, we can fetch all applications and filter, or fetch in chunks.
      // For standard usage, chunking or where-in is fine. Let's do chunking or filter.
      appsSnap = await db.collection('applications').get();
    }

    const apps = [];
    for (const doc of appsSnap.docs) {
      const appData = doc.data();
      if (userData.role === 'worker' && appData.workerId !== userId) continue;
      
      // If employer, check if the jobId belongs to one of their jobs
      if (userData.role === 'employer') {
        const jobSnap = await db.collection('jobs').doc(appData.jobId).get();
        if (!jobSnap.exists || jobSnap.data().employerId !== userId) {
          continue;
        }
      }

      const enriched = await enrichApplicationData(doc);
      apps.push(enriched);
    }

    return res.json(apps);
  } catch (error) {
    console.error('Error in fetchApplications:', error);
    return res.status(500).json({ error: 'Server error fetching applications' });
  }
};

export const applyForJob = async (req, res) => {
  const { jobId } = req.body;
  const workerId = req.user.uid;

  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    // Check if job exists
    const jobSnap = await db.collection('jobs').doc(jobId).get();
    if (!jobSnap.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const jobData = jobSnap.data();

    // Check if already applied
    const existingSnap = await db.collection('applications')
      .where('jobId', '==', jobId)
      .where('workerId', '==', workerId)
      .get();

    if (!existingSnap.empty) {
      return res.status(400).json({ error: 'Already applied for this job' });
    }

    const appData = {
      jobId,
      workerId,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('applications').add(appData);

    // Notify Employer
    const notifRef = db.collection('notifications').doc();
    await notifRef.set({
      userId: jobData.employerId,
      message: `A new worker applied for ${jobData.title}`,
      type: 'info',
      date: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ id: docRef.id, ...appData });
  } catch (error) {
    console.error('Error in applyForJob:', error);
    return res.status(500).json({ error: 'Server error applying for job' });
  }
};

export const selectWorker = async (req, res) => {
  const { id } = req.params; // applicationId
  const employerId = req.user.uid;

  try {
    await db.runTransaction(async (transaction) => {
      const appRef = db.collection('applications').doc(id);
      const appSnap = await transaction.get(appRef);

      if (!appSnap.exists) {
        throw new Error('Application not found');
      }

      const appData = appSnap.data();
      const { jobId, workerId } = appData;

      const jobRef = db.collection('jobs').doc(jobId);
      const jobSnap = await transaction.get(jobRef);

      if (!jobSnap.exists) {
        throw new Error('Job not found');
      }

      const jobData = jobSnap.data();
      if (jobData.employerId !== employerId) {
        throw new Error('Forbidden: You are not the employer of this job');
      }

      if (jobData.status !== 'open') {
        throw new Error('Job is already closed');
      }

      // Fetch all applications for this job
      const appsSnap = await db.collection('applications').where('jobId', '==', jobId).get();

      // Update current application to selected, others to rejected
      appsSnap.docs.forEach((doc) => {
        const status = doc.id === id ? 'selected' : 'rejected';
        transaction.update(doc.ref, { status });

        // Add notification for worker
        const workerNotifRef = db.collection('notifications').doc();
        const msg = status === 'selected' 
          ? `You were SELECTED for ${jobData.title}!` 
          : `Application for ${jobData.title} was rejected.`;
        const type = status === 'selected' ? 'success' : 'error';
        
        transaction.set(workerNotifRef, {
          userId: doc.data().workerId,
          message: msg,
          type,
          date: new Date().toISOString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      // Update job status to closed
      transaction.update(jobRef, { status: 'closed' });
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in selectWorker:', error);
    return res.status(500).json({ error: error.message || 'Server error selecting worker' });
  }
};

export const cancelApplication = async (req, res) => {
  const { id } = req.params;
  const workerId = req.user.uid;

  try {
    const appRef = db.collection('applications').doc(id);
    const appSnap = await appRef.get();

    if (!appSnap.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const appData = appSnap.data();
    if (appData.workerId !== workerId) {
      return res.status(403).json({ error: 'Forbidden: You cannot cancel this application' });
    }

    await appRef.update({ status: 'cancelled' });

    // Notify Employer
    const jobSnap = await db.collection('jobs').doc(appData.jobId).get();
    if (jobSnap.exists) {
      const jobData = jobSnap.data();
      const notifRef = db.collection('notifications').doc();
      await notifRef.set({
        userId: jobData.employerId,
        message: `A worker cancelled their application for ${jobData.title}.`,
        type: 'error',
        date: new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error in cancelApplication:', error);
    return res.status(500).json({ error: 'Server error cancelling application' });
  }
};
