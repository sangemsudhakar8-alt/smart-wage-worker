import React from 'react';
import { Check, Clock, ShieldCheck, MapPin, CheckCircle, Award } from 'lucide-react';

const Timeline = ({ currentStatus }) => {
    const steps = [
        { key: 'applied', label: "Applied", icon: <Clock size={20} />, color: 'var(--primary-color)' },
        { key: 'selected', label: "Selected", icon: <ShieldCheck size={20} />, color: 'var(--secondary-color)' },
        { key: 'present', label: "Worked", icon: <MapPin size={20} />, color: 'var(--info-color)' },
        { key: 'paid', label: "Paid", icon: <Award size={20} />, color: 'var(--warning-color)' }
    ];

    const currentStepIndex = steps.findIndex(s => s.key === currentStatus);

    return (
        <div className="timeline-container">
            {steps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCompleted = index < currentStepIndex;

                return (
                    <div key={step.key} className={`timeline-step ${isActive ? 'active' : ''}`}>
                        <div className="timeline-line-wrapper">
                            <div className={`timeline-icon ${isActive ? 'active' : ''}`} style={{ backgroundColor: isActive ? step.color : 'var(--border-color)' }}>
                                {isCompleted ? <Check size={16} /> : step.icon}
                            </div>
                            {index !== steps.length - 1 && (
                                <div className={`timeline-line ${index < currentStepIndex ? 'filled' : ''}`} />
                            )}
                        </div>
                        <div className={`timeline-label ${isActive ? 'active' : ''}`}>
                            {step.label}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default Timeline;
