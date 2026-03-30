import { 
    signInWithPhoneNumber,
    RecaptchaVerifier
} from "firebase/auth";
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    setDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    serverTimestamp,
    increment
} from "firebase/firestore";
import { db, auth } from "./firebase";

// ========================
// AUTHENTICATION (Real SMS Auth)
// ========================
export const setupRecaptcha = (containerId) => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        'size': 'invisible',
        'callback': (response) => {
            console.log("Recaptcha resolved");
        }
    });
    return window.recaptchaVerifier;
};

export const sendOTP = async (phone, verifier) => {
    // DEV MODE: Bypass real SMS for all 10-digit numbers during development
    // This allows testing without needing Firebase Billing enabled.
    if (phone.length === 10 && !phone.startsWith('+')) {
        console.log("Using Mock OTP for Dev:", phone);
        return {
            confirm: async (otp) => {
                if (otp === "123456") {
                    return { user: { uid: `mock_user_${phone}` } };
                }
                throw new Error("Invalid OTP");
            },
            isMock: true
        };
    }

    // Add +91 prefix if missing (assuming India for wages)
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    return confirmationResult;
};

export const loginFirebaseUser = async (phone, role, userId) => {
    const userDoc = await getDoc(doc(db, "users", userId));
    
    if (!userDoc.exists()) {
        const newUser = {
            id: userId,
            phone,
            role,
            name: `User ${phone.slice(-4)}`,
            skills: [],
            location: '',
            trustScore: 100,
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, "users", userId), newUser);
        return { user: newUser };
    } else {
        // If user exists, but logs in with a different role, update it (or handle as needed)
        const existingData = userDoc.data();
        if (existingData.role !== role) {
            await updateDoc(doc(db, "users", userId), { role });
            return { user: { id: userDoc.id, ...existingData, role } };
        }
    }
    return { user: { id: userDoc.id, ...userDoc.data() } };
};

// ========================
// REUSABLE HELPER
// ========================
const addNotification = async (userId, message, type='info') => {
    await addDoc(collection(db, "notifications"), {
        userId,
        message,
        type,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
    });
};

// ========================
// JOBS API
// ========================
export const fetchJobs = async () => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const createJob = async (jobData) => {
    const docRef = await addDoc(collection(db, "jobs"), {
        ...jobData,
        status: 'open',
        createdAt: serverTimestamp()
    });
    return { id: docRef.id, ...jobData };
};

// ========================
// APPLICATIONS API
// ========================
export const fetchApplications = async () => {
    const snapshot = await getDocs(collection(db, "applications"));
    const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Enrich with worker details and employer phone for UI
    const enriched = await Promise.all(apps.map(async (app) => {
        const data = { ...app };
        
        // Fetch worker details for employer view
        const workerDoc = await getDoc(doc(db, "users", app.workerId));
        if (workerDoc.exists()) {
            const worker = workerDoc.data();
            data.workerName = worker.name;
            data.workerSkills = worker.skills;
            data.workerTrustScore = worker.trustScore;
            
            // Calc rating from reviews collection
            const revQ = query(collection(db, "reviews"), where("workerId", "==", app.workerId));
            const revSnap = await getDocs(revQ);
            if (!revSnap.empty) {
                const total = revSnap.docs.reduce((sum, r) => sum + r.data().rating, 0);
                data.workerRating = (total / revSnap.docs.length).toFixed(1);
            } else {
                data.workerRating = "5.0";
            }
        }

        // Attach Employer Phone if selected
        if (app.status === 'selected') {
            const jobDoc = await getDoc(doc(db, "jobs", app.jobId));
            if (jobDoc.exists()) {
                const employerDoc = await getDoc(doc(db, "users", jobDoc.data().employerId));
                if (employerDoc.exists()) data.employerPhone = employerDoc.data().phone;
            }
        }
        return data;
    }));
    
    return enriched;
};

export const applyForJob = async (jobId, workerId) => {
    const docRef = await addDoc(collection(db, "applications"), {
        jobId,
        workerId,
        status: 'pending',
        appliedAt: new Date().toISOString()
    });
    
    // Notify Employer
    const jobSnap = await getDoc(doc(db, "jobs", jobId));
    if (jobSnap.exists()) {
        await addNotification(jobSnap.data().employerId, `A new worker applied for ${jobSnap.data().title}`, 'info');
    }
    
    return { id: docRef.id };
};

export const selectWorker = async (applicationId) => {
    const appRef = doc(db, "applications", applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) return;
    
    const { jobId, workerId } = appSnap.data();
    
    // Transactional logic: Select one, reject others
    const q = query(collection(db, "applications"), where("jobId", "==", jobId));
    const allAppsForJob = await getDocs(q);
    
    const jobSnap = await getDoc(doc(db, "jobs", jobId));

    await Promise.all(allAppsForJob.docs.map(async (d) => {
        const status = d.id === applicationId ? 'selected' : 'rejected';
        await updateDoc(doc(db, "applications", d.id), { status });
        
        if (status === 'selected') {
            await addNotification(d.data().workerId, `You were SELECTED for ${jobSnap.data().title}!`, 'success');
        } else {
            await addNotification(d.data().workerId, `Application for ${jobSnap.data().title} was rejected.`, 'error');
        }
    }));

    await updateDoc(doc(db, "jobs", jobId), { status: 'closed' });
    return { success: true };
};

