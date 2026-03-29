import express from 'express';
import cors from 'cors';
import { getDb, saveDb, generateId } from './database.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// ========================
// AUTHENTICATION API
// ========================
app.post('/api/auth/login', (req, res) => {
    const { phone, role } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required." });

    const db = getDb();
    let user = db.users.find(u => u.phone === phone && u.role === role);

    if (!user) {
        user = {
            id: generateId(),
            phone,
            role, // 'worker' or 'employer'
            name: `User ${phone.slice(-4)}`,
            skills: [],
            location: '',
            trustScore: 100 // new workers start with 100
        };
        db.users.push(user);
        saveDb(db);
    }
    
    // In a real app we'd use JWTs, here returning user object directly along with dummy token
    res.json({ token: `mock_token_${user.id}`, user });
});


// ========================
// REUSABLE HELPER API
// ========================
const addNotification = (db, userId, message, type='info') => {
    db.notifications.push({
        id: generateId(),
        userId,
        message,
        type,
        date: new Date().toISOString()
    });
};

// ========================
// JOBS API
// ========================
app.get('/api/jobs', (req, res) => {
    const db = getDb();
    res.json(db.jobs);
});

app.post('/api/jobs', (req, res) => {
    const { title, description, location, wage, employerId } = req.body;
    const db = getDb();
    const job = {
        id: generateId(),
        employerId,
        title,
        description,
        location,
        wage,
        status: 'open',
        createdAt: new Date().toISOString()
    };
    db.jobs.push(job);
    saveDb(db);
    res.json(job);
});

app.delete('/api/jobs/:id', (req, res) => {
    const db = getDb();
    db.jobs = db.jobs.filter(j => j.id !== req.params.id);
    db.applications = db.applications.filter(a => a.jobId !== req.params.id);
    saveDb(db);
    res.json({ message: 'Deleted' });
});

// ========================
// APPLICATIONS API
// ========================
app.get('/api/applications', (req, res) => {
    const db = getDb();
    const enriched = db.applications.map(app => {
        const worker = db.users.find(u => u.id === app.workerId);
        const job = db.jobs.find(j => j.id === app.jobId);
        
        const data = { ...app };
        
        if (worker) {
            data.workerName = worker.name;
            data.workerSkills = worker.skills;
            data.workerTrustScore = worker.trustScore;
            
            const reviews = db.reviews ? db.reviews.filter(r => r.workerId === worker.id) : [];
            data.workerRating = reviews.length > 0 
                ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                : "5.0";
        }

        if(app.status === 'selected' && job) {
            const employer = db.users.find(u => u.id === job.employerId);
            if(employer) data.employerPhone = employer.phone;
        }
        
        return data;
    });
    res.json(enriched);
});

