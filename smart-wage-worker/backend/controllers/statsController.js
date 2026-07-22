import { db } from '../config/firebaseAdmin.js';
import admin from 'firebase-admin';

export const getUserStats = async (req, res) => {
  const userId = req.params.id || req.user.uid;

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = { id: userDoc.id, ...userDoc.data() };

    if (user.role === 'worker') {
      const attSnap = await db.collection('attendance')
        .where('workerId', '==', userId)
        .where('present', '==', true)
        .get();

      // Calculate last 7 days dates (YYYY-MM-DD)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      // Gather unique job IDs from attendance to optimize DB reads
      const uniqueJobIds = [...new Set(attSnap.docs.map(d => d.data().jobId))].filter(Boolean);
      
      // Load all job details concurrently
      const jobWagesMap = {};
      if (uniqueJobIds.length > 0) {
        const jobRefs = uniqueJobIds.map(id => db.collection('jobs').doc(id));
        // Firestore db.getAll reads multiple documents in a single call
        const jobDocs = await db.getAll(...jobRefs);
        jobDocs.forEach(docSnap => {
          if (docSnap.exists) {
            jobWagesMap[docSnap.id] = Number(docSnap.data().wage || 0);
          }
        });
      }

      let totalEarnings = 0;
      const earningsHistory = last7Days.map(date => {
        // Filter attendance records matching this date
        const dayAtts = attSnap.docs.filter(doc => doc.data().date === date);
        let dayTotal = 0;

        dayAtts.forEach(attDoc => {
          const wage = jobWagesMap[attDoc.data().jobId] || 0;
          dayTotal += wage;
        });

        totalEarnings += dayTotal;

        return {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          amount: dayTotal
        };
      });

      // Also compute lifetime total earnings from all attendance records
      let lifetimeEarnings = 0;
      attSnap.docs.forEach(attDoc => {
        const wage = jobWagesMap[attDoc.data().jobId] || 0;
        lifetimeEarnings += wage;
      });

      user.totalEarnings = lifetimeEarnings; // keep consistent with client requirements
      user.daysWorked = attSnap.size;
      user.earningsHistory = earningsHistory;
    }

    return res.json(user);
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return res.status(500).json({ error: 'Server error compiling user stats' });
  }
};

export const fetchNotifications = async (req, res) => {
  const userId = req.user.uid;

  try {
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(notifs);
  } catch (error) {
    console.error('Error in fetchNotifications:', error);
    return res.status(500).json({ error: 'Server error fetching notifications' });
  }
};

export const createNotification = async (req, res) => {
  const { userId, message, type } = req.body;
  if (!userId || !message) {
    return res.status(400).json({ error: 'userId and message are required' });
  }
  try {
    const notifRef = db.collection('notifications').doc();
    const notifData = {
      userId,
      message,
      type: type || 'info',
      date: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await notifRef.set(notifData);
    return res.json({ id: notifRef.id, ...notifData });
  } catch (error) {
    console.error('Error in createNotification:', error);
    return res.status(500).json({ error: 'Server error creating notification' });
  }
};
