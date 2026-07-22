import React from 'react';

const Skeleton = ({ width, height, borderRadius = 'var(--radius-md)', margin = '0' }) => {
    return (
        <div 
            className="skeleton-pulse"
            style={{
                width: width || '100%',
                height: height || '20px',
                borderRadius: borderRadius,
                margin: margin,
                background: 'var(--border-color)',
                opacity: 0.6
            }}
        />
    );
};

export const CardSkeleton = () => (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <Skeleton width="40%" height="24px" />
            <Skeleton width="20%" height="20px" borderRadius="12px" />
        </div>
        <Skeleton width="90%" height="16px" margin="0 0 0.5rem" />
        <Skeleton width="60%" height="16px" margin="0 0 1.5rem" />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Skeleton width="48%" height="40px" />
            <Skeleton width="48%" height="40px" />
        </div>
    </div>
);

export const StatsSkeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1rem' }}>
        {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: '1rem', margin: 0, textAlign: 'center' }}>
                <Skeleton width="30px" height="30px" borderRadius="50%" margin="0 auto 10px" />
                <Skeleton width="60%" height="24px" margin="0 auto 5px" />
                <Skeleton width="40%" height="12px" margin="0 auto" />
            </div>
        ))}
    </div>
);

export default Skeleton;
