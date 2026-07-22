import { 
    signInWithPhoneNumber,
    RecaptchaVerifier
} from "firebase/auth";
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    getDoc,
    doc,
    getDocs
} from "firebase/firestore";
import { uploadBytes, ref, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./firebase";

const API_BASE = 'http://localhost:5000/api';

// ========================
// AUTHENTICATION CLIENT AND UTILS
// ========================
export const setupRecaptcha = (containerId) => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        'size': 'invisible',
        'callback': () => {
            console.log("Recaptcha resolved");
        }
    });
    return window.recaptchaVerifier;
};

export const sendOTP = async (phone, verifier) => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // DEV MODE: Bypass real SMS for 10-digit test numbers
    if (cleanPhone.length === 10 && !phone.includes('+')) {
        console.log("Using Mock OTP for Dev:", cleanPhone);
        return {
            confirm: async (otp) => {
                if (otp === "123456") {
                    return { user: { uid: `mock_user_${cleanPhone}` } };
                }
                throw new Error("auth/invalid-verification-code");
            },
            isMock: true
        };
    }

    const formattedPhone = phone.startsWith('+') ? phone : `+91${cleanPhone}`;
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    return confirmationResult;
};

// Helper to get active ID token or fallback to stored mock token
const getAuthToken = async () => {
    if (auth.currentUser) {
        try {
            return await auth.currentUser.getIdToken();
        } catch (e) {
            console.error("Failed to get Firebase ID token:", e);
        }
    }
    const storedUser = localStorage.getItem('wageUser');
    if (storedUser) {
        try {
            const parsed = JSON.parse(storedUser);
            if (parsed.token) return parsed.token;
            if (parsed.id) return `mock_token_${parsed.id}`;
        } catch {
            // ignore
        }
    }
    return '';
};

// Reusable REST HTTP Request helper
const apiRequest = async (endpoint, options = {}) => {
    const token = await getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export const loginFirebaseUser = async (phone, role, userId) => {
    let token = userId;
    if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
    }
    
    const response = await fetch(`${API_BASE}/auth/session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ phone, role })
    });
    
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Login sync failed');
    }
    
    const data = await response.json();
    return { 
        user: { 
            ...data.user, 
            token: token.startsWith('mock_user_') ? `mock_token_${userId}` : token 
        } 
    };
};

// ========================
// REUSABLE HELPER
// ========================
export const addNotification = async (userId, message, type='info') => {
    return apiRequest('/notifications', {
        method: 'POST',
        body: JSON.stringify({ userId, message, type })
    });
};

// ========================
// JOBS API
// ========================
export const fetchJobs = async () => {
    return apiRequest('/jobs');
};

// Real-time Jobs Subscription (Uses client SDK read)
export const subscribeToJobs = (callback) => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(jobs);
    });
};

export const createJob = async (jobData) => {
    return apiRequest('/jobs', {
        method: 'POST',
        body: JSON.stringify(jobData)
    });
};

// ========================
// APPLICATIONS API
// ========================
export const fetchApplications = async () => {
    return apiRequest('/applications');
};

// Helper for client-side enrichment in real-time subscriptions
const enrichApplicationClientSide = async (app) => {
    const data = { ...app };
    try {
        const workerDoc = await getDoc(doc(db, "users", app.workerId));
        if (workerDoc.exists()) {
            const worker = workerDoc.data();
            data.workerName = worker.name;
            data.workerSkills = worker.skills;
            data.workerTrustScore = worker.trustScore;
            data.workerPhone = worker.phone;
            data.workerCompletedJobs = worker.completedJobs || 0;
            
            const revQ = query(collection(db, "reviews"), where("workerId", "==", app.workerId));
            const revSnap = await getDocs(revQ);
            if (!revSnap.empty) {
                const total = revSnap.docs.reduce((sum, r) => sum + Number(r.data().rating || 0), 0);
                data.workerRating = (total / revSnap.docs.length).toFixed(1);
            } else {
                data.workerRating = "5.0";
            }
        }

        const jobDoc = await getDoc(doc(db, "jobs", app.jobId));
        if (jobDoc.exists()) {
            const jobData = jobDoc.data();
            data.jobTitle = jobData.title;

            if (app.status === 'selected' && jobData.employerId) {
                const employerDoc = await getDoc(doc(db, "users", jobData.employerId));
                if (employerDoc.exists()) data.employerPhone = employerDoc.data().phone;
            }
        }
    } catch (e) {
        console.error("Enrichment error in subscription:", e);
    }
    return data;
};

// Real-time Applications Subscription (Uses client SDK read)
export const subscribeToApplications = (callback) => {
    return onSnapshot(collection(db, "applications"), async (snapshot) => {
        const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const enriched = await Promise.all(apps.map(app => enrichApplicationClientSide(app)));
        callback(enriched);
    });
};

export const applyForJob = async (jobId) => {
    return apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId })
    });
};

export const selectWorker = async (applicationId) => {
    return apiRequest(`/applications/${applicationId}/select`, {
        method: 'POST'
    });
};

// ========================
// NOTIFICATIONS & ATTENDANCE
// ========================
export const fetchNotifications = async () => {
    return apiRequest('/notifications');
};

// Real-time Notifications Subscription (Uses client SDK read)
export const subscribeToNotifications = (userId, callback) => {
    const q = query(collection(db, "notifications"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(notifs);
    });
};

export const markAttendance = async (attendanceData) => {
    return apiRequest('/attendance', {
        method: 'POST',
        body: JSON.stringify(attendanceData)
    });
};

// Real-time Attendance Subscription (Uses client SDK read)
export const subscribeToAttendance = (callback) => {
    const q = query(collection(db, "attendance"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const atts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(atts);
    });
};

export const fetchAttendance = async () => {
    return apiRequest('/attendance');
};

// ========================
// USER STATS & PROFILE
// ========================
export const getUserStats = async (userId) => {
    return apiRequest(`/users/${userId}/stats`);
};

export const updateProfile = async (userId, profileData) => {
    return apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData)
    });
};

export const uploadProfileImage = async (userId, file) => {
    const storageRef = ref(storage, `profiles/${userId}/${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    // Write profile updates through backend API
    await updateProfile(userId, { photoURL: downloadURL });
    return downloadURL;
};

export const submitReview = async (reviewData) => {
    return apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify(reviewData)
    });
};

