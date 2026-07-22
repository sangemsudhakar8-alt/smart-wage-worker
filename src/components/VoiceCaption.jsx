import React from 'react';
import { useVoice } from '../contexts/VoiceContext';
import { VolumeX, Volume2, Mic } from 'lucide-react';

const VoiceCaption = () => {
    const { isSpeaking, activeTranscription, hasVoiceSupport } = useVoice();

    if (!isSpeaking || !activeTranscription) return null;

    return (
        <div 
            className="animate-in"
            style={{
                position: 'fixed',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10000,
                width: '90%',
                maxWidth: '600px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'none'
            }}
        >
            {/* Warning if no voice support */}
            {!hasVoiceSupport && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    alignSelf: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                    backdropFilter: 'blur(4px)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <VolumeX size={12} /> System voice missing - Reading from transcript
                </div>
            )}

            {/* Main Caption Bubble */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(25px) saturate(180%)',
                WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '24px',
                padding: '1.25rem 1.75rem',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
            }}>
                <div style={{
                    minWidth: '40px',
                    height: '40px',
                    background: hasVoiceSupport ? 'var(--primary-color)' : '#64748b',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    animation: 'pulse 1.5s infinite'
                }}>
                    <Volume2 size={20} color="white" />
                </div>
                
                <div style={{ flex: 1 }}>
                    <div style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 800, 
                        color: 'var(--primary-color)', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.1em',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}>
                        <Mic size={10} /> Smart Assistant
                    </div>
                    <p style={{ 
                        margin: 0, 
                        fontSize: '1.05rem', 
                        fontWeight: 600, 
                        color: '#1e293b',
                        lineHeight: 1.4,
                        letterSpacing: '-0.01em'
                    }}>
                        {activeTranscription}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VoiceCaption;
