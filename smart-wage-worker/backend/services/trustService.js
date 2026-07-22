import { db } from '../config/firebaseAdmin.js';

/**
 * Recalculates the trust score and badges for a worker based on:
 * 1. Attendance Rate (40%)
 * 2. Hired Jobs Count (30%)
 * 3. Ratings Average (30%)
 * 
 * Also awards badges for milestones.
 * 
 * @param {string} workerId - The worker's unique ID
 * @returns {Promise<{finalScore: number, newBadges: Array<string>}>}
 */
export const updateWorkerTrustScore = async (workerId) => {
  const workerRef = db.collection('users').doc(workerId);
  const workerSnap = await workerRef.get();
  
  if (!workerSnap.exists) {
    throw new Error('Worker user not found');
  }

  const workerData = workerSnap.data();

  // Run all queries concurrently
  const [attSnap, revSnap, appSnap] = await Promise.all([
    db.collection('attendance').where('workerId', '==', workerId).get(),
    db.collection('reviews').where('workerId', '==', workerId).get(),
    db.collection('applications').where('workerId', '==', workerId).where('status', '==', 'selected').get()
  ]);

  // 1. Attendance Rate (40%)
  let attScore = 40;
  if (!attSnap.empty) {
    const total = attSnap.docs.length;
    const present = attSnap.docs.filter(doc => doc.data().present).length;
    attScore = (present / total) * 40;
  }

  // 2. Completed/Hired Jobs (30%)
  const completedCount = appSnap.size;
  const jobsScore = (Math.min(completedCount, 10) / 10) * 30;

  // 3. Ratings (30%)
  let ratingScore = 30;
  if (!revSnap.empty) {
    const totalStars = revSnap.docs.reduce((sum, doc) => sum + Number(doc.data().rating || 0), 0);
    const avg = totalStars / revSnap.size;
    ratingScore = (avg / 5) * 30;
  }

  let finalScore = Math.round(attScore + jobsScore + ratingScore);

  // Baseline for new workers (first 3 jobs) to be fair
  if (completedCount < 3 && finalScore < 80) {
    finalScore = 80;
  }

  // 4. Badge Milestones
  const currentBadges = workerData.badges || [];
  const newBadges = [...currentBadges];

  if (completedCount >= 10 && !newBadges.includes('verified_master')) {
    newBadges.push('verified_master');
  }
  if (completedCount >= 5 && attScore >= 39 && !newBadges.includes('attendance_king')) {
    newBadges.push('attendance_king');
  }
  if (revSnap.size >= 3 && ratingScore >= 28 && !newBadges.includes('star_performer')) {
    newBadges.push('star_performer');
  }

  // Update in database
  await workerRef.update({
    trustScore: finalScore,
    badges: newBadges
  });

  return { finalScore, newBadges };
};
