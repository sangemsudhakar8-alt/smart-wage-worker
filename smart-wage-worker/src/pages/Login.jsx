import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { setupRecaptcha, sendOTP, loginFirebaseUser } from '../api';
import { Volume2, Phone, ShieldCheck, ArrowRight, RefreshCw, Database } from 'lucide-react';
import { playAudio } from '../utils/audio';
import { useToast } from '../contexts/ToastContext';
import { seedDemoData } from '../utils/seedDemoData';
import { useVoice } from '../contexts/VoiceContext';
import VoiceInput from '../components/VoiceInput';
import { Mic } from 'lucide-react';

const Login = () => {
    const { t, i18n } = useTranslation();
    const { loginUser } = useAuth();
    const { showToast } = useToast();
    const { playGuide, voiceCommand, isListeningCommand, listenForCommand } = useVoice();
    const lastCommandRef = useRef(null);
    const [spokenText, setSpokenText] = useState('');

    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [role, setRole] = useState('worker');
    const [status, setStatus] = useState('phone'); // phone, otp
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);

    useEffect(() => {
        // Initialize invisible ReCaptcha on page load
        if (status === 'phone') {
            setupRecaptcha('recaptcha-container');
        }
        
        if (localStorage.getItem('hasPlayedWelcomeGuide') !== 'true') {
            playGuide('welcome');
            localStorage.setItem('hasPlayedWelcomeGuide', 'true');
        }
    }, [status, playGuide]);

    // Handle Voice Commands for Login
    useEffect(() => {
        if (voiceCommand && voiceCommand.timestamp !== lastCommandRef.current) {
            lastCommandRef.current = voiceCommand.timestamp;
            const cmd = voiceCommand.text.toLowerCase();
            setSpokenText(voiceCommand.text);

            // Role keywords - Extensive Telugu & Hindi support
            const workerKeywords = [
                'worker', 'karmik', 'panivaadu', 'panivadu', 'labor', 'labour', 'kuli', 'coolie',
                'పనివాడు', 'పనివానిగా', 'నేను పనివాడిని', 'कामगार', 'मजदूर'
            ];
            const employerKeywords = [
                'employer', 'malik', 'maalik', 'yajamani', 'yajamaani', 'saheb', 'owner',
                'యజమాని', 'యజమానిని', 'నేను యజమానిని', 'ఓనర్', 'मालिक', 'सेठ'
            ];
            const loginKeywords = [
                'login', 'shuru', 'praarambhinchu', 'go', 'submit', 'verify', 'ok', 'okay', 
                'వెళ్దాం', 'ఓకే', 'పంపించు', 'ముందుకు', 'లాగిన్', 'चलो', 'भेजो', 'लॉग इन'
            ];

            if (workerKeywords.some(k => cmd.includes(k))) {
                setRole('worker');
                speakText('i_am_worker');
            } else if (employerKeywords.some(k => cmd.includes(k))) {
                setRole('employer');
                speakText('i_am_employer');
            } else if (loginKeywords.some(k => cmd.includes(k))) {
                if (status === 'phone') {
                    if (phone.length === 10) {
                        handleSendOTP({ preventDefault: () => {} });
                    } else {
                        showToast(t('enter_phone_toast'), "info");
                        speakText('phone_number');
                    }
                } else {
                    if (otp.length === 6) {
                        handleVerifyOTP({ preventDefault: () => {} });
                    }
                }
            } else {
                // Not recognized
                setTimeout(() => {
                    playAudio(t('please_try_again'), i18n.language);
                }, 1000);
            }

            // Clear visual feedback after 3 seconds
            setTimeout(() => setSpokenText(''), 3000);
        }
    }, [voiceCommand, status, phone, otp, i18n.language, t]);

    const speakText = (textKey) => playAudio(t(textKey), i18n.language);

    const handleSendOTP = async (e) => {
        e.preventDefault();
        if (!phone || phone.length < 10) {
            showToast(t('valid_phone_toast'), "error");
            return;
        }
        setLoading(true);
        try {
            const verifier = window.recaptchaVerifier;
            const result = await sendOTP(phone, verifier);
            setConfirmationResult(result);
            setStatus('otp');
            showToast(t('otp_sent_toast'), "success");
            speakText('verification_code_sent');

            // Auto-OTP for test number
            if (result.isMock) {
                setOtp('123456');
            }
        } catch (err) {
            console.error(err);
            showToast(t('otp_failed_toast'), "error");
            // Reset recaptcha if error
            if (window.recaptchaWidgets) {
                window.recaptchaVerifier.render().then(widgetId => {
                    window.grecaptcha.reset(widgetId);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (!otp || otp.length < 6) return;
        setLoading(true);
        try {
            const result = await confirmationResult.confirm(otp);
            const firebaseUser = result.user;

            // Sync with our Firestore users collection
            const { user } = await loginFirebaseUser(phone, role, firebaseUser.uid);
            loginUser(user);
            showToast(t('login_success'), "success");
        } catch (err) {
            console.error(err);
            const errorMessage = err.code || err.message || t('invalid_otp_toast');
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main-content-fluid flex items-center justify-center p-4 animate-in" style={{ background: 'var(--bg-gradient)', minHeight: '100vh' }}>
            <div id="login-section" className="card text-center" style={{ padding: '2.5rem 1.75rem', maxWidth: '440px', width: '100%', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(99,102,241,0.1)', borderRadius: '50%', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                        <ShieldCheck size={36} color="var(--primary-color)" />
                    </div>
                    <h2 style={{ marginBottom: '0.25rem', fontSize: '1.75rem' }}>{t('welcome_back')}</h2>
                    <p className="text-light" style={{ fontSize: '0.9rem' }}>{status === 'phone' ? t('login_title') : t('otp_instruction')}</p>
                </div>

                {/* Global Voice Assistant Button */}
                <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                    <button 
                        type="button"
                        onClick={listenForCommand}
                        className={`btn ${isListeningCommand ? 'pulse' : ''}`}
                        style={{
                            background: isListeningCommand ? 'var(--danger-color)' : 'var(--primary-color)',
                            color: 'white',
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.3)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        <Mic size={28} />
                    </button>
                    {spokenText && (
                        <div className="animate-in" style={{
                            position: 'absolute',
                            top: '75px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-md)',
                            fontSize: '0.85rem',
                            whiteSpace: 'nowrap',
                            border: '1px solid var(--border-color)',
                            zIndex: 10
                        }}>
                            🗣️ {t('you_said')} <strong>"{spokenText}"</strong>
                        </div>
                    )}
                </div>

                {status === 'phone' ? (
                    <form onSubmit={handleSendOTP}>
                        <div className="form-group text-left mb-6">
                            <label className="form-label flex items-center gap-2" style={{ fontSize: '0.95rem' }}>
                                <Phone size={16} /> {t('phone_number')}
                                <button type="button" className="audio-btn" style={{ padding: '0.4rem' }} onClick={() => speakText('phone_number')}><Volume2 size={14} /></button>
                            </label>
                            <div className="flex items-center gap-2 w-full">
                                <div style={{ background: '#f1f5f9', padding: '0.8rem 0.9rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', fontSize: '1.1rem' }}>+91</div>
                                <VoiceInput
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="9876543210"
                                    maxLength="10"
                                    style={{ fontSize: '1.25rem', letterSpacing: '1px' }}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <button
                                type="button"
                                className={`btn flex-1 ${role === 'worker' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => { setRole('worker'); speakText('i_am_worker'); }}
                                style={{ padding: '0.85rem', fontSize: '1rem' }}
                            >
                                {t('i_am_worker')}
                            </button>
                            <button
                                type="button"
                                className={`btn flex-1 ${role === 'employer' ? 'btn-secondary' : 'btn-outline'}`}
                                onClick={() => { setRole('employer'); speakText('i_am_employer'); }}
                                style={{ padding: '0.85rem', fontSize: '1rem' }}
                            >
                                {t('i_am_employer')}
                            </button>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full flex items-center justify-center gap-2" disabled={loading} style={{ borderRadius: '16px' }}>
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <>{t('login_btn')} <ArrowRight size={20} /></>}
                        </button>

                        <div id="recaptcha-container"></div>
                    </form>
                ) : (
                    <form onSubmit={handleVerifyOTP} className="animate-in">
                        <div className="form-group mb-6">
                            <label className="form-label text-left" style={{ fontSize: '0.95rem' }}>{t('verification_code_label')}</label>
                            <VoiceInput
                                type="number"
                                className="form-input text-center"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="0 0 0 0 0 0"
                                maxLength="6"
                                style={{ fontSize: '1.75rem', letterSpacing: '8px', fontWeight: 'bold' }}
                                required
                                autoFocus
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg w-full mb-4" disabled={loading} style={{ borderRadius: '16px' }}>
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : t('verify_btn')}
                        </button>

                        <button type="button" className="btn btn-ghost w-full" onClick={() => setStatus('phone')}>
                            {t('back_to_phone')}
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    {/* Language switcher */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                        {['en', 'te', 'hi'].map(lang => (
                            <button key={lang} onClick={() => i18n.changeLanguage(lang)} className={`btn btn-sm ${i18n.language === lang ? 'btn-primary' : 'btn-outline'}`} style={{ minWidth: '45px', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                {lang}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        disabled={seeding}
                        onClick={async () => {
                            setSeeding(true);
                            try {
                                const employerHint = role === 'employer' && phone ? `mock_user_${phone}` : undefined;
                                await seedDemoData(employerHint);
                                setPhone('1234567890');
                            } catch (e) {
                                showToast(t('seed_failed_toast'), 'error');
                            } finally {
                                setSeeding(false);
                            }
                        }}
                        style={{ background: 'none', border: '1px dashed var(--border-color)', borderRadius: '10px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', color: 'var(--text-light)', cursor: 'pointer' }}
                    >
                        {seeding ? t('demo_loading') : t('load_demo')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