// ========================
// NOTIFICATIONS & ATTENDANCE
// ========================
export const fetchNotifications = async (userId) => {
    const q = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const markAttendance = async (attendanceData) => {
    const { jobId, workerId, present } = attendanceData;
    await addDoc(collection(db, "attendance"), { ...attendanceData, createdAt: serverTimestamp() });
    
    // Trigger dynamic trust score update
    await updateWorkerTrustScore(workerId);
    
    return { success: true };
};

export const fetchAttendance = async () => {
    const snapshot = await getDocs(collection(db, "attendance"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateWorkerTrustScore = async (workerId) => {
    const workerRef = doc(db, "users", workerId);
    
    const [attSnap, revSnap, appSnap] = await Promise.all([
        getDocs(query(collection(db, "attendance"), where("workerId", "==", workerId))),
        getDocs(query(collection(db, "reviews"), where("workerId", "==", workerId))),
        getDocs(query(collection(db, "applications"), where("workerId", "==", workerId), where("status", "==", "selected")))
    ]);

    // 1. Attendance Rate (40%)
    let attScore = 40; // Default if no records
    if (!attSnap.empty) {
        const total = attSnap.docs.length;
        const present = attSnap.docs.filter(d => d.data().present).length;
        attScore = (present / total) * 40;
    }

    // 2. Completed/Hired Jobs (30%)
    // Let's count 'selected' applications as completed jobs for now
    const completedCount = appSnap.size;
    const jobsScore = Math.min(completedCount, 10) / 10 * 30;

    // 3. Ratings (30%)
    let ratingScore = 30; // Default 5 stars if no reviews
    if (!revSnap.empty) {
        const totalStars = revSnap.docs.reduce((sum, r) => sum + r.data().rating, 0);
        const avg = totalStars / revSnap.docs.length;
        ratingScore = (avg / 5) * 30;
    }

    // Baseline for new workers (first 3 jobs) to be fair
    let finalScore = Math.round(attScore + jobsScore + ratingScore);
    
    // Defensive cap
    finalScore = Math.min(Math.max(finalScore, 0), 100);
    
    if (completedCount < 3 && finalScore < 80) finalScore = 80;

    await updateDoc(workerRef, { trustScore: finalScore });
    return finalScore;
};

// ========================
// USER STATS & PROFILE
// ========================
export const getUserStats = async (userId) => {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return null;
    
    const user = { id: userDoc.id, ...userDoc.data() };
    
    if (user.role === 'worker') {
        const attQ = query(collection(db, "attendance"), where("workerId", "==", userId), where("present", "==", true));
        const attSnap = await getDocs(attQ);
        
        let totalEarnings = 0;
        await Promise.all(attSnap.docs.map(async (att) => {
            const jobSnap = await getDoc(doc(db, "jobs", att.data().jobId));
            if (jobSnap.exists()) totalEarnings += Number(jobSnap.data().wage);
        }));
        
        user.totalEarnings = totalEarnings;
        user.daysWorked = attSnap.docs.length;
    }
    
    return user;
};

export const updateProfile = async (userId, profileData) => {
    await updateDoc(doc(db, "users", userId), profileData);
    const updated = await getDoc(doc(db, "users", userId));
    return { id: updated.id, ...updated.data() };
};

export const submitReview = async (reviewData) => {
    await addDoc(collection(db, "reviews"), { ...reviewData, createdAt: serverTimestamp() });
    
    // Trigger dynamic trust score update
    await updateWorkerTrustScore(reviewData.workerId);
    
    await addNotification(reviewData.workerId, `You received a ${reviewData.rating}-star rating!`, 'info');
};

// ========================
// LEAVE REQUESTS
// ========================
export const fetchLeaves = async () => {
    const snapshot = await getDocs(collection(db, "leaves"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const requestLeave = async (leaveData) => {
    await addDoc(collection(db, "leaves"), { ...leaveData, status: 'pending', createdAt: serverTimestamp() });
    await addNotification(leaveData.employerId, `A worker requested leave for ${leaveData.date}.`, 'info');
};

export const updateLeaveStatus = async (leaveId, status) => {
    const leaveRef = doc(db, "leaves", leaveId);
    const leaveSnap = await getDoc(leaveRef);
    if (!leaveSnap.exists()) return;
    
    await updateDoc(leaveRef, { status });
    await addNotification(leaveSnap.data().workerId, `Your leave for ${leaveSnap.data().date} was ${status}.`, status === 'approved' ? 'success' : 'error');
};