// ========================
// LEAVE REQUESTS
// ========================
export const fetchLeaves = async () => {
    return apiRequest('/leaves');
};

export const requestLeave = async (leaveData) => {
    return apiRequest('/leaves', {
        method: 'POST',
        body: JSON.stringify(leaveData)
    });
};

export const updateLeaveStatus = async (leaveId, status) => {
    return apiRequest(`/leaves/${leaveId}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    });
};

export const cancelApplication = async (applicationId) => {
    return apiRequest(`/applications/${applicationId}/cancel`, {
        method: 'POST'
    });
};

export const updateWorkerLocation = async (workerId, lat, lng) => {
    return apiRequest('/attendance/location', {
        method: 'PUT',
        body: JSON.stringify({ lat, lng })
    });
};

// Real-time Locations Subscription (Uses client SDK read)
export const subscribeToWorkerLocations = (callback) => {
    const q = collection(db, 'worker_locations');
    return onSnapshot(q, (snapshot) => {
        const locs = {};
        snapshot.forEach(doc => {
            locs[doc.id] = doc.data();
        });
        callback(locs);
    });
};

export const updateLiveLocation = async (workerId, location) => {
    return apiRequest('/attendance/location', {
        method: 'PUT',
        body: JSON.stringify(location)
    });
};

// Real-time Active Locations Subscription (Uses client SDK read)
export const subscribeToActiveLocations = (callback) => {
    const q = query(collection(db, "users"), where("role", "==", "worker"));
    return onSnapshot(q, (snapshot) => {
        const locations = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.currentLocation || u.isPermanentlyOnline);
        callback(locations);
    });
};

// ========================
// GEO-FENCE API
// ========================

/**
 * Starts a geo-fence session for an active attendance record.
 * Sets attendance status to 'Active' and logs the first position.
 * @param {{ attendanceId: string, jobId: string, latitude: number, longitude: number }} payload
 */
export const startGeoFence = async (payload) => {
    return apiRequest('/geofence/start', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

/**
 * Sends a periodic location update (every 30 s) while attendance is active.
 * The backend calculates distance, detects violations, and updates Firestore.
 * @param {{ attendanceId: string, latitude: number, longitude: number }} payload
 * @returns {{ insideRadius: boolean, distance: number, radius: number, status: string, violationCount: number }}
 */
export const updateGeoFenceLocation = async (payload) => {
    return apiRequest('/geofence/update-location', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

/**
 * Ends the geo-fence session and marks attendance status as 'Completed'.
 * @param {{ attendanceId: string }} payload
 */
export const endGeoFence = async (payload) => {
    return apiRequest('/geofence/end', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

/**
 * Fetches the full geo-fence log history for a given attendance record.
 * @param {string} attendanceId
 * @returns {Array<{ id, latitude, longitude, distance, insideRadius, timestamp }>}
 */
export const fetchGeoFenceHistory = async (attendanceId) => {
    return apiRequest(`/geofence/history/${attendanceId}`);
};

