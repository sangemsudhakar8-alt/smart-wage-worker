import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { fetchJobs, createJob, fetchApplications, selectWorker, markAttendance, submitReview, fetchLeaves, updateLeaveStatus, fetchAttendance } from '../api';
import { Volume2, Briefcase, Plus, Star, Calendar, UserCheck, XCircle, Users, ChevronRight, BarChart2, CheckCircle, ClipboardList, LogOut, CheckSquare, TrendingUp, Bell, Award, Mic } from 'lucide-react';
import { playAudio } from '../utils/audio';
import { useToast } from '../contexts/ToastContext';
import { seedDemoData } from '../utils/seedDemoData';
import { useVoice } from '../contexts/VoiceContext';
import VoiceInput from '../components/VoiceInput';

const EmployerDashboard = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const { playGuide, voiceCommand } = useVoice();
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [view, setView] = useState('home');
    const [loading, setLoading] = useState(false);
    const [formJob, setFormJob] = useState({ title: '', location: '', wage: '', description: '' });
    const [isListeningMagic, setIsListeningMagic] = useState(false);
    const recognitionRef = useRef(null);

    const loadData = async (autoSeedIfEmpty = false) => {
        const [js, as, ls, atts] = await Promise.all([
            fetchJobs(),
            fetchApplications(),
            fetchLeaves(),
            fetchAttendance()
        ]);
        const myJobs = js.filter(j => j.employerId === user.id);
        setJobs(myJobs);
        const myJobIds = myJobs.map(j => j.id);
        setApplications(as.filter(a => myJobIds.includes(a.jobId)));
        setLeaves(ls.filter(l => l.employerId === user.id));
        setAttendance(atts);

        // Auto-seed demo data if this employer has no jobs
        if (autoSeedIfEmpty && myJobs.length === 0) {
            try {
                const seeded = await seedDemoData(user.id);
                if (seeded) {
                    showToast('Demo jobs loaded for your account!', 'success');
                    // Reload after seeding
                    const [js2, as2, ls2, atts2] = await Promise.all([
                        fetchJobs(),
                        fetchApplications(),
                        fetchLeaves(),
                        fetchAttendance()
                    ]);
                    const myJobs2 = js2.filter(j => j.employerId === user.id);
                    setJobs(myJobs2);
                    const myJobIds2 = myJobs2.map(j => j.id);
                    setApplications(as2.filter(a => myJobIds2.includes(a.jobId)));
                    setLeaves(ls2.filter(l => l.employerId === user.id));
                    setAttendance(atts2);
                }
            } catch (e) {
                console.warn('Auto-seed failed:', e);
            }
        }
    };

    useEffect(() => { loadData(true); }, [playGuide]);

    // Global Voice Command Listener
    useEffect(() => {
        if (!voiceCommand) return;
        const text = voiceCommand.text;
        
        const isPost = /post|new job|naya kaam|kotha pani/i.test(text);
        const isAttendance = /attendance|haaziri|hajaru/i.test(text);
        const isLeave = /leave|chutti|selavu/i.test(text);
        const isHome = /home|dashboard|mukhya/i.test(text);
        const isJobs = /job|kaam|pani/i.test(text);

        if (isPost) {
            setView('post');
        } else if (isAttendance) {
            setView('attendance');
        } else if (isLeave) {
            setView('leaves');
        } else if (isHome) {
            setView('home');
        } else if (isJobs) {
            setView('jobs');
        }
    }, [voiceCommand]);

    const handlePostJob = async (e) => {
        e.preventDefault();
        setLoading(true);
        let lat = null, lng = null;
        if (navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (err) {
                console.warn("Location permission not granted.");
            }
        }
        await createJob({ ...formJob, employerId: user.id, lat, lng });
        setFormJob({ title: '', location: '', wage: '', description: '' });
        setView('jobs');
        loadData();
        setLoading(false);
        showToast("Job posted successfully!", "success");
    };

    const handleSelectWorker = async (appId) => {
        await selectWorker(appId);
        loadData();
        showToast("Worker has been hired!", "success");
    };

    const handleMarkPresence = async (app, present) => {
        await markAttendance({
            jobId: app.jobId,
            workerId: app.workerId,
            date: new Date().toISOString().split('T')[0],
            present
        });
        loadData();
        showToast('Attendance logged.', present ? 'success' : 'info');
    };

    const handleRateWorker = async (app, rating) => {
        await submitReview({
            workerId: app.workerId,
            employerId: user.id,
            jobId: app.jobId,
            rating,
            comment: "Direct Rating"
        });
        showToast(t('review_added'), 'success');
    };

    const handleApproveLeave = async (leaveId, status) => {
        await updateLeaveStatus(leaveId, status);
        loadData();
        showToast(`Leave ${status}`, status === 'approved' ? 'success' : 'error');
    };

    const handleMarkAllPresent = async () => {
        const hired = applications.filter(a => a.status === 'selected');
        if (hired.length === 0) return;
        
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            await Promise.all(hired.map(app => markAttendance({
                jobId: app.jobId,
                workerId: app.workerId,
                date: today,
                present: true
            })));
            showToast("All workers marked as present!", "success");
            loadData();
        } catch (e) {
            showToast("Failed to mark all present.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handlePayAll = async () => {
        const today = new Date().toISOString().split('T')[0];
        const presentToday = applications.filter(app => {
            const isHired = app.status === 'selected';
            const isPresent = attendance.find(att => att.workerId === app.workerId && att.jobId === app.jobId && att.date === today && att.present);
            return isHired && isPresent;
        });

        if (presentToday.length === 0) {
            showToast("No workers marked present today to pay.", "info");
            return;
        }

        setLoading(true);
        try {
            // Bulk update logic simulation - in a real app, this would be a single API call
            showToast(`Processing payments for ${presentToday.length} workers...`, "info");
            // Simulate payment success
            setTimeout(() => {
                showToast(`Successfully paid ₹${presentToday.length * 800} to all workers.`, "success");
                setLoading(false);
            }, 1500);
        } catch (e) {
            showToast("Payment failed.", "error");
            setLoading(false);
        }
    };

    const handleMagicPost = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("Voice not supported.", "error");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = i18n.language === 'te' ? 'te-IN' : (i18n.language === 'hi' ? 'hi-IN' : 'en-IN');
        
        recognition.onstart = () => setIsListeningMagic(true);
        recognition.onend = () => setIsListeningMagic(false);
        
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript.toLowerCase();
            
            // Basic Parsing Logic
            const titles = ["painter", "mason", "electrician", "driver", "maid", "laborer", "cleaner", "பெయింటర్", "డ్రైవర్", "పెయింటర్", "పెయింటర్"];
            const foundTitle = titles.find(t => text.includes(t)) || "General Worker";
            
            const wageMatch = text.match(/\d+/);
            const foundWage = wageMatch ? wageMatch[0] : "500";
            
            const locations = ["hyderabad", "mumbai", "delhi", "bangalore", "chennai", "హైదరాబాద్", "ముంబై"];
            const foundLocation = locations.find(l => text.includes(l)) || "Near Me";

            setFormJob({
                title: foundTitle.charAt(0).toUpperCase() + foundTitle.slice(1),
                location: foundLocation.charAt(0).toUpperCase() + foundLocation.slice(1),
                wage: foundWage,
                description: `Voice posted: ${text}`
            });
            
            showToast("Job details auto-filled!", "success");
        };

        recognition.start();
    };

    // Derived stats
    const hiredCount = applications.filter(a => a.status === 'selected').length;
    const pendingApps = applications.filter(a => a.status === 'pending').length;
    const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
    const totalWagePaid = applications
        .filter(a => a.status === 'selected')
        .reduce((sum, a) => {
            const job = jobs.find(j => j.id === a.jobId);
            return sum + (job ? parseFloat(job.wage) || 0 : 0);
        }, 0);

    const getTrustColor = (score) => {
        if (score >= 80) return '#059669'; // Emerald
        if (score >= 60) return '#d97706'; // Amber
        return '#dc2626'; // Red
    };

    const sortedApplications = [...applications].sort((a, b) => (b.workerTrustScore || 0) - (a.workerTrustScore || 0));

    // Wage sparkline: last 7 days simulated from real hired count
    const sparklineData = (() => {
        const base = totalWagePaid > 0 ? totalWagePaid : 550;
        return [0.4, 0.55, 0.7, 0.5, 0.85, 0.65, 1.0].map(f => Math.round(f * base));
    })();
    const sparkMax = Math.max(...sparklineData);
    const sparkPoints = sparklineData.map((v, i) => {
        const x = (i / 6) * 200;
        const y = 40 - (v / sparkMax) * 38;
        return `${x},${y}`;
    }).join(' ');

    const navItems = [
        { key: 'home', icon: <BarChart2 size={22} />, label: 'Overview' },
        { key: 'jobs', icon: <Briefcase size={22} />, label: 'My Jobs' },
        { key: 'attendance', icon: <CheckSquare size={22} />, label: 'Attendance' },
        { key: 'post', icon: <Plus size={22} />, label: 'Post Job' },
        { key: 'leaves', icon: <Calendar size={22} />, label: 'Leaves' },
    ];

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '80px', position: 'relative' }}>

            {/* ── EMPLOYER HEADER BANNER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #92400e 0%, #d97706 50%, #f59e0b 100%)',
                padding: '1.25rem 1.5rem 2.5rem',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                <div className="app-container" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 id="dashboard-header" style={{ color: 'white', margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>{user.name}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.4rem' }}>
                            <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '0.2rem 0.7rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                                ✦ VERIFIED EMPLOYER
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => playGuide('employerDashboard')}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                        >
                            <Volume2 size={18} />
                        </button>
                        <button
                            onClick={() => { logout(); window.location.reload(); }}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                            title="Sign Out"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats Strip */}
                <div className="app-container" style={{ minHeight: 'auto' }}>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                        marginTop: '1.5rem', position: 'relative', width: '100%'
                    }}>
                        {[
                            { label: 'Jobs', value: jobs.length, icon: '💼' },
                            { label: 'Hired', value: hiredCount, icon: '✅' },
                            { label: 'Pending', value: pendingApps, icon: '📋' },
                            { label: 'Leaves', value: pendingLeaves, icon: '📅' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
                                borderRadius: '12px', padding: '0.8rem 0.6rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)',
                            }}>
                                <div style={{ fontSize: '1.2rem' }}>{s.icon}</div>
                                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.4rem', lineHeight: 1 }}>{s.value}</div>
                                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.65rem', textTransform: 'uppercase', marginTop: '4px' }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="app-container" style={{ marginTop: '-1.5rem', borderRadius: '24px 24px 0 0', background: 'var(--bg-color)', padding: '1.5rem 1rem' }}>

                {/* ── HOME VIEW ── */}
                {view === 'home' && (
                    <div className="animate-in web-grid-parent">
                        {/* LEFT COLUMN: Activity & List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Summary Card with Sparkline */}
                            <div className="card earnings-card" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('total_paid') || 'Total Workforce Spend'}</p>
                                        <h1 style={{ fontSize: '3rem', margin: '0.5rem 0', fontWeight: '900', color: 'white' }}>₹{(totalWagePaid || 550).toLocaleString()}</h1>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%' }}>
                                        <Briefcase size={32} color="white" />
                                    </div>
                                </div>
                                {/* Sparkline */}
                                <div style={{ marginTop: '1rem' }}>
                                    <svg width="100%" viewBox="0 0 200 44" preserveAspectRatio="none" style={{ height: '44px', display: 'block' }}>
                                        <defs>
                                            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                                                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                                            </linearGradient>
                                        </defs>
                                        <polygon
                                            points={`0,44 ${sparkPoints} 200,44`}
                                            fill="url(#spark-fill)"
                                        />
                                        <polyline
                                            points={sparkPoints}
                                            fill="none"
                                            stroke="rgba(255,255,255,0.8)"
                                            strokeWidth="2"
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', opacity: 0.65 }}>7-day wage disbursement trend</p>
                                </div>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div id="active-jobs">
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>{t('active_jobs') || 'Active Jobs'}</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{jobs.filter(j => j.status === 'open').length}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>{t('workers_hired') || 'Workers Hired'}</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{hiredCount}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>Fill Rate</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                                            {jobs.length > 0 ? Math.round((hiredCount / jobs.length) * 100) : 0}%
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Hiring Pipeline */}
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h4 style={{ margin: '0 0 1rem', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingUp size={14} color="#d97706" /> Hiring Pipeline
                                </h4>
                                {['pending', 'selected', 'rejected'].map(status => {
                                    const count = applications.filter(a => a.status === status).length;
                                    const total = applications.length || 1;
                                    const pct = Math.round((count / total) * 100);
                                    const colors = { pending: '#f59e0b', selected: '#10b981', rejected: '#f43f5e' };
                                    const labels = { pending: 'Reviewing', selected: 'Hired', rejected: 'Rejected' };
                                    return (
                                        <div key={status} style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{labels[status]}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: colors[status] }}>{count} ({pct}%)</span>
                                            </div>
                                            <div style={{ height: '6px', borderRadius: '99px', background: 'var(--bg-color)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: colors[status], borderRadius: '99px', transition: 'width 1s ease' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Top Talent */}
                            {applications.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Award size={14} color="#d97706" /> Top Talent Applicants
                                        </h4>
                                        <button onClick={() => setView('jobs')} style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>View All <ChevronRight size={12} /></button>
                                    </div>
                                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                        {sortedApplications.slice(0, 4).map((app, i) => (
                                            <div key={app.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '0.9rem 1rem',
                                                borderBottom: i < Math.min(sortedApplications.length, 4) - 1 ? '1px solid var(--border-color)' : 'none',
                                            }} className="hover-lift">
                                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #d97706, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, flexShrink: 0, fontSize: '1.1rem' }}>
                                                    {(app.workerName || 'W')[0].toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{app.workerName || 'Worker'}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ color: '#d97706' }}>★ {app.workerRating || '5.0'}</span> ·
                                                        <span style={{ color: getTrustColor(app.workerTrustScore || 100), fontWeight: 700 }}>{app.workerTrustScore || 100}% trust</span>
                                                    </div>
                                                </div>
                                                <span className={`badge badge-${app.status}`} style={{ fontSize: '0.62rem' }}>{app.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Action hub */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="card hover-glow" style={{ padding: '1.5rem', borderLeft: '4px solid #d97706', background: 'white' }}>
                                <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TrendingUp size={16} color="#d97706" /> Management Hub
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                    <button 
                                        onClick={() => setView('post')} 
                                        className="btn btn-primary" 
                                        style={{ justifyContent: 'space-between', padding: '1.25rem', background: 'linear-gradient(to right, #d97706, #f59e0b)', border: 'none', borderRadius: '16px' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px', borderRadius: '10px' }}>
                                                <Plus size={20} color="white" />
                                            </div>
                                            <span style={{ fontWeight: 700 }}>{t('post_job') || 'Post New Job'}</span>
                                        </div>
                                        <ChevronRight size={18} opacity={0.6} />
                                    </button>

                                    <button 
                                        onClick={() => setView('attendance')} 
                                        className="btn btn-outline" 
                                        style={{ justifyContent: 'space-between', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #e2e8f0' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ background: 'rgba(217,119,6,0.1)', padding: '8px', borderRadius: '10px' }}>
                                                <CheckSquare size={20} color="#d97706" />
                                            </div>
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{t('attendance') || 'Mark Attendance'}</span>
                                        </div>
                                        <ChevronRight size={18} color="var(--text-light)" />
                                    </button>

                                    <button 
                                        onClick={() => setView('leaves')} 
                                        className="btn btn-outline" 
                                        style={{ justifyContent: 'space-between', padding: '1.25rem', borderRadius: '16px', border: '1.5px solid #e2e8f0' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ background: 'rgba(245,158,11,0.1)', padding: '8px', borderRadius: '10px' }}>
                                                <Calendar size={20} color="#f59e0b" />
                                            </div>
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{t('leaves') || 'Manage Leaves'}</span>
                                        </div>
                                        <ChevronRight size={18} color="var(--text-light)" />
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats Summary */}
                            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1.5px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: '0', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>Stats Quick-Look</h4>
                                    <BarChart2 size={16} color="var(--text-light)" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                    <div style={{ textAlign: 'center', padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'var(--shadow-sm)' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-color)' }}>{jobs.length}</div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, marginTop: '4px' }}>Jobs</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'var(--shadow-sm)' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>{pendingApps}</div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, marginTop: '4px' }}>Apps</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* ── JOBS VIEW ── */}
                {view === 'jobs' && (
                    <div className="animate-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>My Job Posts</h2>
                            <button className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setView('post')}>
                                <Plus size={16} /> Post
                            </button>
                        </div>
                        {jobs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <Briefcase size={48} color="var(--text-light)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                <p style={{ color: 'var(--text-light)' }}>No jobs posted yet.</p>
                                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.75rem 2rem' }} onClick={() => setView('post')}>Post Your First Job</button>
                            </div>
                        ) : jobs.map(job => (
                            <div key={job.id} className="card" style={{ borderLeft: '4px solid #d97706' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{job.title}</h3>
                                    <span className={`badge badge-${job.status}`} style={{ fontSize: '0.7rem' }}>{job.status}</span>
                                </div>
                                <p style={{ margin: '0 0 0.75rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>💰 ₹{job.wage} &nbsp;·&nbsp; 📍 {job.location}</p>

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                                        Applicants ({applications.filter(a => a.jobId === job.id).length})
                                    </h4>
                                    {sortedApplications.filter(a => a.jobId === job.id).map((app, appIdx) => (
                                        <div key={app.id} style={{ 
                                            background: 'rgba(251,191,36,0.06)', 
                                            borderRadius: '10px', 
                                            padding: '0.75rem', 
                                            marginBottom: '0.5rem', 
                                            border: appIdx === 0 && app.status === 'pending' ? '2px solid #d97706' : '1px solid rgba(217,119,6,0.15)',
                                            position: 'relative'
                                        }}>
                                            {appIdx === 0 && app.status === 'pending' && (
                                                <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#d97706', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                                    Recommended Candidate
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ 
                                                        width: '32px', height: '32px', borderRadius: '50%', 
                                                        background: app.workerTrustScore >= 90 ? 'linear-gradient(135deg, #FFD700, #FDB931)' : 'linear-gradient(135deg, #d97706, #f59e0b)', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem', fontWeight: 700,
                                                        boxShadow: app.workerTrustScore >= 90 ? '0 0 8px rgba(253,185,49,0.5)' : 'none'
                                                    }}>
                                                        {(app.workerName || 'W')[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {app.workerName || 'Worker'}
                                                            {app.workerTrustScore >= 90 && <Star size={12} fill="#FDB931" color="#FDB931" />}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            ⭐ {app.workerRating || '5.0'} · 
                                                            <span style={{ color: getTrustColor(app.workerTrustScore || 100), fontWeight: 700 }}>{app.workerTrustScore || 100}% trust</span>
                                                            {app.workerTrustScore >= 90 && <span style={{ color: '#b45309', fontWeight: 800, marginLeft: '4px', fontSize: '0.65rem', textTransform: 'uppercase' }}>TOP WORKER</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className={`badge badge-${app.status}`} style={{ fontSize: '0.65rem' }}>{app.status}</span>
                                                    {app.status === 'pending' && (
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.78rem', background: '#d97706', boxShadow: 'none', fontWeight: 700 }}
                                                            onClick={() => handleSelectWorker(app.id)}
                                                        >
                                                            Select
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {app.status === 'selected' && (
                                                <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(217,119,6,0.2)' }}>
                                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '0.5rem' }}>
                                                        <button className="btn btn-secondary" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }} onClick={() => handleMarkPresence(app, true)}>
                                                            <UserCheck size={15} /> Present
                                                        </button>
                                                        <button className="btn btn-danger" style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }} onClick={() => handleMarkPresence(app, false)}>
                                                            <XCircle size={15} /> Absent
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <button key={star} onClick={() => handleRateWorker(app, star)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px' }}>
                                                                <Star size={20} fill="#f59e0b" color="#f59e0b" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {applications.filter(a => a.jobId === job.id).length === 0 && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: 0 }}>No applicants yet.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── POST JOB VIEW ── */}
                {view === 'post' && (
                    <div className="animate-in">
                        <h2 style={{ marginBottom: '1rem' }}>Post a New Job</h2>
                        <div className="card" style={{ borderTop: '4px solid #d97706' }}>
                            <div style={{ marginBottom: '1.5rem', background: '#fffbeb', padding: '1rem', borderRadius: '12px', border: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button 
                                    onClick={handleMagicPost}
                                    className={`btn ${isListeningMagic ? 'btn-danger pulse' : 'btn-primary'}`}
                                    style={{ borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(217,119,6,0.2)' }}
                                >
                                    <Mic size={24} color="white" />
                                </button>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>{t('magic_post')}</p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#b45309' }}>{t('magic_post_hint')}</p>
                                </div>
                            </div>
                            <form onSubmit={handlePostJob}>
                                <div className="form-group">
                                    <label className="form-label">Job Title</label>
                                    <VoiceInput required value={formJob.title} onChange={e => setFormJob({ ...formJob, title: e.target.value })} placeholder="e.g. Mason, Electrician, Driver" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <VoiceInput required value={formJob.location} onChange={e => setFormJob({ ...formJob, location: e.target.value })} placeholder="e.g. Hyderabad, Mumbai" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Daily Wage (₹)</label>
                                    <VoiceInput type="number" required value={formJob.wage} onChange={e => setFormJob({ ...formJob, wage: e.target.value })} placeholder="e.g. 800" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description (optional)</label>
                                    <VoiceInput value={formJob.description} onChange={e => setFormJob({ ...formJob, description: e.target.value })} placeholder="e.g. Construction work, 6 days/week" />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(to right, #d97706, #f59e0b)', boxShadow: '0 4px 14px rgba(217,119,6,0.4)' }} disabled={loading}>
                                    {loading ? <span className="spinner" /> : <><Plus size={18} /> Post Job</>}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── LEAVES VIEW ── */}
                {view === 'leaves' && (
                    <div className="animate-in">
                        <h2 style={{ marginBottom: '1rem' }}>Leave Requests</h2>
                        {leaves.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <CheckCircle size={48} color="var(--text-light)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                <p style={{ color: 'var(--text-light)' }}>No leave requests found.</p>
                            </div>
                        ) : leaves.map(l => (
                            <div key={l.id} className="card" style={{ borderLeft: `4px solid ${l.status === 'approved' ? '#10b981' : l.status === 'rejected' ? '#f43f5e' : '#d97706'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{l.workerName || 'Worker'}</h3>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-light)' }}>📅 {l.date} · {l.reason}</p>
                                    </div>
                                    <span className={`badge badge-${l.status || 'pending'}`}>{l.status || 'pending'}</span>
                                </div>
                                {l.status === 'pending' && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem' }}>
                                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleApproveLeave(l.id, 'approved')}>
                                            <CheckCircle size={16} /> Approve
                                        </button>
                                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleApproveLeave(l.id, 'rejected')}>
                                            <XCircle size={16} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── ATTENDANCE VIEW ── */}
                {view === 'attendance' && (
                    <div className="animate-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ margin: 0 }}>Mark Attendance</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary btn-sm" onClick={handleMarkAllPresent} disabled={loading}><CheckCircle size={14} /> {t('bulk_present')}</button>
                                <button className="btn btn-primary btn-sm" onClick={handlePayAll} disabled={loading} style={{ background: '#059669' }}><Plus size={14} /> {t('pay_all')}</button>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                            Mark daily presence for your hired workers. Status is for: <strong>{new Date().toDateString()}</strong>
                        </p>
                        
                        {applications.filter(a => a.status === 'selected').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <Users size={48} color="var(--text-light)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                <p style={{ color: 'var(--text-light)' }}>No hired workers to mark attendance for.</p>
                                <button className="btn btn-primary" onClick={() => setView('jobs')} style={{ width: 'auto', padding: '0.75rem 2rem' }}>Hire Workers First</button>
                            </div>
                        ) : (
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                {applications.filter(a => a.status === 'selected').map((app, i) => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const record = attendance.find(att => att.workerId === app.workerId && att.jobId === app.jobId && att.date === today);
                                    
                                    return (
                                        <div key={app.id} style={{
                                            padding: '1rem',
                                            borderBottom: i < applications.filter(a => a.status === 'selected').length - 1 ? '1px solid var(--border-color)' : 'none',
                                            background: record ? 'rgba(16,185,129,0.03)' : 'transparent'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, #d97706, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                                                    {(app.workerName || 'W')[0].toUpperCase()}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{app.workerName || 'Worker'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                                                        {jobs.find(j => j.id === app.jobId)?.title}
                                                    </div>
                                                </div>
                                                {record && (
                                                    <span style={{ 
                                                        color: record.present ? '#10b981' : '#ef4444', 
                                                        fontWeight: 700, 
                                                        fontSize: '0.75rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {record.present ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {record.present ? 'PRESENT' : 'ABSENT'}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button 
                                                    className={`btn ${record?.present === true ? 'btn-success' : 'btn-outline'}`}
                                                    disabled={record !== undefined}
                                                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                                                    onClick={() => handleMarkPresence(app, true)}
                                                >
                                                    <UserCheck size={18} /> Present
                                                </button>
                                                <button 
                                                    className={`btn ${record?.present === false ? 'btn-danger' : 'btn-outline'}`}
                                                    disabled={record !== undefined}
                                                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                                                    onClick={() => handleMarkPresence(app, false)}
                                                >
                                                    <XCircle size={18} /> Absent
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── BOTTOM NAV ── */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
                background: 'var(--card-bg)', backdropFilter: 'blur(20px)',
                borderTop: '1px solid var(--card-border)',
                display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000,
                width: '100%', borderTop: '1px solid var(--border-color)'
            }}>
                <div className="app-container" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%', maxWidth: '1200px' }}>
                    {navItems.map(({ key, icon, label }) => (
                        <button key={key} onClick={() => setView(key)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                            color: view === key ? '#d97706' : 'var(--text-light)',
                            position: 'relative', minWidth: '70px'
                        }}>
                            {key === 'leaves' && pendingLeaves > 0 && (
                                <span style={{ position: 'absolute', top: '2px', right: '50%', transform: 'translateX(15px)', width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
                            )}
                            {key === 'post' ? (
                                <div style={{
                                    width: '46px', height: '46px', borderRadius: '50%',
                                    background: view === key ? '#d97706' : 'linear-gradient(135deg, #d97706, #f59e0b)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                                    boxShadow: '0 4px 14px rgba(217,119,6,0.4)', marginTop: '-16px',
                                    border: '3px solid var(--bg-color)',
                                }}>
                                    {icon}
                                </div>
                            ) : icon}
                            <span style={{ fontSize: '0.65rem', fontWeight: view === key ? 700 : 400 }}>{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


export default EmployerDashboard;
