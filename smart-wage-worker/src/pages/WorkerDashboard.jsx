import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchJobs, fetchApplications, applyForJob, getUserStats, fetchNotifications, updateProfile, subscribeToJobs, subscribeToApplications, subscribeToNotifications, markAttendance, subscribeToAttendance, cancelApplication, updateLiveLocation, startGeoFence, updateGeoFenceLocation, uploadProfileImage } from '../api';
import { Volume2, Briefcase, FileText, User, Bell, CheckCircle, Search, PhoneCall, MapPin, Clock, Calendar, Star, Home, ArrowRight, LogOut, ShieldCheck, Mic, Map, List, Camera, X, Moon, Sun, TrendingUp, Check, Upload, Trash2, Info, Award, Crosshair, QrCode } from 'lucide-react';
import { playAudio } from '../utils/audio';
import { calculateDistance } from '../utils/geoUtils';
import { useToast } from '../contexts/ToastContext';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useVoice } from '../contexts/VoiceContext';
import VoiceInput from '../components/VoiceInput';
import JobMap from '../components/JobMap';
import Skeleton, { CardSkeleton, StatsSkeleton } from '../components/Skeleton';
import WorkerBadges from '../components/WorkerBadges';
import WorkerAnalytics from '../components/WorkerAnalytics';
import ConfirmModal from '../components/ConfirmModal';
import Timeline from '../components/Timeline';
import Celebration from '../components/Celebration';
import WorkerQR from '../components/WorkerQR';
import { useGeoTracking } from '../hooks/useGeoTracking';
 // Removed duplicate lucide-react import

