import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { Star, Briefcase } from 'lucide-react';


const WorkforceAnalytics = ({ jobs = [], applications = [], attendance = [] }) => {
    const { t, i18n } = useTranslation();

    // 1. Prepare Spending Data (last 7 days)
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const spendingData = last7Days.map(date => {
        const dayAttendance = attendance.filter(a => a.date === date && a.present);
        const totalWage = dayAttendance.reduce((sum, att) => {
            const job = jobs.find(j => j.id === att.jobId);
            return sum + (job ? Number(job.wage) : 0);
        }, 0);
        
        // Localized weekday
        const dayName = new Date(date).toLocaleDateString(i18n.language === 'te' ? 'te-IN' : (i18n.language === 'hi' ? 'hi-IN' : 'en-US'), { weekday: 'short' });
        
        return {
            name: dayName,
            amount: totalWage
        };
    });

    // 2. Prepare Hiring Success Data
    const totalApps = applications.length;
    const hiredApps = applications.filter(a => a.status === 'selected').length;
    const rejectedApps = applications.filter(a => a.status === 'rejected').length;
    const pendingApps = applications.filter(a => a.status === 'pending').length;

    const hiringData = [
        { name: t('hired_label'), value: hiredApps, color: '#10b981' },
        { name: t('reviewing_label'), value: pendingApps, color: '#f59e0b' },
        { name: t('rejected_label'), value: rejectedApps, color: '#ef4444' }
    ];

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', padding: '1.5rem', borderRadius: '24px', color: 'white', boxShadow: 'var(--shadow-lg)' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{t('workforce_intel')}</h3>
                <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.85rem' }}>{t('workforce_subtitle')}</p>
            </div>

            <div className="web-grid-parent">
                {/* Spending Chart */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>{t('spending_trend')}</h4>
                    <div style={{ width: '100%', height: '220px' }}>
                        <ResponsiveContainer>
                            <LineChart data={spendingData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                    itemStyle={{ color: '#b45309', fontWeight: 700 }}
                                />
                                <Line type="monotone" dataKey="amount" stroke="#d97706" strokeWidth={3} dot={{ r: 4, fill: '#d97706', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Hiring Success Pie */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>{t('hiring_conversion')}</h4>
                    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={hiringData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {hiringData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalApps}</div>
                            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b' }}>{t('total_apps')}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                        {hiringData.map(d => (
                            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                                {d.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Insights Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>{t('fill_rate')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
                        {totalApps > 0 ? Math.round((hiredApps / totalApps) * 100) : 0}%
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '4px solid #d97706' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>{t('daily_avg_spend')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
                        ₹{Math.round(spendingData.reduce((s, d) => s + d.amount, 0) / 7)}
                    </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', borderLeft: '4px solid #6366f1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>{t('active_talent')}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
                        {hiredApps}
                    </div>
                </div>
            </div>

            {/* Top Talent Insights */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Star size={18} color="#f59e0b" fill="#f59e0b" /> {t('top_talent')}
                    </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {[...applications]
                        .sort((a, b) => (b.workerTrustScore || 0) - (a.workerTrustScore || 0))
                        .filter((app, index, self) => index === self.findIndex((t) => t.workerId === app.workerId))
                        .slice(0, 5)
                        .map((app) => (
                            <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderRadius: '12px', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #d97706, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>
                                        {(app.workerName || 'W')[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{app.workerName}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Briefcase size={12} /> {app.jobTitle || t('seeking_work')}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.9rem' }}>{app.workerTrustScore}%</div>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase' }}>{t('trust_score')}</div>
                                </div>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};


export default WorkforceAnalytics;