app.post('/api/applications', (req, res) => {
    const { jobId, workerId } = req.body;
    const db = getDb();
    
    // Check if job exists
    const job = db.jobs.find(j => j.id === jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Check if already applied
    if (db.applications.some(a => a.jobId === jobId && a.workerId === workerId)) {
        return res.status(400).json({ error: 'Already applied' });
    }

    const application = {
        id: generateId(),
        jobId,
        workerId,
        status: 'pending',
        appliedAt: new Date().toISOString()
    };
    db.applications.push(application);

    // Notify Employer
    addNotification(db, job.employerId, `A new worker applied for ${job.title}`, 'info');

    saveDb(db);
    res.json(application);
});

// Employer Selects a worker
app.post('/api/applications/:id/select', (req, res) => {
    const db = getDb();
    const appId = req.params.id;
    
    const appIndex = db.applications.findIndex(a => a.id === appId);
    if (appIndex === -1) return res.status(404).json({ error: 'Application not found' });

    const application = db.applications[appIndex];
    const jobId = application.jobId;

    const job = db.jobs.find(j => j.id === jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if(job.status !== 'open') return res.status(400).json({ error: 'Job already closed' });

    // Select this worker, reject all others for this job
    db.applications.forEach(a => {
        if (a.jobId === jobId) {
            if (a.id === appId) {
                a.status = 'selected';
                addNotification(db, a.workerId, `You were SELECTED for the job: ${job.title}!`, 'success');
            } else {
                a.status = 'rejected';
                addNotification(db, a.workerId, `Your application for ${job.title} was rejected.`, 'error');
            }
        }
    });

    job.status = 'closed';
    saveDb(db);
    res.json({ message: 'Worker selected successfully' });
});

app.delete('/api/applications/:id', (req, res) => {
    const db = getDb();
    db.applications = db.applications.filter(a => a.id !== req.params.id);
    saveDb(db);
    res.json({ message: 'Deleted application' });
});

// ========================
// ATTENDANCE API
// ========================
app.get('/api/attendance', (req, res) => {
    res.json(getDb().attendance);
});

app.post('/api/attendance', (req, res) => {
    const { jobId, workerId, date, present } = req.body;
    const db = getDb();

    // prevent duplicate mark
    if (db.attendance.some(a => a.jobId === jobId && a.workerId === workerId && a.date === date)) {
         return res.status(400).json({ error: 'Attendance already marked for this date' });
    }

    db.attendance.push({
        id: generateId(),
        jobId,
        workerId,
        date,
        present
    });

    // Simple Trust Score update
    const worker = db.users.find(u => u.id === workerId);
    if (worker) {
        if (present) {
            worker.trustScore = Math.min(100, worker.trustScore + 2); // Cap at 100
        } else {
            worker.trustScore = Math.max(0, worker.trustScore - 5); // Penalize absence
        }
    }

    saveDb(db);
    res.json({ message: 'Attendance marked' });
});

// ========================
// DASHBOARD & NOTIFICATION API
// ========================
app.get('/api/users/:id', (req, res) => {
    const db = getDb();
    const user = db.users.find(u => u.id === req.params.id);
    if(!user) return res.status(404).json({ error: 'Not found' });

    if (user.role === 'worker') {
        let totalEarnings = 0;
        let daysWorked = 0;
        
        const workerAttendance = db.attendance.filter(a => a.workerId === user.id && a.present);
        workerAttendance.forEach(att => {
            const job = db.jobs.find(j => j.id === att.jobId);
            if(job) {
                totalEarnings += Number(job.wage) || 0;
                daysWorked++;
            }
        });

        const workerReviews = db.reviews ? db.reviews.filter(r => r.workerId === user.id) : [];
        let avgRating = 5.0;
        if(workerReviews.length > 0) {
            avgRating = workerReviews.reduce((sum, r) => sum + r.rating, 0) / workerReviews.length;
        }

        user.totalEarnings = totalEarnings;
        user.daysWorked = daysWorked;
        user.averageRating = avgRating.toFixed(1);
    }
    
    res.json(user);
});

app.put('/api/users/:id', (req, res) => {
    const { name, skills, location, avatarUrl } = req.body;
    const db = getDb();
    const user = db.users.find(u => u.id === req.params.id);
    if(!user) return res.status(404).json({ error: 'Not found' });

    if (name) user.name = name;
    if (skills) user.skills = skills;
    if (location) user.location = location;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl; // allow empty

    saveDb(db);
    res.json(user);
});

app.get('/api/notifications/:userId', (req, res) => {
    const db = getDb();
    const userNotifs = db.notifications.filter(n => n.userId === req.params.userId).reverse();
    res.json(userNotifs);
});

// ========================
// REVIEWS API
// ========================
app.get('/api/reviews/:workerId', (req, res) => {
    const db = getDb();
    const reviews = db.reviews || [];
    res.json(reviews.filter(r => r.workerId === req.params.workerId));
});

app.post('/api/reviews', (req, res) => {
    const { workerId, employerId, jobId, rating, comment } = req.body;
    const db = getDb();
    if(!db.reviews) db.reviews = [];
    
    if (db.reviews.some(r => r.workerId === workerId && r.employerId === employerId && r.jobId === jobId)) {
        return res.status(400).json({ error: 'Review already submitted for this job' });
    }

    db.reviews.push({
        id: generateId(),
        workerId,
        employerId,
        jobId,
        rating: Number(rating),
        comment,
        date: new Date().toISOString()
    });

    const worker = db.users.find(u => u.id === workerId);
    if(worker) {
        if(rating >= 4) worker.trustScore = Math.min(100, worker.trustScore + 5);
        if(rating < 3) worker.trustScore = Math.max(0, worker.trustScore - 10);
    }

    addNotification(db, workerId, `You received a ${rating}-star rating!`, 'info');
    saveDb(db);
    res.json({ message: 'Review added' });
});

// ========================
// LEAVE REQUEST API
// ========================
app.get('/api/leaves', (req, res) => {
    const db = getDb();
    res.json(db.leaves || []);
});

app.post('/api/leaves', (req, res) => {
    const { workerId, employerId, date, reason } = req.body;
    const db = getDb();
    if(!db.leaves) db.leaves = [];

    const request = {
       id: generateId(), workerId, employerId, date, reason, status: 'pending', createdAt: new Date().toISOString()
    };
    db.leaves.push(request);
    
    addNotification(db, employerId, `A worker requested leave on ${date}.`, 'info');
    saveDb(db);
    res.json(request);
});

app.put('/api/leaves/:id', (req, res) => {
    const { status } = req.body; // 'approved' or 'rejected'
    const db = getDb();
    const leave = (db.leaves || []).find(l => l.id === req.params.id);
    if(!leave) return res.status(404).json({ error: 'Not found' });

    leave.status = status;
    addNotification(db, leave.workerId, `Your leave request for ${leave.date} was ${status}.`, status === 'approved' ? 'success' : 'error');
    
    saveDb(db);
    res.json(leave);
});

app.listen(PORT, () => {
    console.log(`Smart Wage Backend running seamlessly on http://localhost:${PORT}`);
});
