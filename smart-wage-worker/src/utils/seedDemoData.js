import {
    collection, getDocs, addDoc, setDoc, doc, updateDoc,
    serverTimestamp, query, limit, where
} from "firebase/firestore";
import { db } from "../firebase";

const DEMO_WORKER_ID = "mock_user_1234567890";

const makeDemoJobs = (employerId) => [
    { title: "House Painter",       wage: 550, location: "Hyderabad",     lat: 17.385, lng: 78.486, description: "Interior and exterior painting for residential apartment.",        employerId },
    { title: "Construction Helper", wage: 420, location: "Visakhapatnam", lat: 17.686, lng: 83.218, description: "Assist civil engineer in construction of commercial building.",    employerId },
    { title: "Delivery Driver",     wage: 600, location: "Hyderabad",     lat: 17.360, lng: 78.474, description: "Two-wheeler grocery delivery, morning shift 8am–2pm.",            employerId },
    { title: "Hotel Cook",          wage: 480, location: "Warangal",      lat: 17.977, lng: 79.594, description: "South Indian breakfast and lunch prep for 60-cover restaurant.",  employerId },
    { title: "Security Guard",      wage: 380, location: "Hyderabad",     lat: 17.440, lng: 78.498, description: "Night shift security for IT office premises. Uniform provided.",  employerId },
];

const DEMO_APPLICATIONS = [
    { jobIndex: 0, status: "selected", workerName: "Suresh Babu", workerTrustScore: 87, workerRating: "4.8" },
    { jobIndex: 1, status: "pending",  workerName: "Suresh Babu", workerTrustScore: 87, workerRating: "4.8" },
    { jobIndex: 2, status: "rejected", workerName: "Suresh Babu", workerTrustScore: 87, workerRating: "4.8" },
];

/**
 * Seeds Firestore with demo data for a specific employer.
 *
 * Guard logic:
 *  - If employerUserId is provided → check if THIS employer already has jobs.
 *    If not, seed for them (even if other employers' jobs exist globally).
 *  - If no employerUserId → fall back to global guard (skip if 3+ jobs exist).
 *
 * Returns true if seeded, false if skipped.
 */
export const seedDemoData = async (employerUserId) => {
    try {
        const EMPLOYER_ID = employerUserId || "mock_employer_demo";

        // ── Guard: idempotent per-employer ──────────────────────────────
        if (employerUserId) {
            // Check if THIS employer already has jobs with applicants (fully seeded)
            const myJobs = await getDocs(
                query(collection(db, "jobs"), where("employerId", "==", EMPLOYER_ID), limit(1))
            );
            if (myJobs.size > 0) {
                // Check if their jobs have applicants attached
                const firstJobId = myJobs.docs[0].id;
                const myApps = await getDocs(
                    query(collection(db, "applications"), where("jobId", "==", firstJobId), limit(1))
                );
                if (myApps.size > 0) {
                    console.log("Demo data (with applications) already exists for employer:", EMPLOYER_ID);
                    return false;
                }
                // Jobs exist but no applications — clean up orphan jobs before reseeding
                const allMyJobs = await getDocs(
                    query(collection(db, "jobs"), where("employerId", "==", EMPLOYER_ID))
                );
                const { deleteDoc } = await import("firebase/firestore");
                for (const jobDoc of allMyJobs.docs) {
                    await deleteDoc(doc(db, "jobs", jobDoc.id));
                }
                console.log("Cleaned up orphan jobs for employer:", EMPLOYER_ID);
            }
        } else {
            // Fall back to global guard
            const existing = await getDocs(query(collection(db, "jobs"), limit(3)));
            if (existing.size >= 3) return false;
        }

        // ── Demo Worker ─────────────────────────────────────────────────
        await setDoc(doc(db, "users", DEMO_WORKER_ID), {
            id: DEMO_WORKER_ID,
            phone: "1234567890",
            role: "worker",
            name: "Suresh Babu",
            skills: ["painting", "construction", "driving"],
            location: "Hyderabad",
            trustScore: 87,
            createdAt: serverTimestamp(),
        }, { merge: true });

        // ── Jobs ────────────────────────────────────────────────────────
        const jobIds = [];
        for (const job of makeDemoJobs(EMPLOYER_ID)) {
            const ref = await addDoc(collection(db, "jobs"), {
                ...job,
                status: "open",
                createdAt: serverTimestamp(),
            });
            jobIds.push(ref.id);
        }

        // ── Applications (with worker name embedded for dashboard display) ─
        for (const { jobIndex, status, workerName, workerTrustScore, workerRating } of DEMO_APPLICATIONS) {
            await addDoc(collection(db, "applications"), {
                jobId: jobIds[jobIndex],
                workerId: DEMO_WORKER_ID,
                workerName,
                workerTrustScore,
                workerRating,
                status,
                appliedAt: new Date().toISOString(),
            });
        }

        // ── Close the selected job ──────────────────────────────────────
        await updateDoc(doc(db, "jobs", jobIds[0]), { status: "closed" });

        // ── Attendance (5 present, 1 absent) ───────────────────────────
        const attendanceDays = [true, true, true, true, true, false];
        for (let i = 0; i < attendanceDays.length; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            await addDoc(collection(db, "attendance"), {
                jobId: jobIds[0],
                workerId: DEMO_WORKER_ID,
                present: attendanceDays[i],
                date: d.toISOString().split("T")[0],
                createdAt: serverTimestamp(),
            });
        }

        // ── Review ─────────────────────────────────────────────────────
        await addDoc(collection(db, "reviews"), {
            workerId: DEMO_WORKER_ID,
            employerId: EMPLOYER_ID,
            rating: 4,
            comment: "Punctual and hardworking. Would hire again.",
            createdAt: serverTimestamp(),
        });

        // ── Notifications for worker ───────────────────────────────────
        await addDoc(collection(db, "notifications"), {
            userId: DEMO_WORKER_ID,
            message: "You were SELECTED for House Painter! ₹550/day",
            type: "success",
            date: new Date().toISOString(),
            createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "notifications"), {
            userId: DEMO_WORKER_ID,
            message: "New job matching your skills: Hotel Cook – ₹480/day in Warangal",
            type: "info",
            date: new Date().toISOString(),
            createdAt: serverTimestamp(),
        });

        // ── Notifications for employer ─────────────────────────────────
        await addDoc(collection(db, "notifications"), {
            userId: EMPLOYER_ID,
            message: "Suresh Babu applied for House Painter. Trust Score: 87%",
            type: "info",
            date: new Date().toISOString(),
            createdAt: serverTimestamp(),
        });

        console.log("✅ Demo data seeded for employer:", EMPLOYER_ID);
        return true;
    } catch (err) {
        console.error("❌ Seed failed:", err);
        throw err;
    }
};
