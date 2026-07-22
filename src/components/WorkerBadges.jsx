import React from 'react';
import { Award, CheckCircle, Star, ShieldCheck } from 'lucide-react';

const BADGE_CONFIG = {
    verified_master: {
        label: 'Verified Master',
        icon: <ShieldCheck size={18} />,
        color: '#6366f1',
        bg: '#eef2ff',
        desc: 'Completed 10+ jobs with excellence'
    },
    attendance_king: {
        label: 'Attendance King',
        icon: <CheckCircle size={18} />,
        color: '#10b981',
        bg: '#ecfdf5',
        desc: 'Maintained 100% attendance record'
    },
    star_performer: {
        label: 'Star Performer',
        icon: <Star size={18} />,
        color: '#f59e0b',
        bg: '#fffbeb',
        desc: 'Consistently rated 4.5+ stars'
    }
};

const WorkerBadges = ({ badges = [] }) => {
    if (!badges || badges.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
            {badges.map(badgeKey => {
                const config = BADGE_CONFIG[badgeKey];
                if (!config) return null;
                
                return (
                    <div 
                        key={badgeKey}
                        title={config.desc}
                        className="badge-item animate-in"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: config.bg,
                            color: config.color,
                            padding: '0.4rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: `1px solid ${config.color}33`,
                            boxShadow: 'var(--shadow-sm)'
                        }}
                    >
                        {config.icon}
                        {config.label}
                    </div>
                );
            })}
        </div>
    );
};

export default WorkerBadges;