const WorkerDashboard = () => {
    const { t, i18n } = useTranslation();
    const { user, loginUser, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const { playGuide, voiceCommand, lastIntent } = useVoice();

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
    const [locationError, setLocationError] = useState(null);
    const [showMapView, setShowMapView] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', skills: '', location: '' });
    const [isProfiling, setIsProfiling] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [profilingStep, setProfilingStep] = useState(0); 
    const [isUploading, setIsUploading] = useState(false);
    const [confirmApplyJob, setConfirmApplyJob] = useState(null);
    const fileInputRef = useRef(null);
    const attendanceFileRef = useRef(null);
    const recognitionRef = useRef(null);
    const [newBadge, setNewBadge] = useState(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationData, setCelebrationData] = useState({ title: '', subtitle: '' });
    const [attendanceStatus, setAttendanceStatus] = useState('none'); // 'none', 'started', 'completed'
    const [activeAttendance, setActiveAttendance] = useState(null);
    const [confirmCancelApp, setConfirmCancelApp] = useState(null);
    const [showQRModal, setShowQRModal] = useState(false);
    const prevBadgesCount = useRef(0);
    const prevNotificationsCount = useRef(0);

    const { selectedApp, selectedJob } = useMemo(() => {
        const app = applications.find(a => a.status === 'selected');
        const job = app ? jobs.find(j => j.id === app.jobId) : null;
        return { selectedApp: app, selectedJob: job };
    }, [applications, jobs]);

    const { currentDistance, geofenceStatus, violationCount, locationError: geoTrackingError } = useGeoTracking(
        attendanceStatus === 'started',
        activeAttendance?.id,
        selectedJob?.id,
        selectedJob,
        user?.id
    );

    useEffect(() => {
        if (geoTrackingError) {
            setLocationError(geoTrackingError);
        }
    }, [geoTrackingError]);


    const navItems = [
        { key: 'home', icon: <Home size={22} />, label: t('nav_home') || 'Home' },
        { key: 'jobs', icon: <Briefcase size={22} />, label: t('nav_jobs') || 'Jobs' },
        { key: 'analytics', icon: <TrendingUp size={22} />, label: t('nav_growth') || 'Growth' },
        { key: 'applications', icon: <FileText size={22} />, label: t('nav_apps') || 'Apps' },
        { key: 'settings', icon: <User size={22} />, label: t('profile') || 'Profile' },
    ];

    // Using shared calculateDistance from geoUtils

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
                (pos) => {
                    setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setLocationError(null);
                },
                (err) => {
                    console.warn("Geolocation denied", err);
                    setLocationError("Location access denied. Please enable location to find nearby jobs.");
                }
            );
        } else {
            setLocationError("Location not supported by browser.");
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
        if (!user?.id) return;
        setProfileForm({
            name: user.name || '',
            skills: Array.isArray(user.skills) ? user.skills.join(', ') : '',
            location: user.location || '',
        });
        
        // Initial Fetch
        loadData(user);

        // Real-time Subscriptions
        const unsubJobs = subscribeToJobs(setJobs);
        const unsubApps = subscribeToApplications((allApps) => {
            const userApps = allApps.filter(a => a.workerId === user.id);
            setApplications(userApps);
            
            // Derive attendance status from selected job
            const selected = userApps.find(a => a.status === 'selected');
            if (selected) {
                // We'll also need to check the attendance collection for today
                // For simplicity in this demo, we'll use a listener or fetch
            }
        });
        const unsubNotifs = subscribeToNotifications(user.id, setNotifications);
        
        // Attendance listener for current job
        const unsubAtt = subscribeToAttendance((allAtt) => {
            const today = new Date().toISOString().split('T')[0];
            const myAtt = allAtt.find(att => att.workerId === user.id && att.date === today);
            if (myAtt) {
                setActiveAttendance(myAtt);
                if (myAtt.endTime) {
                    setAttendanceStatus('completed');
                } else if (myAtt.startTime) {
                    setAttendanceStatus('started');
                } else {
                    setAttendanceStatus('none');
                }
            } else {
                setActiveAttendance(null);
                setAttendanceStatus('none');
            }
        });
        
        const fetchStats = async () => {
            const us = await getUserStats(user.id);
            if (us) setStats(us);
        };
        fetchStats();
 
        return () => {
            unsubJobs();
            unsubApps();
            unsubNotifs();
            unsubAtt();
        };
    }, [user?.id]);

    // Global Voice Command Listener (REFACTORED WITH ADVANCED NLP)
    useEffect(() => {
        // If in Guided Profiling Mode, handle raw speech steps
        if (isProfiling && voiceCommand) {
            handleProfilingCommand(voiceCommand.text);
            return;
        }

        if (!lastIntent) return;
        
        switch (lastIntent.type) {
            case 'navigate': {
                const viewMap = {
                    'jobs': 'jobs',
                    'profile': 'settings',
                    'apps': 'applications',
                    'home': 'home',
                    'analytics': 'analytics',
                    'attendance': 'home', // Worker attendance summary is usually on home
                    'track': 'home'      // Map context for worker
                };
                
                const targetView = viewMap[lastIntent.view];
                if (targetView) {
                    setView(targetView);
                    if (lastIntent.view === 'jobs' && lastIntent.params?.query) {
                        setSearchQuery(lastIntent.params.query);
                    }
                }
                break;
            }
            
            case 'action':
                if (lastIntent.action === 'help') {
                    handleListenGuide();
                }
                break;
                
            default:
                break;
        }
    }, [lastIntent, voiceCommand, isProfiling]);

    // Profile Completion Celebration Logic
    useEffect(() => {
        if (!user) return;
        const fields = [user.name, user.skills, user.location, user.photoURL || user.avatarUrl];
        const completed = fields.filter(f => !!f).length;
        const total = fields.length;
        const strength = Math.round((completed / total) * 100);
        
        if (strength === 100 && !user.notifiedCompletion) {
            setCelebrationData({
                title: "100% Profile Strength!",
                subtitle: "Your profile is now verified and ready for premium jobs."
            });
            setShowCelebration(true);
            playAudio("Congratulations! Your profile is one hundred percent complete. You are now a verified top worker.", i18n.language);
            
            // Mark as notified in local state to prevent loop
            loginUser({ ...user, notifiedCompletion: true });
        }
    }, [user, i18n.language, loginUser]);

    // Geofencing is now managed by the useGeoTracking hook.


    // Natural Voice Greeting
    useEffect(() => {
        if (user && view === 'home') {
            const greeting = i18n.language === 'te' 
                ? "నమస్కారం! ఉండండి, మీ పనిని ఇంకా దగ్గరుండి చూద్దాం."
                : (i18n.language === 'hi' ? "नमस्ते! चलिए आपके काम पर नज़र रखते हैं。" : "Welcome! Let's keep a close eye on your work progress.");
            
            const timer = setTimeout(() => {
                playAudio(greeting, i18n.language);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [view, i18n.language]);

    useEffect(() => {
        if (stats?.badges?.length > prevBadgesCount.current && prevBadgesCount.current > 0) {
            setNewBadge(stats.badges[stats.badges.length - 1]);
        }
        if (stats?.badges) {
            prevBadgesCount.current = stats.badges.length;
        }
    }, [stats]);

    // ── Early return AFTER all hooks ──
    if (!user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="spinner" /> {t('loading') || 'Loading...'}
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


    const userSkills = Array.isArray(user.skills) ? user.skills : [];
    const recommendations = userSkills.length > 0
        ? jobs.filter(j =>
            j.status === 'open' &&
            !hasApplied(j.id) &&
            userSkills.some(skill =>
                (j.title || '').toLowerCase().includes((skill || '').toLowerCase()) ||
                (j.description || '').toLowerCase().includes((skill || '').toLowerCase())
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
        playGuide('workerDashboard');
    };


    const handleApply = async (jobId) => {
        setIsApplying(true);
        try {
            await applyForJob(jobId, user.id);
            speakText('applied');
            showToast(t('apply_success') + " " + t('wait_employer_choice'), "success");
        } catch (e) {
            showToast(t('apply_fail'), "error");
        } finally {
            setIsApplying(false);
            setConfirmApplyJob(null);
        }
    };

    const handleCancelApplication = (appId) => {
        setConfirmCancelApp(appId);
    };

    const handleConfirmCancel = async () => {
        if (!confirmCancelApp) return;
        
        setIsLoading(true);
        try {
            await cancelApplication(confirmCancelApp);
            showToast(t('app_cancelled') || "Application cancelled successfully", "success");
            // No need to manually reload, the subscribeToApplications listener handles it
        } catch (err) {
            showToast(t('cancel_fail'), "error");
        } finally {
            setIsLoading(false);
            setConfirmCancelApp(null);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        setIsUploading(true);
        try {
            const url = await uploadProfileImage(user.id, file);
            loginUser({ ...user, photoURL: url }); // Refresh user context with new photoURL
            showToast(t('profile_img_updated'), "success");
        } catch (err) {
            showToast(t('profile_img_fail'), "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleMarkAttendance = async () => {
        if (!selectedJob) {
            showToast(t('no_active_job_attendance'), "error");
            return;
        }
        
        const msg = attendanceStatus === 'started' 
            ? t('take_end_selfie') 
            : t('take_start_selfie');
            
        speakDirect(msg);
        attendanceFileRef.current?.click();
    };

    const processAttendance = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsCheckingIn(true);
        try {
            // 1. Get GPS Location
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });

            // 2. Convert to Base64 (Simple approach for MVP)
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result;
                
                const today = new Date().toISOString().split('T')[0];
                const type = attendanceStatus === 'started' ? 'end' : 'start';
                
                await markAttendance({
                    jobId: selectedJob.id,
                    workerId: user.id,
                    date: today,
                    type: type,
                    image: base64,
                    location: {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        timestamp: new Date().toISOString()
                    }
                });

                if (type === 'start') {
                    speakDirect(t('check_in_gps'));
                    setCelebrationData({ 
                        title: t('check_in_celebration'), 
                        subtitle: t('check_in_subtitle') 
                    });
                } else {
                    speakDirect(t('check_out_success'));
                    setCelebrationData({ 
                        title: t('work_completed'), 
                        subtitle: t('earnings_processed') 
                    });
                }
                
                setShowCelebration(true);
            };
        } catch (err) {
            console.error(err);
            showToast("Failed to mark attendance. Check GPS/Camera permissions.", "error");
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        if (e) e.preventDefault();
        const oldStrength = calculateProfileStrength();
        try {
            const updated = await updateProfile(user.id, {
                name: profileForm.name,
                skills: profileForm.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
                location: profileForm.location,
            });
            const newUser = { ...user, ...updated };
            loginUser(newUser);
            
            const newStrength = 0 + (newUser.name ? 25 : 0) + (newUser.skills?.length > 0 ? 25 : 0) + (newUser.location ? 25 : 0) + (newUser.avatarUrl || newUser.photoURL ? 25 : 0);
            
            if (newStrength === 100 && oldStrength < 100) {
                setCelebrationData({ 
                    title: t('profile_100_celebration'), 
                    subtitle: t('profile_100_subtitle') 
                });
                setShowCelebration(true);
            }

            showToast(t('profile_updated'), "success");
            return true;
        } catch (err) {
            showToast("Failed to update profile.", "error");
            return false;
        }
    };

    const calculateProfileStrength = () => {
        let score = 0;
        if (user.name) score += 25;
        if (user.skills && user.skills.length > 0) score += 25;
        if (user.location) score += 25;
        if (user.avatarUrl || user.photoURL) score += 25;
        return score;
    };
    const profileStrength = calculateProfileStrength();

    const startGuidedProfiling = () => {
        setIsProfiling(true);
        setProfilingStep(0);
        setView('settings');
        playAudio(t('guide_profile_name'), i18n.language);
    };

    const handleProfilingCommand = async (text) => {
        if (!isProfiling) return;
        
        if (profilingStep === 0) {
            setProfileForm(prev => ({ ...prev, name: text }));
            setProfilingStep(1);
            playAudio(t('guide_profile_skills'), i18n.language);
        } else if (profilingStep === 1) {
            setProfileForm(prev => ({ ...prev, skills: text }));
            setProfilingStep(2);
            playAudio(t('guide_profile_location'), i18n.language);
        } else if (profilingStep === 2) {
            setProfileForm(prev => ({ ...prev, location: text }));
            setIsProfiling(false);
            setProfilingStep(0);
            
            // Auto save
            const success = await handleProfileUpdate();
            if (success) {
                playAudio(t('profile_updated'), i18n.language);
            }
        }
    };

    const handleHearHistory = async () => {
        const completed = applications.filter(a => a.status === 'completed' || a.status === 'finished');
        if (completed.length === 0) {
            playAudio(t('no_history'), i18n.language);
            return;
        }

        playAudio(t('history_intro'), i18n.language);
        
        // Sequential audio feedback with real data
        for (let i = 0; i < completed.length; i++) {
            const app = completed[i];
            const job = jobs.find(j => j.id === app.jobId);
            if (job) {
                // Wait for intro or previous entry
                await new Promise(resolve => setTimeout(resolve, i === 0 ? 3000 : 4500)); 
                const msg = i18n.language === 'te' 
                    ? `${job.title} పనైపోయింది. మీరు ${job.wage} రూపాయలు సంపాదించారు.`
                    : i18n.language === 'hi'
                    ? `${job.title} काम पूरा हो गया। आपने ${job.wage} रुपये कमाए।`
                    : `Finished ${job.title} job. You earned ${job.wage} rupees.`;
                playAudio(msg, i18n.language);
            }
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
            showToast(t('profile_img_updated') || "Photo uploaded!", "success");
        } catch (err) {
            showToast(t('profile_img_fail') || "Failed to upload image.", "error");
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
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.2rem' }}>{t('worker_dashboard')}</p>
                            <h2 id="dashboard-header" style={{ margin: 0, fontSize: '1.5rem', color: 'white', fontWeight: 800 }}>{user.name || t('worker')}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.35rem' }}>
                                <div style={{ width: '120px', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                                    <div 
                                        className={stats?.trustScore >= 100 ? "progress-complete" : ""}
                                        style={{ 
                                            height: '100%', 
                                            width: `${stats?.trustScore || 100}%`, 
                                            background: getTrustColor(stats?.trustScore || 100), 
                                            transition: 'width 1.5s ease',
                                        }} 
                                    />
                                </div>
                                <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 800 }}>{t('trust_label', { count: stats?.trustScore || 100 })}</span>
                            </div>
                            <WorkerBadges badges={user.badges} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleListenGuide} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                            <Volume2 size={20} />
                        </button>
                        <button onClick={toggleTheme} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button onClick={() => { logout(); window.location.reload(); }} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }} title={t('sign_out') || "Sign Out"}>
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content area */}
            <div className="app-container" style={{ marginTop: '-1.5rem', borderRadius: '24px 24px 0 0', background: 'var(--bg-color)', padding: '1.5rem 1rem' }}>


            {/* ── LOADING VIEW (SKELETONS) ── */}
            {isLoading && view === 'home' && (
                <div className="animate-in web-grid-parent">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <Skeleton height="80px" borderRadius="16px" />
                            <Skeleton height="80px" borderRadius="16px" />
                        </div>
                        <CardSkeleton />
                        <Skeleton height="150px" borderRadius="24px" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <Skeleton height="20px" width="40%" />
                            <CardSkeleton />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <StatsSkeleton />
                        <CardSkeleton />
                    </div>
                </div>
            )}

            {/* ── HOME VIEW ── */}
            {view === 'home' && !isLoading && (
                <div className="animate-in web-grid-parent">
                    {/* LEFT COLUMN: Activity & Jobs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        {/* Accessibility Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <button 
                                    onClick={handleHearHistory}
                                    className="card flex items-center justify-center gap-2" 
                                    style={{ margin: 0, padding: '1rem', background: 'var(--bg-card)', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}
                                >
                                    <div style={{ background: 'rgba(99,102,241,0.1)', padding: '8px', borderRadius: '10px' }}>
                                        <Volume2 size={20} color="var(--primary-color)" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('hear_history')}</span>
                                </button>
                                <button 
                                    onClick={startGuidedProfiling}
                                    className="card flex items-center justify-center gap-2" 
                                    style={{ margin: 0, padding: '1rem', background: 'var(--bg-card)', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}
                                >
                                    <div style={{ background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '10px' }}>
                                        <Mic size={20} color="#059669" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('guided_setup')}</span>
                                </button>
                            </div>
                            <button 
                                onClick={() => setShowQRModal(true)}
                                className="card flex items-center justify-center gap-2" 
                                style={{ margin: 0, padding: '1rem', background: 'var(--bg-card)', border: '1.5px solid #e2e8f0', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', width: '100%', cursor: 'pointer' }}
                            >
                                <div style={{ background: 'rgba(217,119,6,0.1)', padding: '8px', borderRadius: '10px' }}>
                                    <QrCode size={20} color="#d97706" />
                                </div>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t('show_attendance_qr') || 'Show My Attendance QR'}</span>
                            </button>
                        </div>

                        {/* Guided Profiling Overlay Info */}
                        {isProfiling && (
                            <div className="animate-in" style={{ background: '#1e1b4b', color: 'white', padding: '1rem', borderRadius: '16px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '2px solid #4338ca', boxShadow: 'var(--shadow-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="pulse" style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444' }} />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{t('guided_setup_step')} {profilingStep + 1}/3</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>{t('say_answer_clearly')}</p>
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-ghost" style={{ color: 'white' }} onClick={() => setIsProfiling(false)}>{t('cancel')}</button>
                            </div>
                        )}

                        {/* VOICE ASSISTANT INDICATOR (NEW) */}
                        {isListening && (
                            <div className="animate-in" style={{ 
                                background: 'linear-gradient(90deg, #4f46e5, #0ea5e9)', 
                                color: 'white', padding: '0.75rem 1.25rem', borderRadius: '12px', 
                                marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px',
                                boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                            }}>
                                <div className="pulse-fast" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'white' }} />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.02em' }}>{t('assistant_listening') || 'Listening to you...'}</span>
                            </div>
                        )}

                        {/* Today's Status */}
                        <div className="card glass-card hover-glow" style={{ borderLeft: '4px solid var(--primary-color)', margin: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)' }}>
                                    <Calendar size={16} /> {t('today_status')}
                                </h4>
                                {selectedJob && <span className="badge badge-selected pulse">{t('working_now')}</span>}
                            </div>
                            {selectedJob ? (
                                <div>
                                    <h3 style={{ margin: '0 0 0.4rem' }}>{selectedJob.title}</h3>
                                    <p style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                                        <MapPin size={14} color="var(--danger-color)" /> {selectedJob.location}
                                    </p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setView('applications')}>
                                            {t('view_details')}
                                        </button>
                                        {selectedApp?.employerPhone && (
                                            <a 
                                                href={`tel:${selectedApp.employerPhone}`} 
                                                className="btn btn-outline btn-icon btn-sm"
                                                style={{ width: '42px', height: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                                title={t('call_employer') || 'Call Employer'}
                                            >
                                                <PhoneCall size={18} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                                    <p style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }}>{t('no_job_assigned_msg')}</p>
                                    <button className="btn btn-primary btn-sm" onClick={() => setView('jobs')}>
                                        {t('find_jobs_btn')} <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="card earnings-card animate-in" style={{ marginBottom: '1.5rem', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('trust_score')}</p>
                                <h1 style={{ fontSize: '3.5rem', margin: '0.5rem 0', fontWeight: '900', color: 'white', textShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>{stats?.trustScore || 100}%</h1>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '50%' }}>
                                <ShieldCheck size={32} color="white" />
                            </div>
                        </div>
                        <div className="progress-bar-bg" style={{ height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', padding: '2px', marginTop: '1.5rem' }}>
                            <div 
                                className={`progress-bar-fill ${stats?.trustScore >= 100 ? "progress-complete" : ""}`} 
                                style={{ 
                                    width: `${stats?.trustScore || 100}%`, 
                                    height: '100%',
                                    borderRadius: '20px',
                                    background: stats?.trustScore >= 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #ffffff, #e2e8f0)', 
                                    boxShadow: stats?.trustScore >= 100 ? '0 0 20px rgba(16, 185, 129, 0.6)' : '0 0 15px rgba(255,255,255,0.4)',
                                    transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                }} 
                            />
                        </div>
                        <p style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.9 }}>
                            {stats?.trustScore >= 80 ? t('elite_worker') : t('keep_working')}
                        </p>
                        
                        {/* ── GEO-FENCE STATUS PANEL ── */}
                        {attendanceStatus === 'started' && selectedJob && (() => {
                            const radius = selectedJob.radius || 100;
                            const isOutside = geofenceStatus === 'Outside Radius' ||
                                (geofenceStatus === null && currentDistance !== null && currentDistance > radius);
                            const accentColor = isOutside ? '#ef4444' : '#10b981';
                            const bgColor     = isOutside ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)';
                            const statusLabel = isOutside
                                ? (t('outside_work_area') || '🔴 Outside Work Area')
                                : (t('inside_work_area')  || '🟢 Inside Work Area');

                            return (
                                <div style={{
                                    background: bgColor,
                                    border: `1.5px solid ${accentColor}`,
                                    borderRadius: '16px',
                                    padding: '1rem 1.25rem',
                                    marginBottom: '1rem',
                                    transition: 'all 0.4s ease',
                                }}>
                                    {/* Header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="pulse" style={{
                                                width: '12px', height: '12px',
                                                borderRadius: '50%',
                                                background: accentColor,
                                                flexShrink: 0,
                                            }} />
                                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: accentColor }}>
                                                {statusLabel}
                                            </span>
                                        </div>
                                        {violationCount > 0 && (
                                            <span style={{
                                                background: '#fef2f2',
                                                color: '#ef4444',
                                                border: '1px solid #fecaca',
                                                borderRadius: '20px',
                                                padding: '2px 10px',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                            }}>
                                                ⚠️ {violationCount} {t('violations') || 'violation(s)'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Metric grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                        <div style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontWeight: 600, marginBottom: '2px' }}>
                                                {t('current_distance') || 'Current Distance'}
                                            </div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: accentColor }}>
                                                {currentDistance !== null
                                                    ? `${Math.round(currentDistance)} m`
                                                    : <span className="spinner" style={{ width: 14, height: 14 }} />}
                                            </div>
                                        </div>
                                        <div style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', fontWeight: 600, marginBottom: '2px' }}>
                                                {t('allowed_radius') || 'Allowed Radius'}
                                            </div>
                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                                                {radius} m
                                            </div>
                                        </div>
                                    </div>

                                    {/* Job name sub-label */}
                                    <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <MapPin size={12} />
                                        {selectedJob.title} · {t('tracking_active') || 'Tracking active — updates every 30 s'}
                                    </div>
                                </div>
                            );
                        })()}


                        {locationError && (
                            <div className="card" style={{ 
                                padding: '1rem', 
                                marginBottom: '1rem', 
                                background: 'rgba(239, 68, 68, 0.05)', 
                                border: '1px solid #ef4444', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '10px',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <Info size={18} /> {locationError}
                                </div>
                                <button 
                                    className="btn btn-sm btn-outline" 
                                    style={{ width: 'auto', borderColor: '#ef4444', color: '#ef4444' }}
                                    onClick={() => loadData(user)}
                                >
                                    {t('retry')}
                                </button>
                            </div>
                        )}

                        {/* NEW: ATTENDANCE CHECK-IN */}
                        <button 
                            onClick={handleMarkAttendance}
                            disabled={isCheckingIn || attendanceStatus === 'completed'}
                            className="btn w-full btn-secondary" 
                            style={{ 
                                marginTop: '1.5rem', 
                                background: attendanceStatus === 'completed' ? 'var(--bg-card)' : 'white', 
                                color: attendanceStatus === 'completed' ? 'var(--text-light)' : 'var(--primary-color)', 
                                border: 'none', 
                                padding: '1.2rem', 
                                borderRadius: '16px',
                                fontSize: '1.1rem',
                                fontWeight: 800,
                                boxShadow: attendanceStatus === 'completed' ? 'none' : '0 10px 20px rgba(0,0,0,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}
                        >
                            <Camera size={24} />
                            {isCheckingIn ? (t('processing') || "Processing...") : 
                             (attendanceStatus === 'completed' ? t('work_done_today') : 
                              (attendanceStatus === 'started' ? t('end_work') : t('start_work')))}
                        </button>
                        <input type="file" ref={attendanceFileRef} hidden accept="image/*" capture="camera" onChange={processAttendance} />
                    </div>

                        {/* Nearby Jobs Section */}
                        {userCoords && (
                            <div id="nearby-jobs-home" style={{ marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em' }}>
                                        <MapPin size={12} style={{ marginRight: '4px' }} /> {t('nearby_jobs_label')}
                                    </h4>
                                    <button onClick={() => setView('jobs')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600 }}>
                                        {t('view_all_nearby')}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {(() => {
                                        const nearby = jobs
                                            .map(job => ({
                                                ...job,
                                                distance: userCoords && job.lat && job.lng ? (parseFloat(calculateDistance(userCoords.lat, userCoords.lng, job.lat, job.lng)) / 1000) : null
                                            }))
                                            .filter(j => j.distance !== null)
                                            .sort((a, b) => a.distance - b.distance)
                                            .slice(0, 3);

                                        if (nearby.length === 0) return <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', textAlign: 'center' }}>No jobs found nearby.</p>;

                                        return nearby.map((job, index) => (
                                            <div key={job.id} className="card hover-lift" style={{ padding: '0.85rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', position: 'relative' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{job.title}</h4>
                                                        {index === 0 && (
                                                            <span className="badge" style={{ background: 'var(--secondary-color)', color: 'white', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px' }}>
                                                                {t('closest')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                                                        ₹{job.wage} · 📍 {job.distance < 1 ? t('distance_meters_away', { count: Math.round(job.distance * 1000) }) : t('distance_away', { count: job.distance.toFixed(1) })}
                                                    </p>
                                                </div>
                                                <button onClick={() => setView('jobs')} className="btn btn-primary btn-sm" style={{ width: 'auto', padding: '5px 12px', fontSize: '0.75rem' }}>{t('details')}</button>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Recent Job Activity / Recommendations */}
                        <div id="recommended-jobs" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', marginBottom: '0.5rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em' }}>{t('smart_recommendations')}</h4>
                            <button onClick={() => setView('jobs')} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 600 }}>{t('see_all')}</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recommendations.length > 0 ? recommendations.slice(0, 3).map(job => (
                                <div key={job.id} className="card hover-lift" style={{ padding: '1rem', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem' }}>{job.title}</h4>
                                            {job.wage > 800 && <span className="badge badge-selected" style={{ fontSize: '0.6rem' }}>{t('high_pay')}</span>}
                                        </div>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>₹{job.wage} · {job.location}</p>
                                    </div>
                                    <button onClick={() => setConfirmApplyJob(job)} className="btn btn-primary btn-sm" style={{ width: 'auto', padding: '6px 16px' }}>{t('apply')}</button>
                                </div>
                            )) : (
                                <div className="empty-state" style={{ padding: '1rem' }}>
                                    <p style={{ fontSize: '0.85rem' }}>{t('no_stats_yet') || 'No recommendations yet. Complete your profile!'}</p>
                                </div>
                            )}
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
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('applied_stat')}</div>
                                </div>
                                <div className="stats-card">
                                    <Clock size={20} color="var(--secondary-color)" />
                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', lineHeight: 1.1, marginTop: '5px' }}>{stats.daysWorked || 0}</div>
                                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('worked_stat')}</div>
                                </div>
                            </div>
                        )}

                        <div id="quick-actions" className="card" style={{ padding: '1.25rem' }}>
                            <h4 style={{ margin: '0 0 1rem', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('quick_actions') || 'Quick Actions'}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('jobs')}>
                                    <Briefcase size={16} /> {t('browse_jobs_btn')}
                                </button>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('applications')}>
                                    <FileText size={16} /> {t('app_status_btn')}
                                </button>
                                <button className="btn btn-outline btn-sm w-full text-left" style={{ justifyContent: 'flex-start', padding: '0.75rem' }} onClick={() => setView('settings')}>
                                    <User size={16} /> {t('edit_profile')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* ── JOBS VIEW ── */}
            {view === 'jobs' && (
                <div className="animate-in" style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '2rem' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '1.4rem', margin: 0 }}>{userCoords ? t('jobs_near_you') || 'Jobs Near You' : t('all_jobs') || 'All Jobs'}</h2>
                            {locationError && <p style={{ fontSize: '0.8rem', color: 'var(--danger-color)', margin: '4px 0 0' }}>{locationError}</p>}
                        </div>
                        {userCoords && (
                            <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <button 
                                    className={`btn btn-sm ${!showMapView ? 'btn-primary' : 'btn-ghost'}`} 
                                    onClick={() => setShowMapView(false)}
                                    style={{ padding: '6px 12px' }}
                                >
                                    <List size={14} style={{ marginRight: '4px' }} /> {t('list_view')}
                                </button>
                                <button 
                                    className={`btn btn-sm ${showMapView ? 'btn-primary' : 'btn-ghost'}`} 
                                    onClick={() => setShowMapView(true)}
                                    style={{ padding: '6px 12px' }}
                                >
                                    <Map size={14} style={{ marginRight: '4px' }} /> {t('map_view')}
                                </button>
                            </div>
                        )}
                    </div>

                    {!showMapView && (
                        <div className="form-group mb-2" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                title={t('voice_search')}
                            >
                                <Mic size={20} color={isListening ? 'white' : 'var(--text-light)'} />
                            </button>
                        </div>
                    )}

                    {(() => {
                        const jobsWithDistance = jobs.map(job => {
                            let distance = null;
                            if (userCoords && job.lat && job.lng) {
                                distance = parseFloat(calculateDistance(userCoords.lat, userCoords.lng, job.lat, job.lng)) / 1000;
                            }
                            return { ...job, distance };
                        });

                        let availableJobs = jobsWithDistance.filter(job => 
                            job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            job.location.toLowerCase().includes(searchQuery.toLowerCase())
                        );

                        if (userCoords) {
                            availableJobs = availableJobs.filter(job => job.distance === null || job.distance <= 15);
                            availableJobs.sort((a, b) => {
                                if (a.distance === null) return 1;
                                if (b.distance === null) return -1;
                                return a.distance - b.distance;
                            });
                        }

                        if (showMapView) {
                            return <JobMap userCoords={userCoords} jobs={availableJobs} />;
                        }

                        return availableJobs.length === 0 ? (
                            <div className="empty-state animate-in">
                                <div className="empty-illustration">
                                    <Briefcase size={64} />
                                </div>
                                <h3>{t('no_jobs_near') || 'No jobs available near you'}</h3>
                                <p>{t('check_back_later') || 'Please check back in a few hours for new opportunities.'}</p>
                            </div>
                        ) : availableJobs.map(job => (
                            <div key={job.id} className="card glass-card hover-scale animate-in" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
                                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{job.title}</h3>
                                            {job.wage > 700 && (
                                                <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <TrendingUp size={10} /> {t('high_pay')}
                                                </span>
                                            )}
                                            {job.distance !== null && job.distance <= 2 && (
                                                <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                                                    <MapPin size={10} /> {t('nearest')}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                                            <MapPin size={14} color="var(--danger-color)" /> {job.location}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                            <div style={{ background: 'var(--primary-soft)', color: 'var(--primary-color)', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', fontSize: '1rem' }}>
                                                ₹{job.wage}
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 500 }}>/ day</span>
                                        </div>
                                    </div>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: 'auto', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, borderRadius: '12px' }}
                                        onClick={() => setConfirmApplyJob(job)}
                                        disabled={isApplying}
                                    >
                                        {t('apply_btn')}
                                    </button>
                                </div>
                                <div style={{ background: 'rgba(99,102,241,0.05)', padding: '0.75rem', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--text-slate)', border: '1px dashed var(--primary-soft)' }}>
                                    <Info size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                    {job.description || t('no_description')}
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            )}

            {/* ── APPLICATIONS VIEW ── */}
            {view === 'applications' && (
                <div id="my-applications" className="animate-in" style={{ padding: '0 1rem' }}>
                    <h2 style={{ marginBottom: '1rem' }}>{t('view_apps')}</h2>
                    {applications.length === 0 && (
                        <div className="empty-state animate-in">
                            <div className="empty-illustration">
                                <FileText size={64} />
                            </div>
                            <h3>{t('no_apps_yet')}</h3>
                            <p>{t('no_apps_msg')}</p>
                            <button className="btn btn-primary btn-sm" onClick={() => setView('jobs')}>{t('browse_jobs_btn')}</button>
                        </div>
                    )}
                    {applications.map(app => {
                        const job = jobs.find(j => j.id === app.jobId);
                        if (!job) return null;
                        return (
                            <div key={app.id} className="card animate-in hover-lift">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{job.title}</h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>📍 {job.location} · <span style={{ color: 'var(--secondary-color)', fontWeight: 700 }}>₹{job.wage}</span></p>
                                    </div>
                                    <span className={`badge badge-${app.status}`} style={{ padding: '0.5rem 1rem' }}>{t(app.status) || app.status}</span>
                                </div>
                                
                                <Timeline currentStatus={app.status === 'pending' ? 'applied' : (app.status === 'selected' ? 'selected' : (app.status === 'completed' ? 'paid' : 'applied'))} />

                                {app.status === 'selected' && (
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                        <a 
                                            href={`tel:${app.employerPhone}`} 
                                            className="btn btn-secondary" 
                                            style={{ flex: 2, fontSize: '1rem' }}
                                        >
                                            <PhoneCall size={20} /> {t('call_employer') || 'Call Employer'}
                                        </a>
                                        <button 
                                            className="btn btn-outline"
                                            style={{ flex: 1 }}
                                            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`, '_blank')}
                                        >
                                            <Map size={20} /> {t('directions') || 'Map'}
                                        </button>
                                    </div>
                                )}
                                
                                {app.status === 'pending' && (
                                    <button 
                                        className="btn btn-outline btn-sm w-full" 
                                        style={{ marginTop: '1rem', color: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
                                        onClick={() => handleCancelApplication(app.id)}
                                    >
                                        <Trash2 size={16} /> {t('cancel_application') || 'Cancel Application'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── ANALYTICS VIEW ── */}
            {view === 'analytics' && (
                <div id="worker-analytics" className="app-container" style={{ padding: '0 1rem' }}>
                    <WorkerAnalytics stats={stats} />
                </div>
            )}

            {/* ── SETTINGS VIEW ── */}
            {view === 'settings' && (
                <div className="animate-in" style={{ padding: '0 1rem', paddingBottom: '2rem' }}>
                    <div className="card glass-card animate-in" style={{ padding: '1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--secondary-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>{t('profile_strength')}</h4>
                            <span style={{ fontWeight: 800, color: profileStrength >= 100 ? 'var(--secondary-color)' : 'var(--primary-color)' }}>{profileStrength}%</span>
                        </div>
                        <div className="progress-bar-bg" style={{ height: '8px', margin: 0 }}>
                            <div className={`progress-bar-fill ${profileStrength >= 100 ? "progress-complete" : ""}`} style={{ width: `${profileStrength}%` }} />
                        </div>
                        <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                            {profileStrength < 100 
                                ? t('profile_strength_hint_low')
                                : t('profile_strength_hint_high')}
                        </p>
                    </div>

                    <div className={`card text-center animate-in ${profileStrength >= 100 ? "glow-success" : ""}`} style={{ padding: '2.5rem 1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
                        {profileStrength >= 100 && (
                            <div style={{ position: 'absolute', top: '15px', right: '15px', background: 'var(--secondary-color)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Award size={12} /> 100% VERIFIED
                            </div>
                        )}
                        <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto 1.5rem' }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--primary-soft)', overflow: 'hidden', border: '4px solid white', boxShadow: 'var(--shadow-lg)' }}>
                                {user.photoURL
                                    ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                                    : <User size={60} style={{ marginTop: '30px', color: 'var(--primary-color)' }} />}
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="btn btn-primary btn-icon" 
                                style={{ position: 'absolute', bottom: '0', right: '0', width: '38px', height: '38px', boxShadow: 'var(--shadow-md)' }}
                                disabled={isUploading}
                            >
                                {isUploading ? <div className="spinner-sm" /> : <Camera size={18} />}
                            </button>
                        </div>
                        
                        <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.75rem' }}>{user.name}</h2>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '1rem', color: 'var(--text-light)', fontWeight: 600 }}>{user.phone}</p>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
                            {user.skills?.length > 0 ? user.skills.map(skill => (
                                <span key={skill} className="skill-tag">{skill}</span>
                            )) : <span className="text-sm text-light">No skills added yet</span>}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button className="btn btn-outline" style={{ borderRadius: '16px' }} onClick={startGuidedProfiling}>
                                <Mic size={18} /> {t('voice_setup')}
                            </button>
                            <button className="btn btn-ghost" style={{ borderRadius: '16px' }} onClick={() => { logout(); window.location.reload(); }}>
                                <LogOut size={18} /> {t('logout')}
                            </button>
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageUpload} />
                    </div>

                    <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{t('update_info') || 'Update My Info'}</h3>
                        <form onSubmit={handleProfileUpdate}>
                            <div className="form-group">
                                <label className="form-label">{t('full_name')}</label>
                                <VoiceInput value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('skills_label') || 'Skills (comma-separated)'}</label>
                                <VoiceInput placeholder="e.g. Painter, Driver, Cook" value={profileForm.skills} onChange={e => setProfileForm({ ...profileForm, skills: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('location_label') || 'Location'}</label>
                                <VoiceInput placeholder="e.g. Hyderabad" value={profileForm.location} onChange={e => setProfileForm({ ...profileForm, location: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-primary w-full" style={{ padding: '1.1rem', fontSize: '1.1rem' }}>
                                {t('save_details') || 'Save Details'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* ── NEW BADGE CELEBRATION ── */}
            {newBadge && (
                <div className="glass-modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="glass-modal-content animate-in" style={{ textAlign: 'center', maxWidth: '340px', padding: '2.5rem 2rem' }}>
                        <div style={{ fontSize: '4.5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.4))' }}>🏆</div>
                        <h2 className="text-gradient-gold" style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#f59e0b' }}>New Achievement!</h2>
                        <p style={{ color: 'var(--text-dark)', marginBottom: '2rem', fontSize: '1rem', lineHeight: 1.6 }}>
                            You've earned the <br/><strong style={{ fontSize: '1.2rem' }}>{newBadge.replace(/_/g, ' ')}</strong><br/> badge for your exceptional reliability!
                        </p>
                        <button className="btn btn-primary" onClick={() => setNewBadge(null)} style={{ width: '100%', padding: '1rem', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 800 }}>
                            CONTINUE
                        </button>
                    </div>
                </div>
            )}

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

             {/* ── MODALS ── */}
             <ConfirmModal 
                 isOpen={!!confirmApplyJob}
                 onClose={() => setConfirmApplyJob(null)}
                 onConfirm={() => handleApply(confirmApplyJob?.id)}
                 title={t('confirm_application') || "Confirm Application"}
                 message={t('apply_confirm_msg', { job: confirmApplyJob?.title }) || `Do you want to apply for the ${confirmApplyJob?.title} job?`}
                 confirmText={t('apply_now') || "Apply Now"}
                 isLoading={isApplying}
                 type="primary"
             />

             {/* ── CELEBRATION OVERLAY ── */}
             {showCelebration && (
                 <Celebration 
                    title={celebrationData.title} 
                    subtitle={celebrationData.subtitle} 
                    onComplete={() => setShowCelebration(false)} 
                />
             )}

             {/* Success Overlay */}
             {/* ── CONFIRM CANCEL MODAL ── */}
             <ConfirmModal 
                 isOpen={!!confirmCancelApp}
                 onClose={() => setConfirmCancelApp(null)}
                 onConfirm={handleConfirmCancel}
                 title={t('cancel_app_title') || "Cancel Application"}
                 message={t('confirm_cancel_app') || "Are you sure you want to cancel this application?"}
                 confirmText={t('confirm') || "Yes, Cancel"}
                 cancelText={t('cancel') || "No, Keep"}
                 type="danger"
             />

             {/* ── ATTENDANCE QR CODE MODAL ── */}
             {showQRModal && (
                 <div className="glass-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setShowQRModal(false)}>
                     <div className="glass-modal-content animate-in" style={{ maxWidth: '360px', padding: '1rem', background: 'white', borderRadius: '24px', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem', zIndex: 10 }}>
                             <button className="btn btn-sm btn-ghost" style={{ width: 'auto', padding: '0.5rem', cursor: 'pointer' }} onClick={() => setShowQRModal(false)}>
                                 <X size={20} />
                             </button>
                         </div>
                         <WorkerQR workerId={user.id} workerName={user.name} />
                     </div>
                 </div>
             )}

             {showSuccessOverlay && (
                 <div className="animate-in" style={{
                     position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                     background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     zIndex: 2000, padding: '2rem'
                 }}>
                     <div className="card" style={{ 
                         background: 'white', textAlign: 'center', padding: '3rem 2rem', 
                         borderRadius: '32px', maxWidth: '400px', width: '100%',
                         boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                         animation: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                     }}>
                         <div style={{ 
                             width: '80px', height: '80px', background: 'var(--secondary-color)', 
                             color: 'white', borderRadius: '50%', display: 'flex', 
                             alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                             boxShadow: '0 0 20px var(--secondary-soft)'
                         }}>
                             <Check size={40} strokeWidth={3} />
                         </div>
                         <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: '#1e1b4b' }}>{t('attendance_marked')}</h2>
                         <p style={{ color: '#64748b', fontSize: '1.1rem' }}>{t('wonderful_day', { name: user.name })}</p>
                     </div>
                 </div>
             )}
         </div>
     );
 };

export default WorkerDashboard;
