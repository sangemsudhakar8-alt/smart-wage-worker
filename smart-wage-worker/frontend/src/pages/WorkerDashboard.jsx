import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { fetchJobs, fetchApplications, applyForJob, getUserStats, fetchNotifications, updateProfile, fetchLeaves } from '../api';
import { Volume2, Briefcase, FileText, User, Bell, CheckCircle, Search, PhoneCall, MapPin, Clock, Calendar, Star, Home, ArrowRight, LogOut, ShieldCheck, Mic } from 'lucide-react';
import { playAudio } from '../utils/audio';
import { useToast } from '../contexts/ToastContext';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

const WorkerDashboard = () => {
    const { t, i18n } = useTranslation();
    const { user, loginUser, logout } = useAuth();
    const { showToast } = useToast();

    // All hooks must be declared before any conditional return
    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [stats, setStats] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [view, setView] = useState('home');
    const [searchQuery, setSearchQuery] = useState('');
    const [isApplying, setIsApplying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userCoords, setUserCoords] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', skills: '', location: '' });
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);

    const navItems = [
        { key: 'home', icon: <Home size={22} />, label: t('home') || 'Home' },
        { key: 'jobs', icon: <Briefcase size={22} />, label: t('jobs') || 'Jobs' },
        { key: 'applications', icon: <FileText size={22} />, label: t('apps') || 'Apps' },
        { key: 'settings', icon: <User size={22} />, label: t('profile') || 'Profile' },
    ];

    // Haversine Formula for distance in KM
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (R * c).toFixed(1);
    };

    const getTrustColor = (score) => {
        if (score >= 80) return '#10b981'; // Green
        if (score >= 60) return '#f59e0b'; // Yellow/Amber
        return '#ef4444'; // Red
    };

    const loadData = async (currentUser) => {
        if (!currentUser?.id) return;
        setIsLoading(true);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.warn("Geolocation denied", err)
            );
        }

        try {
            const [js, as, us, ns] = await Promise.all([
                fetchJobs().catch(() => []),
                fetchApplications().catch(() => []),
                getUserStats(currentUser.id).catch(() => ({ trustScore: 100, totalEarnings: 0, daysWorked: 0 })),
                fetchNotifications(currentUser.id).catch(() => []),
            ]);

            setJobs(Array.isArray(js) ? js : []);
            setApplications(Array.isArray(as) ? as.filter(a => a.workerId === currentUser.id) : []);
            setStats(us || { trustScore: 100, totalEarnings: 0, daysWorked: 0 });
            setNotifications(Array.isArray(ns) ? ns : []);
        } catch (e) {
            console.error("loadData error:", e);
            showToast("Error loading data. Please refresh.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user?.id) {
            setProfileForm({
                name: user.name || '',
                skills: Array.isArray(user.skills) ? user.skills.join(', ') : '',
                location: user.location || '',
            });
            loadData(user);
        }
    }, [user?.id]);

    // ── Early return AFTER all hooks ──
    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="spinner" /> Loading...
            </div>
        );
    }

    // ── Derived values (safe because user is guaranteed here) ──
    const hasApplied = (jobId) => applications.some(a => a.jobId === jobId);

    let filteredJobs = jobs.filter(j => j.status === 'open');
    if (searchQuery) {
        filteredJobs = filteredJobs.filter(j =>
            j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (j.location || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    if (userCoords) {
        filteredJobs.sort((a, b) => {
            const dA = parseFloat(calculateDistance(userCoords.lat, userCoords.lng, a.lat, a.lng)) || 9999;
            const dB = parseFloat(calculateDistance(userCoords.lat, userCoords.lng, b.lat, b.lng)) || 9999;
            return dA - dB;
        });
    }

    const selectedJobApp = applications.find(a => a.status === 'selected');
    const selectedJob = selectedJobApp ? jobs.find(j => j.id === selectedJobApp.jobId) : null;

    const userSkills = Array.isArray(user.skills) ? user.skills : [];
    const recommendations = userSkills.length > 0
        ? jobs.filter(j =>
            j.status === 'open' &&
            !hasApplied(j.id) &&
            userSkills.some(skill =>
                (j.title || '').toLowerCase().includes(skill.toLowerCase()) ||
                (j.description || '').toLowerCase().includes(skill.toLowerCase())
            )
        ).slice(0, 3)
        : jobs.filter(j => j.status === 'open' && !hasApplied(j.id)).slice(0, 2);

    const recentJobs = jobs.filter(j => j.status === 'open' && !hasApplied(j.id)).slice(0, 2);

    // ── Handlers ──
    const speakDirect = (text) => playAudio(text, i18n.language);
    const speakText = (key) => playAudio(t(key), i18n.language);

    const handleVoiceSearch = () => {
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("Voice search is not supported in this browser.", "error");
            return;
        }

        const recognition = new SpeechRecognition();
        const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
        recognition.lang = langMap[i18n.language] || 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setSearchQuery(transcript);
            // Optionally play a sound or toast here, but updating the bar is usually enough
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            setIsListening(false);
            if (event.error !== 'no-speech') {
                console.warn("Speech recognition error:", event.error);
                showToast("Voice search error. Please try again.", "error");
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const handleListenGuide = () => {
        const jobStatus = selectedJob ? t('job_assigned', { title: selectedJob.title }) : t('no_job_assigned');
        const guideText = t('dashboard_guide_worker', {
            name: user.name || 'Worker',
            score: stats?.trustScore || 100,
            apps: applications.length,
            jobStatus: jobStatus
        });
        speakDirect(guideText);
    };

    const handleApply = async (jobId) => {
        setIsApplying(true);
        try {
            await applyForJob(jobId, user.id);
            speakText('applied');
            await loadData(user);
            showToast("Application successful!", "success");
        } catch (e) {
            showToast("Failed to apply. Try again.", "error");
        } finally {
            setIsApplying(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        try {
            const updated = await updateProfile(user.id, {
                name: profileForm.name,
                skills: profileForm.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
                location: profileForm.location,
            });
            loginUser({ ...user, ...updated });
            showToast(t('profile_updated'), "success");
        } catch (err) {
            showToast("Failed to update profile.", "error");
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsLoading(true);
        try {
            const storageRef = ref(storage, `avatars/${user.id}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            const updated = await updateProfile(user.id, { avatarUrl: downloadURL });
            loginUser({ ...user, ...updated });
            showToast("Photo uploaded!", "success");
        } catch (err) {
            showToast("Failed to upload image.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // ── Render ──
    return (
        <div className="main-content-fluid" style={{ paddingBottom: '80px' }}>
            {/* Global Loading Indicator */}
            {isLoading && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', background: 'var(--primary-color)', zIndex: 9999 }} />
            )}

            {/* ── WORKER HERO HEADER ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 60%, #6366f1 100%)',
                padding: '2rem 1.5rem 3rem',
                position: 'relative', overflow: 'hidden', color: 'white'
            }}>
                {/* Decorative blobs */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                <div style={{ position: 'absolute', bottom: '-60px', left: '10%', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

                <div className="app-container" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div onClick={() => setView('settings')} style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}>
                            {user.avatarUrl
                                ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                                : <User size={32} style={{ margin: '14px', color: 'white' }} />}
                        </div>
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.2rem' }}>Worker Dashboard</p>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'white', fontWeight: 800 }}>{user.name || 'Worker'}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.35rem' }}>
                                <div style={{ width: '120px', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: `${stats?.trustScore || 100}%`, 
                                        background: getTrustColor(stats?.trustScore || 100), 
                                        transition: 'width 1.5s ease',
                                    }} />
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 800 }}>{stats?.trustScore || 100}% Trust</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleListenGuide} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                            <Volume2 size={20} />
                        </button>
                        <button onClick={() => { logout(); window.location.reload(); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }} title="Sign Out">
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="app-container" style={{ marginTop: '-1.5rem', borderRadius: '24px 24px 0 0', background: 'var(--bg-color)', padding: '1.5rem 1rem' }}>


            {/* ── HOME VIEW ── */}
            {view === 'home' && (
                <div className="animate-in web-grid-parent">
                    {/* LEFT COLUMN: Activity & Jobs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Today's Status */}
                        <div className="card glass-card hover-glow" style={{ borderLeft: '4px solid var(--primary-color)', margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)' }}>
                                    <Calendar size={16} /> {t('today_status') || "Today's Status"}
                                </h4>
                                {selectedJob && <span className="badge badge-selected pulse">Working Now</span>}
                            </div>
                            {selectedJob ? (
                                <div>
                                    <h3 style={{ margin: '0 0 0.4rem' }}>{selectedJob.title}</h3>
                                    <p style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                                        <MapPin size={14} color="var(--danger-color)" /> {selectedJob.location}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setView('applications')}>
                                            {t('view_details') || 'View Details'}
                                        </button>
                                        {selectedJobApp?.employerPhone && (
                                            <a href={`tel:${selectedJobApp.employerPhone}`} className="btn btn-outline btn-sm">
                                                <PhoneCall size={16} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                                    <p style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }}>No job assigned today.</p>
                                    <button className="btn btn-primary btn-sm" onClick={() => setView('jobs')}>
                                        Find Jobs <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="card earnings-card animate-in" style={{ marginBottom: '1.5rem', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('trust_score') || 'Trust Score'}</p>
                                <h1 style={{ fontSize: '3.5rem', margin: '0.5rem 0', fontWeight: '900', color: 'white' }}>{stats?.trustScore || 100}%</h1>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%' }}>
                                <ShieldCheck size={32} color="white" />
                            </div>
                        </div>
                        <div className="progress-bar-bg" style={{ height: '8px', background: 'rgba(255,255,255,0.2)' }}>
                            <div className="progress-bar-fill" style={{ width: `${stats?.trustScore || 100}%`, background: 'white', boxShadow: '0 0 15px rgba(255,255,255,0.5)' }} />
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.9 }}>
                            {stats?.trustScore >= 80 ? "✨ Elite Worker Status" : "📈 Keep working to improve your score!"}
                        </p>
                    </div>

                        {/* Recent Job Activity / Recommendations */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em' }}>{t('smart_recommendations') || 'Smart Recommendations'}</h4>
                            <button onClick={() => setView('jobs')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600 }}>{t('see_all') || 'See All'}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recommendations.slice(0, 3).map(job => (
                                <div key={job.id} className="card hover-lift" style={{ padding: '1rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px', fontSize: '1rem' }}>{job.title}</h4>
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>₹{job.wage} · {job.location}</p>
                                    </div>
                                    <button onClick={() => setView('jobs')} className="btn btn-primary btn-sm" style={{ width: 'auto', padding: '6px 16px' }}>Apply</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Stats & Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Quick Stats Grid */}
                        {stats && (
                            <div className="stats-grid" style={{ marginBottom: 0 }}>
                                <div className="stats-card">
                                    <FileText size={20} color="var(--info-color)" />
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', lineHeight: 1.1, marginTop: '5px' }}>{applications.length}</div>
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Applied</div>
                                </div>
                                <div className="stats-card">
                                    <Clock size={20} color="var(--secondary-color)" />
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', lineHeight: 1.1, marginTop: '5px' }}>{stats.daysWorked || 0}</div>
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Worked</div>
                                </div>
                            </div>
                        )}

                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h4 style={{ margin: '0 0 1rem', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('quick_actions') || 'Quick Actions'}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('jobs')}>
                                    <Briefcase size={16} /> Browse New Jobs
                                </button>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('applications')}>
                                    <FileText size={16} /> Application Status
                                </button>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('settings')}>
                                    <User size={16} /> Edit My Profile
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* ── JOBS VIEW ── */}
            {view === 'jobs' && (
                <div className="animate-in" style={{ padding: '0 1rem' }}>
                    <div className="form-group mb-4" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search style={{ position: 'absolute', left: '15px', top: '12px', color: '#9ca3af' }} size={18} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: '44px', width: '100%', margin: 0 }}
                                placeholder={t('search_jobs') || "e.g. Painter, Driver"}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleVoiceSearch}
                            className={`btn ${isListening ? 'btn-primary pulse' : 'btn-outline'}`}
                            style={{ padding: '0 14px', height: '42px', flexShrink: 0, borderRadius: '12px', borderColor: isListening ? 'transparent' : 'var(--border-color)' }}
                            title="Search by Voice"
                        >
                            <Mic size={20} color={isListening ? 'white' : 'var(--text-light)'} />
                        </button>
                    </div>
                    {filteredJobs.length === 0 && (
                        <p style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-light)' }}>No jobs found.</p>
                    )}
                    {filteredJobs.map(job => {
                        const distance = calculateDistance(userCoords?.lat, userCoords?.lng, job.lat, job.lng);
                        return (
                            <div key={job.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{job.title}</h3>
                                    {distance && <span className="badge badge-open" style={{ fontSize: '0.7rem' }}>📍 {distance} km</span>}
                                </div>
                                <p style={{ margin: '0.3rem 0' }}>💰 ₹{job.wage} &nbsp;·&nbsp; 📍 {job.location}</p>
                                {hasApplied(job.id) ? (
                                    <button className="btn btn-outline w-full" disabled><CheckCircle size={16} /> Applied</button>
                                ) : (
                                    <button className="btn btn-primary w-full" disabled={isApplying} onClick={() => handleApply(job.id)}>
                                        {isApplying ? <span className="spinner" /> : (t('apply') || 'Apply')}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── APPLICATIONS VIEW ── */}
            {view === 'applications' && (
                <div className="animate-in" style={{ padding: '0 1rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>{t('applications') || 'My Applications'}</h2>
                    {applications.length === 0 && (
                        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>No applications yet.</p>
                    )}
                    {applications.map(app => {
                        const job = jobs.find(j => j.id === app.jobId);
                        if (!job) return null;
                        return (
                            <div key={app.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0 }}>{job.title}</h3>
                                    <span className={`badge badge-${app.status}`}>{t(app.status) || app.status}</span>
                                </div>
                                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>📍 {job.location} · ₹{job.wage}</p>
                                {app.status === 'selected' && app.employerPhone && (
                                    <a href={`tel:${app.employerPhone}`} className="btn btn-secondary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <PhoneCall size={16} /> {t('call_employer') || 'Call Employer'}
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── SETTINGS VIEW ── */}
            {view === 'settings' && (
                <div className="animate-in" style={{ padding: '1rem' }}>
                    <div className="card text-center" style={{ marginBottom: '1rem' }}>
                        <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: '#f1f5f9', margin: '0 auto 1rem', overflow: 'hidden', border: '3px solid white', boxShadow: 'var(--shadow-md)' }}>
                            {user.avatarUrl
                                ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                                : <User size={45} style={{ marginTop: '22px', color: '#cbd5e1' }} />}
                        </div>
                        <h3 style={{ margin: '0 0 0.25rem' }}>{user.name}</h3>
                        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>{user.phone}</p>
                        <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>Change Photo</button>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handlePhotoUpload} />
                    </div>

                    <div className="card">
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Full Name</label>
                                <input className="form-input" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Skills (comma-separated)</label>
                                <input className="form-input" placeholder="e.g. Painter, Driver, Cook" value={profileForm.skills} onChange={e => setProfileForm({ ...profileForm, skills: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Location</label>
                                <input className="form-input" placeholder="e.g. Hyderabad" value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-primary w-full">Save Changes</button>
                        </form>
                    </div>

                    <button className="btn btn-ghost w-full" style={{ marginTop: '1rem' }} onClick={() => { logout(); window.location.reload(); }}>
                        Sign Out
                    </button>
                </div>
            )}
            </div>

            {/* Bottom Navigation Bar */}
            {/* ── BOTTOM NAV ── */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
                background: 'var(--card-bg)', backdropFilter: 'blur(20px)',
                borderTop: '1px solid var(--card-border)',
                display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000,
                width: '100%'
            }}>
                <div className="app-container" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', width: '100%', maxWidth: '1200px' }}>
                    {navItems.map(({ key, icon, label }) => (
                        <button key={key} onClick={() => setView(key)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                            color: view === key ? 'var(--primary-color)' : 'var(--text-light)',
                            position: 'relative', minWidth: '70px'
                        }}>
                            {key === 'messages' && (
                                <span style={{ position: 'absolute', top: '2px', right: '50%', transform: 'translateX(15px)', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger-color)' }} />
                            )}
                            {icon}
                            <span style={{ fontSize: '0.65rem', fontWeight: view === key ? 700 : 400 }}>{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WorkerDashboard;
