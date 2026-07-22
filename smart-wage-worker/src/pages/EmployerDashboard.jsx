import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { fetchJobs, createJob, fetchApplications, selectWorker, markAttendance, submitReview, fetchLeaves, updateLeaveStatus, fetchAttendance, subscribeToJobs, subscribeToApplications, subscribeToAttendance, subscribeToWorkerLocations, subscribeToActiveLocations, addNotification } from '../api';
import { Volume2, Briefcase, Plus, Star, Calendar, UserCheck, XCircle, Users, ChevronRight, BarChart2, CheckCircle, ClipboardList, LogOut, CheckSquare, TrendingUp, Bell, Award, Mic, PhoneCall, Camera as CamIcon, MapPin, Activity, HelpCircle, Map as MapIcon, Navigation } from 'lucide-react';
import TrackingMap from '../components/TrackingMap';
import { calculateDistance, DEFAULT_TRACKING_RADIUS } from '../utils/geoUtils';
import { playAudio } from '../utils/audio';
import { useToast } from '../contexts/ToastContext';
import { seedDemoData } from '../utils/seedDemoData';
import { useVoice } from '../contexts/VoiceContext';
import VoiceInput from '../components/VoiceInput';
import Skeleton, { CardSkeleton, StatsSkeleton } from '../components/Skeleton';
import WorkforceAnalytics from '../components/WorkforceAnalytics';
import ConfirmModal from '../components/ConfirmModal';
import Timeline from '../components/Timeline';
import Celebration from '../components/Celebration';
import GlobalTrackMap from '../components/GlobalTrackMap';
import QRScanner from '../components/QRScanner';
import GeoFenceHistoryList from '../components/GeoFenceHistoryList';
import { X, TrendingUp as TrendingIcon, Moon, Sun, Camera, Image as ImageIcon, MapPin as PinIcon, Search, Layout } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const workerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const EmployerDashboard = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const { playGuide, lastIntent } = useVoice();
    const lastNotifiedRef = useRef({});
    const [jobs, setJobs] = useState([]);
    const [trackingRadius, setTrackingRadius] = useState(DEFAULT_TRACKING_RADIUS);
    const [applications, setApplications] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [simulating, setSimulating] = useState(false);
    const [view, setView] = useState('home');
    const [loading, setLoading] = useState(false);
    const [formJob, setFormJob] = useState({ title: '', location: '', wage: '', description: '', radius: 100 });
    const [isListeningMagic, setIsListeningMagic] = useState(false);
    const [isReviewingMagic, setIsReviewingMagic] = useState(false);
    const [magicData, setMagicData] = useState(null);
    const [showAttMap, setShowAttMap] = useState(false);
    const [showGlobalTrack, setShowGlobalTrack] = useState(true);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationData, setCelebrationData] = useState({ title: '', subtitle: '' });
    const [showScanner, setShowScanner] = useState(false);
    const [confirmSelectWorker, setConfirmSelectWorker] = useState(null);

    // Automatic Demo Seeding for Suresh Babu
    useEffect(() => {
        const seedDemoLocation = async () => {
            if (view === 'track' && user?.id === 'mock_user_1234567890') {
                const mockWorkerId = 'mock_user_1234567890';
                const sureshBabu = activeWorkers.find(w => w.id === mockWorkerId);
                
                // If Suresh Babu is not online or has no location, seed a default near his jobsite
                if (!sureshBabu?.currentLocation) {
                    const { updateLiveLocation } = await import('../api');
                    const refJob = jobs[0] || { lat: 17.6868, lng: 83.2185 }; // Default to Vizag
                    await updateLiveLocation(mockWorkerId, { lat: refJob.lat + 0.002, lng: refJob.lng + 0.002 });
                    console.log("Demo: Suresh Babu location seeded automatically.");
                }
            }
        };
        seedDemoLocation();
    }, [view, activeWorkers, user, jobs]);
    const [isPaying, setIsPaying] = useState(false);
    const [workerLocations, setWorkerLocations] = useState({});

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
        setAttendance(Array.isArray(atts) ? atts : []);

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
                    setAttendance(Array.isArray(atts2) ? atts2 : []);
                }
            } catch (e) {
                console.warn('Auto-seed failed:', e);
            }
        }
    };

    useEffect(() => {
        if (!user?.id) return;
        
        // Initial Fetch
        loadData(true);

        // Real-time Subscriptions
        const unsubJobs = subscribeToJobs((allJobs) => {
            setJobs(allJobs.filter(j => j.employerId === user.id));
        });
        
        const unsubApps = subscribeToApplications((allApps) => {
            // Need the latest jobs for filtering apps
            fetchJobs().then(allJs => {
                const myJobIds = allJs.filter(j => j.employerId === user.id).map(j => j.id);
                setApplications(allApps.filter(a => myJobIds.includes(a.jobId)));
            });
        });

        // Attendance listener
        const unsubAtt = subscribeToAttendance((allAtt) => {
            setAttendance(allAtt);
        });

        // Live Location listener
        const unsubLoc = subscribeToWorkerLocations((allLocs) => {
            setWorkerLocations(allLocs);
        });

        // Active Workers listener (for detailed live tracking)
        const unsubActive = subscribeToActiveLocations((workers) => {
            setActiveWorkers(workers);
            
            // Proximity Alert Logic
            workers.forEach(w => {
                const assignedJob = jobs.find(j => {
                    const app = applications.find(a => a.workerId === w.id && a.jobId === j.id && a.status === 'selected');
                    return !!app;
                });

                if (assignedJob && assignedJob.lat && assignedJob.lng && w.currentLocation) {
                    const dist = calculateDistance(assignedJob.lat, assignedJob.lng, w.currentLocation.lat, w.currentLocation.lng);
                    if (dist > trackingRadius) {
                        // 1. UI Toast (30s throttle)
                        if (!window.lastToastTime || Date.now() - window.lastToastTime > 30000) {
                            showToast(`${t('out_of_zone')} (${w.name})`, 'error');
                            window.lastToastTime = Date.now();
                        }
                        
                        // 2. Persistent Notification (5 min cooldown per worker)
                        const now = Date.now();
                        const lastNotified = lastNotifiedRef.current[w.id] || 0;
                        if (now - lastNotified > 300000) {
                            addNotification(user.id, t('worker_out_of_zone_msg', { name: w.name, job: assignedJob.title }), 'error');
                            lastNotifiedRef.current[w.id] = now;
                            console.log(`Persistent notification sent for ${w.name}`);
                        }
                    }
                }
            });
        });
        
        return () => {
            unsubJobs();
            unsubApps();
            unsubAtt();
            unsubLoc();
            unsubActive();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Global Voice Command Listener (REFACTORED WITH ADVANCED NLP)
    useEffect(() => {
        if (!lastIntent) return;
        
        if (lastIntent.type === 'navigate') {
            const viewMap = {
                'post': 'post',
                'attendance': 'attendance',
                'leaves': 'leaves',
                'home': 'home',
                'jobs': 'jobs',
                'track': 'track',
                'analytics': 'analytics',
                'profile': 'home'
            };
            const targetView = viewMap[lastIntent.view];
            if (targetView) setView(targetView);
        } else if (lastIntent.type === 'action' && lastIntent.action === 'help') {
            playGuide('employerDashboard');
        }
    }, [lastIntent, playGuide]);

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
            } catch {
                console.warn("Location permission not granted.");
            }
        }
        await createJob({ ...formJob, employerId: user.id, lat, lng, radius: Number(formJob.radius) || 100 });
        setCelebrationData({ 
            title: t('job_posted_celebration'), 
            subtitle: t('job_posted_subtitle') 
        });
        setShowCelebration(true);
        setFormJob({ title: '', location: '', wage: '', description: '', radius: 100 });
        setView('jobs');
        loadData();
        setLoading(false);
        showToast("Job posted successfully!", "success");
    };

    const handleSelectWorker = async (appId) => {
        setLoading(true);
        try {
            await selectWorker(appId);
            await loadData();
            showToast("Worker has been hired successfully!", "success");
            setConfirmSelectWorker(null);
        } catch {
            showToast("Failed to hire worker.", "error");
        } finally {
            setLoading(false);
        }
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
        setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const hired = applications.filter(a => a.status === 'selected');
            
            // Only mark those not already marked today
            const toMark = hired.filter(app => {
                const alreadyMarked = attendance.find(att => 
                    att.workerId === app.workerId && 
                    att.jobId === app.jobId && 
                    att.date === today
                );
                return !alreadyMarked;
            });

            if (toMark.length === 0) {
                showToast("All workers are already marked for today.", "info");
                setLoading(false);
                return;
            }

            await Promise.all(toMark.map(app => markAttendance({
                jobId: app.jobId,
                workerId: app.workerId,
                date: today,
                present: true
            })));
            
            showToast(`Marked ${toMark.length} workers as present.`, "success");
        } catch (e) {
            console.error(e);
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

        setIsPaying(true);
        try {
            // Bulk update logic simulation - in a real app, this would be a single API call
            showToast(`Processing payments for ${presentToday.length} workers...`, "info");
            // Simulate payment success
            await new Promise(resolve => setTimeout(resolve, 2000));
            showToast(`Successfully paid ₹${presentToday.length * 800} to all workers.`, "success");
        } catch {
            showToast("Payment failed.", "error");
        } finally {
            setIsPaying(false);
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
            const text = (event.results[0][0].transcript || '').toLowerCase();
            
            // Advanced Parsing Logic
            const titles = ["painter", "mason", "electrician", "driver", "maid", "laborer", "cleaner", "plumber", "పెయింటర్", "డ్రైవర్", "మేసన్", "ఎలక్ట్రీషియన్", "पेंटर", "ड्राइवर", "मजदूर"];
            const foundTitle = titles.find(t => text.includes(t)) || "General Worker";
            
            const wageMatch = text.match(/\d{3,4}/); // Match 3-4 digit numbers for wage
            const foundWage = wageMatch ? wageMatch[0] : "500";
            
            const locations = ["hyderabad", "mumbai", "delhi", "bangalore", "chennai", "hitech city", "madhapur", "హైదరాబాద్", "ముంబై", "హైటెక్ సిటీ"];
            const foundLocation = locations.find(l => text.includes(l)) || "Near Me";

            setMagicData({
                title: foundTitle.charAt(0).toUpperCase() + foundTitle.slice(1),
                location: foundLocation.charAt(0).toUpperCase() + foundLocation.slice(1),
                wage: foundWage,
                description: `Voice posted: ${text}`,
                raw: text
            });
            
            setIsReviewingMagic(true);
        };

        recognition.start();
    };

    const handleSimulateWorker = async (workerId, job) => {
        if (simulating) return;
        setSimulating(true);
        const { updateLiveLocation } = await import('../api');
        
        const refJob = job || jobs[0] || { lat: 17.4483, lng: 78.3915 };
        showToast(t('demo_loading') || "Starting demo...", "info");
        
        let step = 0;
        const steps = [
            { lat: refJob.lat + 0.005, lng: refJob.lng + 0.005 },
            { lat: refJob.lat + 0.004, lng: refJob.lng + 0.004 },
            { lat: refJob.lat + 0.003, lng: refJob.lng + 0.003 },
            { lat: refJob.lat + 0.002, lng: refJob.lng + 0.002 },
            { lat: refJob.lat + 0.001, lng: refJob.lng + 0.001 },
            { lat: refJob.lat + 0.0001, lng: refJob.lng + 0.0001 },
            { lat: refJob.lat, lng: refJob.lng },
        ];

        const interval = setInterval(async () => {
            if (step >= steps.length) {
                clearInterval(interval);
                setSimulating(false);
                showToast("Demo completed! Worker arrived at site.", "success");
                return;
            }
            await updateLiveLocation(workerId, steps[step]);
            step++;
        }, 3000);
    };

    const handleViewExampleMap = async () => {
        setLoading(true);
        try {
            const seeded = await seedDemoData(user.id);
            if (seeded) {
                await loadData();
                showToast("Example map loaded! Starting live tracking demonstration...", "success");
                if (view !== 'track') setView('track');
                handleSimulateWorker('mock_user_1234567890', jobs[0]);
            }
        } catch (e) {
            console.error("Demo failed:", e);
            showToast("Failed to load example map.", "error");
        } finally {
            setLoading(false);
        }
    };

    const confirmMagicPost = () => {
        setFormJob({
            title: magicData.title,
            location: magicData.location,
            wage: magicData.wage,
            description: magicData.description
        });
        setIsReviewingMagic(false);
        showToast("Details confirmed! You can now post the job.", "success");
    };

    const handleQRScanSuccess = async (data) => {
        const { workerId, name } = data;
        setShowScanner(false);
        
        // Find if this worker is hired for any of our jobs
        const hiredApp = applications.find(a => a.workerId === workerId && a.status === 'selected');
        
        if (hiredApp) {
            await markAttendance({
                jobId: hiredApp.jobId,
                workerId: workerId,
                date: new Date().toISOString().split('T')[0],
                present: true
            });
            showToast(`Attendance marked for ${name}!`, "success");
            loadData();
        } else {
            showToast(`Worker ${name} is not currently hired for any of your jobs.`, "error");
        }
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
        { key: 'home', icon: <BarChart2 size={22} />, label: t('nav_overview') },
        { key: 'jobs', icon: <Briefcase size={22} />, label: t('nav_jobs') },
        { key: 'track', icon: <Navigation size={22} />, label: t('nav_live_track') || 'Live Track' },
        { key: 'attendance', icon: <CheckSquare size={22} />, label: t('nav_attendance') },
        { key: 'post', icon: <Plus size={22} />, label: t('nav_post_job') },
        { key: 'analytics', icon: <TrendingIcon size={22} />, label: t('nav_analytics') },
    ];

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '80px', position: 'relative' }}>

            {/* ── VOICE REVIEW MODAL ── */}
            {isReviewingMagic && magicData && (
                <div className="glass-modal-overlay">
                    <div className="glass-modal-content">
                        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary-color)' }}>
                            <Mic size={24} /> {t('confirm_job_details')}
                        </h3>
                        <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px dashed var(--primary-color)', marginBottom: '1.5rem' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-dark)', fontStyle: 'italic', lineHeight: 1.5 }}>
                                "{magicData.raw}"
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase' }}>{t('pos_label')}</span>
                                <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{magicData.title}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase' }}>{t('wage_label')}</span>
                                <div style={{ fontWeight: 700, color: '#059669' }}>₹{magicData.wage} / day</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: '10px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase' }}>{t('loc_label')}</span>
                                <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{magicData.location}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={confirmMagicPost}>
                                <CheckCircle size={18} /> {t('confirm_btn') || 'Confirm'}
                            </button>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setIsReviewingMagic(false)}>
                                {t('cancel_btn') || 'Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VOICE ASSISTANT INDICATOR (NEW) */}
            {(isListeningMagic) && (
                <div id="voice-indicator-employer" className="animate-in" style={{ 
                    position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                    background: 'linear-gradient(90deg, #92400e, #f59e0b)', 
                    color: 'white', padding: '0.75rem 1.5rem', borderRadius: '99px', 
                    zIndex: 10000, display: 'flex', alignItems: 'center', gap: '12px',
                    boxShadow: '0 10px 25px rgba(146, 64, 14, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                    <div className="pulse-fast" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'white' }} />
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {t('assistant_listening') || 'Listening...'}
                    </span>
                </div>
            )}

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
                                ✦ {t('verified_employer')}
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
                            onClick={toggleTheme}
                            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
                            { label: t('active_jobs_label'), value: jobs.length, icon: '💼' },
                            { label: t('hired_label'), value: hiredCount, icon: '✅' },
                            { label: t('applications'), value: pendingApps, icon: '📋' },
                            { label: t('leaves'), value: pendingLeaves, icon: '📅' },
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

                {/* ── LOADING VIEW ── */}
                {loading && view === 'home' && (
                    <div className="animate-in web-grid-parent">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <Skeleton height="200px" borderRadius="24px" />
                            <Skeleton height="150px" borderRadius="18px" />
                            <CardSkeleton />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <CardSkeleton />
                            <StatsSkeleton />
                        </div>
                    </div>
                )}

                {/* ── HOME VIEW ── */}
                {view === 'home' && !loading && (
                    <div className="animate-in web-grid-parent">
                        {/* LEFT COLUMN: Activity & List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Summary Card with Sparkline */}
                            <div className="card earnings-card" style={{ padding: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('total_spend')}</p>
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
                                        <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', opacity: 0.65 }}>{t('wage_trend_label') || '7-day wage disbursement trend'}</p>
                                    </div>
                                <div style={{ display: 'flex', gap: '20px', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div id="active-jobs">
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>{t('active_jobs_label')}</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{jobs.filter(j => j.status === 'open').length}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>{t('workers_hired_label')}</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{hiredCount}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.7 }}>{t('fill_rate')}</p>
                                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {jobs.length > 0 ? Math.round((hiredCount / jobs.length) * 100) : 0}%
                                            {hiredCount >= jobs.length && jobs.length > 0 && <CheckCircle size={14} color="#10b981" />}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Hiring Pipeline */}
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h4 style={{ margin: '0 0 1rem', fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <TrendingUp size={14} color="#d97706" /> {t('hiring_pipeline_title')}
                                </h4>
                                {['pending', 'selected', 'rejected'].map(status => {
                                    const count = applications.filter(a => a.status === status).length;
                                    const total = applications.length || 1;
                                    const pct = Math.round((count / total) * 100);
                                    const colors = { pending: '#f59e0b', selected: '#10b981', rejected: '#f43f5e' };
                                    const labels = { pending: t('reviewing_label'), selected: t('hired_label'), rejected: t('rejected_label') };
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
                                            <Award size={14} color="#d97706" /> {t('top_talent')}
                                        </h4>
                                        <button onClick={() => setView('jobs')} style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>{t('view_all')} <ChevronRight size={12} /></button>
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
                                                        <span style={{ color: getTrustColor(app.workerTrustScore || 100), fontWeight: 700 }}>{t('trust_label', { count: app.workerTrustScore || 100 })}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                        <Briefcase size={10} /> {app.jobTitle || t('seeking_work')}
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
                                    <TrendingUp size={16} color="#d97706" /> {t('management_hub_title')}
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
                                            <span style={{ fontWeight: 700 }}>{t('post_job')}</span>
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
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{t('mark_daily_attendance')}</span>
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
                                            <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{t('manage_leaves')}</span>
                                        </div>
                                        <ChevronRight size={18} color="var(--text-light)" />
                                    </button>
                                </div>
                            </div>

                            {/* Quick Stats Summary */}
                            <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1.5px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: '0', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.05em' }}>{t('stats_quick_look')}</h4>
                                    <BarChart2 size={16} color="var(--text-light)" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                    <div style={{ textAlign: 'center', padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'var(--shadow-sm)' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-color)' }}>{jobs.length}</div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, marginTop: '4px' }}>{t('active_jobs_label')}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: '1.25rem', background: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'var(--shadow-sm)' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>{pendingApps}</div>
                                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 700, marginTop: '4px' }}>{t('applications')}</div>
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
                            <h2 style={{ margin: 0 }}>{t('my_job_posts')}</h2>
                            <button className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setView('post')}>
                                <Plus size={16} /> Post
                            </button>
                        </div>
                        {jobs.length === 0 ? (
                            <div className="empty-state animate-in">
                                <div className="empty-illustration">
                                    <Briefcase size={64} />
                                </div>
                                <h3>{t('no_jobs_posted') || 'No Jobs Posted'}</h3>
                                <p>{t('no_jobs_msg_employer') || 'You haven\'t posted any jobs yet. Start hiring by posting your first job!'}</p>
                                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.75rem 2rem' }} onClick={() => setView('post')}>
                                    {t('post_first_btn') || 'Post First Job'}
                                </button>
                            </div>
                        ) : jobs.map(job => (
                             <div key={job.id} className={`card ${applications.some(a => a.jobId === job.id && a.status === 'selected') ? 'glow-success' : ''}`} style={{ borderLeft: '4px solid #d97706', position: 'relative' }}>
                                {applications.some(a => a.jobId === job.id && a.status === 'selected') && (
                                    <div style={{ position: 'absolute', top: '15px', right: '100px', background: 'var(--secondary-color)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {t('full_staffed')}
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{job.title}</h3>
                                    <span className={`badge badge-${job.status}`} style={{ fontSize: '0.7rem' }}>{job.status}</span>
                                </div>
                                <p style={{ margin: '0 0 0.75rem', color: 'var(--text-light)', fontSize: '0.85rem' }}>💰 ₹{job.wage} &nbsp;·&nbsp; 📍 {job.location}</p>

                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: '0.5rem' }}>
                                        {t('applicants_label', { count: applications.filter(a => a.jobId === job.id).length })}
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
                                                    {t('recommended_candidate')}
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
                                                            <span style={{ color: getTrustColor(app.workerTrustScore || 100), fontWeight: 700 }}>{t('trust_label', { count: app.workerTrustScore || 100 })}</span>
                                                            {app.workerTrustScore >= 90 && <span style={{ color: '#b45309', fontWeight: 800, marginLeft: '4px', fontSize: '0.65rem', textTransform: 'uppercase' }}>{t('top_worker_badge')}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span className={`badge badge-${app.status}`} style={{ fontSize: '0.65rem' }}>{app.status}</span>
                                                    {app.status === 'pending' && (
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.78rem', background: 'var(--secondary-color)', fontWeight: 700 }}
                                                            onClick={() => setConfirmSelectWorker(app)}
                                                        >
                                                            {t('select_worker')}
                                                        </button>
                                                    )}
                                                    {app.status === 'selected' && app.workerPhone && (
                                                        <a 
                                                            href={`tel:${app.workerPhone}`} 
                                                            className="btn btn-secondary" 
                                                            style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.78rem', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                                                        >
                                                        <PhoneCall size={14} /> {t('call_worker')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {app.status === 'selected' && (
                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(217,119,6,0.15)' }}>
                                                    <Timeline currentStatus="selected" />
                                                    
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem' }}>
                                                        <button className="btn btn-secondary" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }} onClick={() => handleMarkPresence(app, true)}>
                                                            <UserCheck size={16} /> {t('present_btn') || 'Present'}
                                                        </button>
                                                        <button className="btn btn-danger" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }} onClick={() => handleMarkPresence(app, false)}>
                                                            <XCircle size={16} /> {t('absent_btn') || 'Absent'}
                                                        </button>
                                                    </div>
                                                    
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 600 }}>Rate Work:</span>
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <button key={star} onClick={() => handleRateWorker(app, star)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', transition: 'transform 0.2s' }} className="hover-scale">
                                                                    <Star size={18} fill="#f59e0b" color="#f59e0b" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {applications.filter(a => a.jobId === job.id).length === 0 && (
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', margin: 0 }}>{t('no_apps_yet')}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── POST JOB VIEW ── */}
                {view === 'post' && (
                    <div className="animate-in">
                        <h2 style={{ marginBottom: '1rem' }}>{t('post_job')}</h2>
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
                                    <label className="form-label">{t('job_title')}</label>
                                    <VoiceInput required value={formJob.title} onChange={e => setFormJob({ ...formJob, title: e.target.value })} placeholder="e.g. Mason, Electrician, Driver" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('location_label')}</label>
                                    <VoiceInput required value={formJob.location} onChange={e => setFormJob({ ...formJob, location: e.target.value })} placeholder="e.g. Hyderabad, Mumbai" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('daily_wage')}</label>
                                    <VoiceInput type="number" required value={formJob.wage} onChange={e => setFormJob({ ...formJob, wage: e.target.value })} placeholder="e.g. 800" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('description_label')}</label>
                                    <VoiceInput value={formJob.description} onChange={e => setFormJob({ ...formJob, description: e.target.value })} placeholder="e.g. Construction work, 6 days/week" />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(to right, #d97706, #f59e0b)', boxShadow: '0 4px 14px rgba(217,119,6,0.4)' }} disabled={loading}>
                                    {loading ? <span className="spinner" /> : <><Plus size={18} /> {t('post_job_btn')}</>}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── LEAVES VIEW ── */}
                {view === 'leaves' && (
                    <div className="animate-in">
                        <h2 style={{ marginBottom: '1rem' }}>{t('leave_requests')}</h2>
                        {leaves.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <CheckCircle size={48} color="var(--text-light)" style={{ marginBottom: '1rem', opacity: 0.4 }} />
                                <p style={{ color: 'var(--text-light)' }}>{t('no_leaves_found')}</p>
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
                                            <CheckCircle size={16} /> {t('approve_btn')}
                                        </button>
                                        <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleApproveLeave(l.id, 'rejected')}>
                                            <XCircle size={16} /> {t('reject_btn')}
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
                            <h2 style={{ margin: 0 }}>{t('mark_daily_attendance')}</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className={`btn btn-sm ${showScanner ? 'btn-primary' : 'btn-outline'}`} 
                                    onClick={() => setShowScanner(!showScanner)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0.4rem 0.8rem', height: '38px' }}
                                >
                                    <Camera size={14} /> {showScanner ? (t('close_scanner') || "Close Scanner") : (t('scan_qr_btn') || "Scan Worker QR")}
                                </button>
                                <button 
                                    className={`btn btn-sm ${showAttMap ? 'btn-primary' : 'btn-outline'}`} 
                                    onClick={() => setShowAttMap(!showAttMap)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', width: 'auto', padding: '0.4rem 0.8rem', height: '38px' }}
                                >
                                    <MapPin size={14} /> {showAttMap ? (t('list_view') || "List View") : (t('map_view') || "Map View")}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={handleMarkAllPresent} disabled={loading} style={{ height: '38px' }}>
                                    {loading ? <div className="spinner-sm" /> : <><CheckCircle size={14} /> {t('bulk_present')}</>}
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={handlePayAll} disabled={isPaying} style={{ background: '#059669', height: '38px' }}>
                                    {isPaying ? <div className="spinner-sm" /> : <><Plus size={14} /> {t('pay_all')}</>}
                                </button>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                            {t('status_for')} <strong>{new Date().toDateString()}</strong>
                        </p>

                        {showScanner && (
                            <div className="card animate-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', border: '1.5px solid #d97706', background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>{t('scan_qr_btn') || 'Scan Worker QR'}</h3>
                                    <button className="btn btn-sm btn-ghost" style={{ width: 'auto', padding: '0.5rem', cursor: 'pointer' }} onClick={() => setShowScanner(false)}>
                                        <X size={18} />
                                    </button>
                                </div>
                                <QRScanner onScanSuccess={handleQRScanSuccess} onScanError={(err) => showToast(err, 'error')} />
                            </div>
                        )}
                        
                        {showAttMap && (
                            <div className="map-container animate-in" style={{ height: '400px', borderRadius: '18px', overflow: 'hidden', border: '1.5px solid var(--border-color)', marginBottom: '1.5rem', background: '#e5e7eb' }}>
                                <MapContainer center={[17.4483, 78.3915]} zoom={12} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                                    <TileLayer
                                        attribution='&copy; Google'
                                        url={`https://mt1.google.com/vt/lyrs=m&hl=${i18n.language || 'en'}&x={x}&y={y}&z={z}`}
                                    />
                                    {/* Show Live Locations */}
                                    {Object.entries(workerLocations).map(([workerId, loc]) => {
                                        const app = applications.find(a => a.workerId === workerId && a.status === 'selected');
                                        if (!app) return null;
                                        return (
                                            <Marker key={workerId} position={[loc.lat, loc.lng]} icon={workerIcon}>
                                                <Popup>
                                                    <div style={{ padding: '4px' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{app.workerName} ({t('live_label')})</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '2px', fontWeight: 600 }}>{t('active_mapping')}</div>
                                                        <div style={{ fontSize: '0.65rem', color: '#666', marginTop: '4px' }}>{t('last_updated_label')} {new Date(loc.updatedAt?.seconds * 1000 || Date.now()).toLocaleTimeString()}</div>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    })}
                                    {/* Show Attendance Markers if no live location */}
                                    {applications.filter(a => a.status === 'selected').map(app => {
                                        if (workerLocations[app.workerId]) return null;
                                        const today = new Date().toISOString().split('T')[0];
                                        const record = attendance.find(att => att.workerId === app.workerId && att.jobId === app.jobId && att.date === today);
                                        if (record && record.lat && record.lng) {
                                            return (
                                                <Marker key={app.id} position={[record.lat, record.lng]} icon={workerIcon}>
                                                    <Popup>
                                                        <div style={{ padding: '4px' }}>
                                                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{app.workerName}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{t('check_in_label')} {new Date(record.createdAt?.seconds * 1000 || Date.now()).toLocaleTimeString()}</div>
                                                        </div>
                                                    </Popup>
                                                </Marker>
                                            );
                                        }
                                        return null;
                                    })}
                                </MapContainer>
                            </div>
                        )}

                        {applications.filter(a => a.status === 'selected').length === 0 ? (
                            <div className="empty-state animate-in">
                                <div className="empty-illustration">
                                    <Users size={64} />
                                </div>
                                <h3>{t('no_hired_workers')}</h3>
                                <p>{t('no_hired_msg')}</p>
                                <button className="btn btn-primary" onClick={() => setView('jobs')} style={{ width: 'auto', padding: '0.75rem 2rem' }}>
                                    {t('hire_first_btn')}
                                </button>
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
                                                <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'var(--bg-lighter)', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {record?.checkInPhoto ? (
                                                        <img src={record.checkInPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="check-in" />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #d97706, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.2rem' }}>
                                                            {(app.workerName || 'W')[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{app.workerName || 'Worker'}</div>
                                                        {record?.location && (
                                                            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                                                                <PinIcon size={10} /> {t('gps_verified')}
                                                            </span>
                                                        )}
                                                    </div>
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
                                                        gap: '4px',
                                                        background: record.present ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px'
                                                    }}>
                                                        {record.present ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {record.present ? t('present_stat') : t('absent_stat')}
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
                                                    <UserCheck size={18} /> {t('present_btn')}
                                                </button>
                                                <button 
                                                    className={`btn ${record?.present === false ? 'btn-danger' : 'btn-outline'}`}
                                                    disabled={record !== undefined}
                                                    style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                                                    onClick={() => handleMarkPresence(app, false)}
                                                >
                                                    <XCircle size={18} /> {t('absent_btn')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── LIVE TRACKING VIEW ── */}
                {view === 'track' && (
                    <div className="animate-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0 }}>{t('live_worker_tracking')}</h2>
                                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                    {t('monitoring_active_shifts', { count: trackingRadius })}
                                </p>
                            </div>
                            {/* Radius Controller */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--primary-soft)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--primary-soft)' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary-color)', opacity: 0.8 }}>{t('radius') || 'RADIUS'}:</span>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {[100, 200, 500, 1000].map(r => (
                                        <button
                                            key={r}
                                            onClick={() => setTrackingRadius(r)}
                                            style={{
                                                padding: '2px 8px',
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: trackingRadius === r ? 'var(--primary-color)' : 'transparent',
                                                color: trackingRadius === r ? 'white' : 'var(--text-slate)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {r >= 1000 ? '1km' : `${r}m`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ 
                                background: activeWorkers.length > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', 
                                color: activeWorkers.length > 0 ? '#059669' : '#d97706', 
                                padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, 
                                display: 'flex', alignItems: 'center', gap: '6px' 
                            }}>
                                <div className={activeWorkers.length > 0 ? "pulse" : ""} style={{ 
                                    width: '8px', height: '8px', borderRadius: '50%', 
                                    background: activeWorkers.length > 0 ? '#059669' : '#d97706' 
                                }} />
                                {activeWorkers.length} {t('workers_online')}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="btn btn-sm btn-outline"
                                    onClick={() => handleSimulateWorker('mock_user_1234567890', jobs[0])}
                                    disabled={simulating}
                                    style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
                                >
                                    ✨ {t('start_live_demo')}
                                </button>
                                <button 
                                    className={`btn btn-sm ${showGlobalTrack ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setShowGlobalTrack(!showGlobalTrack)}
                                    style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '6px', height: '36px' }}
                                >
                                    <Layout size={14} /> {showGlobalTrack ? t('hide_map') : t('show_map')}
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-2 items-center" style={{ marginBottom: '1.5rem', background: 'var(--bg-lighter)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Navigation size={18} color="var(--primary-color)" />
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('radius_meters') || 'Tracking Radius (meters)'}:</span>
                            </div>
                            <input 
                                type="number" 
                                value={trackingRadius} 
                                onChange={(e) => setTrackingRadius(Number(e.target.value))}
                                className="input-field"
                                style={{ width: '80px', padding: '0.3rem 0.5rem', margin: '0 8px' }}
                                min="10"
                            />
                            <div className="flex gap-1">
                                {[100, 250, 500, 1000].map(r => (
                                    <button 
                                        key={r}
                                        onClick={() => setTrackingRadius(r)}
                                        className="btn btn-sm"
                                        style={{ 
                                            width: 'auto', padding: '0.2rem 0.8rem', fontSize: '0.75rem',
                                            background: trackingRadius === r ? 'var(--primary-color)' : 'white',
                                            color: trackingRadius === r ? 'white' : 'var(--text-main)',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        {r}m
                                    </button>
                                ))}
                            </div>
                        </div>

                        {showGlobalTrack && applications.filter(a => a.status === 'selected').length > 0 && (
                            <GlobalTrackMap 
                                activeWorkers={activeWorkers} 
                                applications={applications} 
                                jobs={jobs} 
                                radius={trackingRadius}
                            />
                        )}

                        {applications.filter(a => a.status === 'selected').length === 0 ? (
                            <div className="empty-state card" style={{ padding: '4rem 3rem', border: '2px dashed var(--border-color)', background: 'var(--bg-lighter)' }}>
                                <div style={{ background: 'white', width: '100px', height: '100px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                                    <MapPin size={48} color="#d97706" />
                                </div>
                                <h2 style={{ margin: '0 0 0.75rem', fontWeight: 800 }}>{t('no_hired_workers')}</h2>
                                <p style={{ color: 'var(--text-light)', maxWidth: '400px', margin: '0 auto 2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                    {t('tracking_empty_msg') || 'You have no active workers on site right now. Would you like to see how the live tracking system works with an example?'}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: 'auto', padding: '0.8rem 2rem', background: 'linear-gradient(135deg, #d97706, #f59e0b)', border: 'none' }} 
                                        onClick={handleViewExampleMap}
                                    >
                                        ✨ {t('view_example_map') || 'View Example Tracking Map'}
                                    </button>
                                    <button 
                                        className="btn btn-outline" 
                                        style={{ width: 'auto', padding: '0.8rem 2rem' }} 
                                        onClick={() => setView('jobs')}
                                    >
                                        <Users size={18} /> {t('select_worker')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {applications.filter(a => a.status === 'selected').map(app => {
                                    const job = jobs.find(j => j.id === app.jobId);
                                    if (!job) return null;
                                    
                                    const onlineWorker = activeWorkers.find(w => w.id === app.workerId);
                                    const isOnline = !!onlineWorker;
                                    const displayWorker = onlineWorker || { 
                                        id: app.workerId, 
                                        name: app.workerName || 'Worker', 
                                        trustScore: app.workerTrustScore || 0 
                                    };

                                    return (
                                        <div key={app.id} className="card" style={{ padding: '1.25rem', border: '1px solid var(--border-color)', opacity: isOnline ? 1 : 0.85 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ 
                                                        width: '40px', height: '40px', borderRadius: '50%', 
                                                        background: isOnline ? 'linear-gradient(135deg, #065f46, #10b981)' : 'linear-gradient(135deg, #1e1b4b, #4338ca)', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, position: 'relative'
                                                    }}>
                                                        {(displayWorker.name || 'W')[0].toUpperCase()}
                                                        <div style={{ 
                                                            position: 'absolute', bottom: 0, right: 0, 
                                                            width: '12px', height: '12px', borderRadius: '50%', 
                                                            background: isOnline ? '#10b981' : '#94a3b8', 
                                                            border: '2px solid white' 
                                                        }} />
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '1rem' }}>{displayWorker.name}</h4>
                                                            <span style={{ 
                                                                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', 
                                                                background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                                                                color: isOnline ? '#059669' : '#64748b', fontWeight: 700
                                                            }}>
                                                                {isOnline ? t('status_online') : t('status_offline')}
                                                            </span>
                                                            {isOnline && onlineWorker.currentLocation && job.lat && job.lng && (
                                                                (() => {
                                                                    const dist = calculateDistance(job.lat, job.lng, onlineWorker.currentLocation.lat, onlineWorker.currentLocation.lng);
                                                                    const outOfZone = dist > trackingRadius;
                                                                    if (outOfZone && !lastNotifiedRef.current[app.id]) {
                                                                        playAudio(t('worker_out_of_zone_msg', { name: displayWorker.name, job: job.title }), i18n.language);
                                                                        lastNotifiedRef.current[app.id] = true;
                                                                    } else if (!outOfZone) {
                                                                        lastNotifiedRef.current[app.id] = false;
                                                                    }
                                                                    return outOfZone ? (
                                                                        <span style={{ 
                                                                            fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', 
                                                                            background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 800,
                                                                            border: '1px solid rgba(239,68,68,0.2)', animation: 'pulse 1.5s infinite', marginLeft: '8px'
                                                                        }}>
                                                                            ⚠️ {t('out_of_zone')}
                                                                        </span>
                                                                    ) : null;
                                                                })()
                                                            )}
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>{job.title}</p>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>₹{job.wage} / {t('day')}</div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>{job.location}</div>
                                                </div>
                                            </div>
                                            <div style={{ margin: '1rem 0' }}>
                                                <TrackingMap 
                                                    worker={displayWorker} 
                                                    job={job} 
                                                    radius={trackingRadius} 
                                                    onSimulate={displayWorker.id === 'mock_user_1234567890' || displayWorker.isPermanentlyOnline ? () => handleSimulateWorker(displayWorker.id, job) : null}
                                                />
                                            </div>

                                            {(() => {
                                                const attRecord = attendance.find(att => att.workerId === displayWorker.id && att.jobId === job.id);
                                                const attId = attRecord?.id || `${displayWorker.id}_${job.id}_${new Date().toISOString().split('T')[0]}`;
                                                return (
                                                    <div style={{ margin: '1rem 0', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                                        <GeoFenceHistoryList attendanceId={attId} />
                                                    </div>
                                                );
                                            })()}

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', gap: '15px' }}>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                                        <strong>Trust Score:</strong> <span style={{ color: '#059669' }}>{displayWorker.trustScore}%</span>
                                                    </div>
                                                    {isOnline && displayWorker.currentLocation && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                                                            <strong>{t('last_seen')}:</strong> {new Date(displayWorker.currentLocation.updatedAt).toLocaleTimeString()}
                                                        </div>
                                                    )}
                                                </div>
                                                <button className="btn btn-sm btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem' }} onClick={() => window.open(`tel:${app.workerPhone || '9876543210'}`)}>
                                                    <PhoneCall size={14} /> {t('call_worker')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ANALYTICS VIEW ── */}
                {view === 'analytics' && (
                    <WorkforceAnalytics 
                        jobs={jobs} 
                        applications={applications} 
                        attendance={attendance} 
                    />
                )}
            </div>

            {/* ── BOTTOM NAV ── */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
                background: 'var(--card-bg)', backdropFilter: 'blur(20px)',
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

            {/* ── MODALS ── */}
            <ConfirmModal 
                isOpen={!!confirmSelectWorker}
                onClose={() => setConfirmSelectWorker(null)}
                onConfirm={() => {
                    handleSelectWorker(confirmSelectWorker.jobId, confirmSelectWorker.workerId);
                    setConfirmSelectWorker(null);
                }}
                title={t('confirm_selection')}
                message={t('select_confirm_msg', { worker: confirmSelectWorker?.workerName })}
                confirmText={t('select_now')}
                type="secondary"
            />
            {/* ── CELEBRATION OVERLAY ── */}
            {showCelebration && (
                <Celebration 
                    title={celebrationData.title} 
                    subtitle={celebrationData.subtitle} 
                    onComplete={() => setShowCelebration(false)} 
                />
            )}
        </div>
    );
};

export default EmployerDashboard;
