import React, { useEffect, useState } from 'react';
import { CheckCircle, Award, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Celebration = ({ title, subtitle, onComplete, duration = 4000 }) => {
    const { t } = useTranslation();
    const [confetti] = useState(() => {
        const pieces = [];
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#a855f7'];
        
        for (let i = 0; i < 50; i++) {
            pieces.push({
                id: i,
                left: Math.random() * 100 + 'vw',
                delay: Math.random() * 3 + 's',
                color: colors[Math.floor(Math.random() * colors.length)],
                size: (Math.random() * 10 + 5) + 'px'
            });
        }
        return pieces;
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            if (onComplete) onComplete();
        }, duration);

        return () => clearTimeout(timer);
    }, [onComplete, duration]);

    return (
        <div className="completion-overlay">
            {confetti.map(p => (
                <div 
                    key={p.id} 
                    className="confetti" 
                    style={{ 
                        left: p.left, 
                        animationDelay: p.delay, 
                        backgroundColor: p.color,
                        width: p.size,
                        height: p.size
                    }} 
                />
            ))}
            
            <div className="celebration-card animate-badge">
                <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    background: 'rgba(16, 185, 129, 0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    border: '2px solid var(--secondary-color)'
                }}>
                    <CheckCircle size={48} color="var(--secondary-color)" />
                </div>
                
                <h1 style={{ fontSize: '2.5rem', margin: '0 0 0.5rem', fontWeight: 900, color: 'var(--text-dark)' }}>
                    {title || '100%'}
                </h1>
                <p style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700, color: 'var(--secondary-color)' }}>
                    {subtitle || t('profile_updated') || 'Completed!'}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '2rem' }}>
                    <Star color="#f59e0b" fill="#f59e0b" size={24} />
                    <Award color="#6366f1" size={32} />
                    <Star color="#f59e0b" fill="#f59e0b" size={24} />
                </div>
            </div>
        </div>
    );
};

export default Celebration;
