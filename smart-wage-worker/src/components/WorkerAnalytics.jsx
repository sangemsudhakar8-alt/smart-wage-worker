import React from 'react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Award, Clock, DollarSign, ShieldCheck } from 'lucide-react';

const WorkerAnalytics = ({ stats = {} }) => {
    const { t } = useTranslation();
    const history = stats?.earningsHistory || [];
    const trustScore = stats?.trustScore || 0;
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        let start = 0;
        const end = trustScore;
        const duration = 1000;
        let startTimestamp = null;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }, [trustScore]);

    const getTrustColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header / Trust Growth */}
            <div className="card premium-card" style={{ padding: '1.5rem', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'white' }}>{t('worker_growth') || 'Personal Growth'}</h3>
                        <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.85rem', color: 'white' }}>{t('growth_subtitle') || 'Tracking your professional progress'}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '50%' }}>
                        <TrendingUp size={24} color="white" />
                    </div>
                </div>
            </div>

            <div className="web-grid-parent">
                {/* Earnings Area Chart */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <DollarSign size={18} color="var(--primary-color)" /> {t('earnings_7days') || 'Earnings (Last 7 Days)'}
                        </h4>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary-color)' }}>+₹{history.reduce((s,d) => s + d.amount, 0)}</span>
                    </div>
                    <div style={{ width: '100%', height: '220px' }}>
                        <ResponsiveContainer>
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-light)' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-light)' }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: 'var(--shadow-md)', background: 'var(--card-bg)', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: 'var(--primary-color)', fontWeight: 800 }}
                                />
                                <Area type="monotone" dataKey="amount" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Trust and Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${getTrustColor(trustScore)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={20} color={getTrustColor(trustScore)} />
                            </div>
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>{t('trust_score')}</h4>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>{t('trust_desc') || 'Your reliability rating'}</p>
                            </div>
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: getTrustColor(trustScore), marginBottom: '0.5rem', lineHeight: 1 }} className="counter-up">
                            {count}%
                        </div>
                        <div className="progress-bar-bg" style={{ height: '8px' }}>
                            <div className="progress-bar-fill" style={{ width: `${count}%`, background: getTrustColor(trustScore), boxShadow: `0 0 10px ${getTrustColor(trustScore)}40` }} />
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ background: 'var(--primary-soft)', padding: '10px', borderRadius: '12px', marginBottom: '8px', color: 'var(--primary-color)' }}>
                                <Award size={20} />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{stats?.badges?.length || 0}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('badges')}</div>
                        </div>
                        <div style={{ width: '1px', height: '40px', background: 'var(--border-color)' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ background: 'var(--secondary-soft)', padding: '10px', borderRadius: '12px', marginBottom: '8px', color: 'var(--secondary-color)' }}>
                                <Clock size={20} />
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{stats?.daysWorked || 0}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>{t('days_worked')}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Badges Preview */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-light)' }}>{t('your_milestones') || 'Professional Milestones'}</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {stats?.badges && stats.badges.length > 0 ? (
                        stats.badges.map((badge, idx) => (
                            <div key={idx} className="badge badge-pop" style={{ 
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                                color: 'white', 
                                padding: '0.6rem 1.2rem', 
                                borderRadius: '16px', 
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', 
                                animation: `badge-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 0.1}s both`,
                                textTransform: 'capitalize',
                                fontWeight: 700
                            }}>
                                ✦ {badge.replace(/_/g, ' ')}
                            </div>
                        ))
                    ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>{t('no_badges_yet') || 'Complete more jobs to earn badges!'}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkerAnalytics;
