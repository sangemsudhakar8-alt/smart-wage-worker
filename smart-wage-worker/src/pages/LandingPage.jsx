import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Briefcase, ArrowRight, ShieldCheck, Mic, Phone, CheckCircle, TrendingUp, Square } from 'lucide-react';
import { playAudio, stopAudio } from '../utils/audio';

/* ── Animated counter hook ── */
const useCounter = (target, duration = 1800) => {
    const [count, setCount] = useState(0);
    const started = useRef(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                const start = Date.now();
                const timer = setInterval(() => {
                    const progress = Math.min((Date.now() - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    setCount(Math.floor(eased * target));
                    if (progress === 1) clearInterval(timer);
                }, 16);
            }
        }, { threshold: 0.3 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target, duration]);

    return [count, ref];
};

/* ── Single impact stat ── */
const ImpactStat = ({ value, suffix, label, color }) => {
    const [count, ref] = useCounter(value);
    return (
        <div ref={ref} style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
            <div style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: 900, color, lineHeight: 1 }}>
                {count.toLocaleString('en-IN')}{suffix}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.4rem', fontWeight: 500 }}>{label}</div>
        </div>
    );
};

const LandingPage = ({ onGetStarted }) => {
    const { t, i18n } = useTranslation();
    const [micPulsing, setMicPulsing] = useState(false);

    const changeLang = (l) => i18n.changeLanguage(l);

    const handleVoiceDemo = () => {
        if (micPulsing) {
            stopAudio();
            setMicPulsing(false);
            return;
        }
        setMicPulsing(true);
        // Use the main welcome text for the landing demo
        const textToSpeak = t('landing_hero_title') + ". " + t('landing_hero_subtitle');
        playAudio(textToSpeak, i18n.language, {
            onEnd: () => setMicPulsing(false),
            onError: () => setMicPulsing(false)
        });
    };


    const steps = [
        { icon: <Phone size={28} color="var(--primary-color)" />, bg: 'var(--primary-soft)', key: 'step_register', descKey: 'step_register_desc' },
        { icon: <Briefcase size={28} color="var(--secondary-color)" />, bg: 'var(--secondary-soft)', key: 'step_apply', descKey: 'step_apply_desc' },
        { icon: <CheckCircle size={28} color="#10b981" />, bg: 'rgba(16,185,129,0.1)', key: 'step_get_paid', descKey: 'step_get_paid_desc' },
    ];

    const testimonials = [
        { name: t('testimonial_1_name'), role: t('testimonial_1_role'), quote: t('testimonial_1_quote'), avatar: "🧑‍🔧", rating: 5 },
        { name: t('testimonial_2_name'), role: t('testimonial_2_role'), quote: t('testimonial_2_quote'), avatar: "👩‍🍳", rating: 5 },
        { name: t('testimonial_3_name'), role: t('testimonial_3_role'), quote: t('testimonial_3_quote'), avatar: "🧑‍💼", rating: 5 },
    ];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }} className="animate-in">

            {/* ── NAVBAR ── */}
            <nav style={{
                padding: '1.25rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'fixed',
                top: 0, left: 0, right: 0,
                zIndex: 100,
                background: 'rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: 'var(--primary-color)', padding: '6px', borderRadius: '10px' }}>
                        <Users size={20} color="white" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.5px' }}>SmartWage</span>
                </div>
                <div className="flex gap-2">
                    {['en', 'te', 'hi'].map(lang => (
                        <button
                            key={lang}
                            onClick={() => changeLang(lang)}
                            className={`btn btn-sm ${i18n.language === lang ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ textTransform: 'uppercase', minWidth: '40px' }}
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="app-container" style={{ paddingTop: '80px', flex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>

                {/* ── HERO ── */}
                <section className="web-grid-parent" style={{ padding: '2rem 1rem', alignItems: 'center', minHeight: '70vh' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className="badge badge-open" style={{ width: 'fit-content' }}>
                            <ShieldCheck size={14} /> {t('trusted_by_thousands')}
                        </div>
                        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, margin: 0 }}>
                            {t('landing_hero_title')}
                        </h1>
                        <p style={{ fontSize: '1.15rem', color: 'var(--text-light)', maxWidth: '500px', lineHeight: 1.6 }}>
                            {t('landing_hero_subtitle')}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button className="btn btn-primary btn-lg" style={{ width: 'auto', minWidth: '200px' }} onClick={onGetStarted}>
                                {t('get_started')} <ArrowRight size={22} />
                            </button>
                            <button className="btn btn-outline btn-lg" style={{ width: 'auto' }}>
                                {t('learn_more')}
                            </button>
                            {/* ── VOICE DEMO BUTTON ── */}
                                <button
                                    onClick={handleVoiceDemo}
                                    title={micPulsing ? 'Stop Audio' : t('listen_welcome')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: micPulsing ? 'var(--primary-color)' : 'var(--primary-soft)',
                                        color: micPulsing ? 'white' : 'var(--primary-color)',
                                        border: '2px solid var(--primary-color)',
                                        borderRadius: '50px',
                                        padding: '0.65rem 1.1rem',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        transition: 'all 0.3s ease',
                                        animation: micPulsing ? 'pulse 1s infinite' : 'none',
                                        flexShrink: 0,
                                    }}
                                >
                                    {micPulsing ? <Square size={16} fill="white" style={{ flexShrink: 0 }} /> : <Mic size={18} style={{ flexShrink: 0 }} />}
                                    {micPulsing ? t('stop_audio_btn') : t('voice_demo_btn')}
                                </button>
                        </div>
                        {/* Voice hint */}
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                            🎙️ {t('listen_welcome')}
                        </p>
                    </div>

                    <div className="hero-illustration">
                        <img src="/landing_hero_premium.png" alt="Smart Wage Worker Hero" />
                    </div>
                </section>

                {/* ── IMPACT COUNTERS ── */}
                <section style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #1e1b4b, #4338ca)',
                        borderRadius: '24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 0,
                        overflow: 'hidden',
                        boxShadow: '0 20px 60px rgba(67,56,202,0.35)',
                    }}>
                        {[
                            { value: 12400, suffix: '+', label: t('impact_workers'), color: '#a5b4fc' },
                            { value: 3200,  suffix: '+', label: t('impact_employers'), color: '#6ee7b7' },
                            { value: 48,    suffix: 'L+', label: t('impact_wages') + ' (₹)', color: '#fbbf24' },
                            { value: 49,    suffix: '/5★', label: t('impact_rating'), color: '#f472b6' },
                        ].map((stat, i) => (
                            <div key={i} style={{
                                borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                color: 'white',
                                textAlign: 'center',
                                padding: '1.5rem 0.75rem',
                            }}>
                                <ImpactStat {...stat} />
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── HOW IT WORKS ── */}
                <section style={{ padding: '3rem 1rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>{t('how_it_works')}</h2>
                        <p style={{ color: 'var(--text-light)' }}>{t('simple_fast_rural')}</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                        {steps.map((step, i) => (
                            <div key={i} className="card hover-glow" style={{ position: 'relative', overflow: 'hidden' }}>
                                <div style={{
                                    position: 'absolute', top: '1rem', right: '1rem',
                                    fontSize: '3rem', fontWeight: 900, opacity: 0.06, lineHeight: 1,
                                    color: 'var(--primary-color)'
                                }}>{i + 1}</div>
                                <div style={{ background: step.bg, padding: '12px', borderRadius: '14px', width: 'fit-content', marginBottom: '1rem' }}>
                                    {step.icon}
                                </div>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: 'var(--primary-color)', color: 'white',
                                    fontSize: '0.7rem', fontWeight: 800, marginBottom: '0.6rem'
                                }}>{i + 1}</div>
                                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{t(step.key)}</h3>
                                <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-light)', lineHeight: 1.5 }}>{t(step.descKey)}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── WHY SMARTWAGE ── */}
                <section style={{ padding: '0 1rem 3rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.8rem' }}>{t('why_choose_title')}</h2>
                        <p style={{ color: 'var(--text-light)' }}>{t('why_choose_subtitle')}</p>
                    </div>
                    <div className="grid col-2 web-grid-three" style={{ gap: '20px' }}>
                        <div className="card hover-glow">
                            <div style={{ background: 'var(--primary-soft)', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '1rem' }}>
                                <ShieldCheck size={32} color="var(--primary-color)" />
                            </div>
                            <h3>{t('secure_transparent_title')}</h3>
                            <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('secure_transparent_desc')}</p>
                        </div>
                        <div className="card hover-glow">
                            <div style={{ background: 'var(--secondary-soft)', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '1rem' }}>
                                <Briefcase size={32} color="var(--secondary-color)" />
                            </div>
                            <h3>{t('direct_hiring_title')}</h3>
                            <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('direct_hiring_desc')}</p>
                        </div>
                        <div className="card hover-glow">
                            <div style={{ background: 'rgba(245,158,11,0.1)', padding: '12px', borderRadius: '12px', width: 'fit-content', marginBottom: '1rem' }}>
                                <TrendingUp size={32} color="var(--warning-color)" />
                            </div>
                            <h3>{t('trust_reputation_title')}</h3>
                            <p style={{ fontSize: '0.9rem', margin: 0 }}>{t('trust_reputation_desc')}</p>
                        </div>
                    </div>
                </section>

                {/* ── TESTIMONIALS ── */}
                <section style={{ padding: '0 1rem 4rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.8rem' }}>{t('testimonials_title')}</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                        {testimonials.map((t_, i) => (
                            <div key={i} className="card hover-lift" style={{ borderTop: '3px solid var(--primary-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '2.2rem', lineHeight: 1 }}>{t_.avatar}</div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{t_.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t_.role}</div>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 0.75rem', fontStyle: 'italic', color: 'var(--text-light)' }}>"{t_.quote}"</p>
                                <div style={{ color: '#f59e0b', fontSize: '1rem' }}>{'★'.repeat(t_.rating)}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section style={{
                    margin: '0 1rem 4rem',
                    background: 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))',
                    borderRadius: '24px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: 'white',
                }}>
                    <h2 style={{ color: 'white', fontSize: '2rem', marginBottom: '0.75rem' }}>{t('ready_to_work_title')}</h2>
                    <p style={{ opacity: 0.85, marginBottom: '1.5rem', fontSize: '1.05rem' }}>
                        {t('joined_count_msg')}
                    </p>
                    <button
                        className="btn btn-lg"
                        onClick={onGetStarted}
                        style={{ background: 'white', color: 'var(--primary-color)', fontWeight: 800, width: 'auto', minWidth: '200px' }}
                    >
                        {t('get_started')} <ArrowRight size={20} />
                    </button>
                </section>
            </main>

            {/* ── FOOTER ── */}
            <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', color: 'var(--text-light)', fontSize: '0.8rem' }}>
                {t('copyright')}
            </footer>
        </div>
    );
};

export default LandingPage;
