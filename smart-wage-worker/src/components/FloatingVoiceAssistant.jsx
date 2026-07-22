import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, Mic, X, MessageSquare } from 'lucide-react';
import { useVoice } from '../contexts/VoiceContext';

const FloatingVoiceAssistant = () => {
  const { isPlaying, isPaused, currentText, stopGuide, pauseGuide, resumeGuide, listenForCommand, isListeningCommand, voiceCommand } = useVoice();
  const [expanded, setExpanded] = useState(false);
  const [hiddenCommand, setHiddenCommand] = useState(null);

  useEffect(() => {
    if (voiceCommand) {
      const timer = setTimeout(() => setHiddenCommand(voiceCommand), 3000);
      return () => clearTimeout(timer);
    }
  }, [voiceCommand]);

  const showRecentCommand = Boolean(voiceCommand && hiddenCommand !== voiceCommand);

  // If a guide is playing, show the Guide player UI
  if (isPlaying) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end w-full max-w-sm animate-in">
        {/* Speech Bubble */}
        {currentText && expanded && (
          <div className="card glass-card" style={{ 
            background: 'var(--card-bg)', 
            padding: '1.25rem', 
            borderRadius: '24px 24px 4px 24px', 
            marginBottom: '1rem', 
            maxWidth: '280px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--card-border)'
          }}>
            <p className="text-sm font-medium leading-relaxed" style={{ margin: 0, color: 'var(--text-color)' }}>{currentText}</p>
          </div>
        )}

        {/* Control Bar for Guide - PREMIUM GRADIENT */}
        <div style={{ 
            background: 'var(--gradient-premium)', 
            color: 'white', 
            borderRadius: '100px', 
            boxShadow: 'var(--glow-primary)', 
            display: 'flex', 
            alignItems: 'center', 
            padding: '6px',
            backdropFilter: 'blur(10px)'
        }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ 
                width: '48px', height: '48px', 
                background: 'rgba(255,255,255,0.2)', 
                borderRadius: '50%', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                border: 'none', color: 'white', cursor: 'pointer',
                position: 'relative'
            }}
          >
            {/* Ripples when active */}
            {!isPaused && (
              <span className="absolute inset-0 rounded-full bg-white opacity-40 animate-ping"></span>
            )}
            <MessageSquare className="w-5 h-5 text-white relative z-10" />
          </button>

          {expanded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px 0 8px' }}>
              <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)', margin: '0 4px' }}></div>
              
              {isPaused ? (
                <button onClick={resumeGuide} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }} title="Resume Guide">
                  <Play className="w-4 h-4" fill="currentColor" />
                </button>
              ) : (
                <button onClick={pauseGuide} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }} title="Pause Guide">
                  <Pause className="w-4 h-4" fill="currentColor" />
                </button>
              )}

              <button onClick={stopGuide} style={{ background: 'var(--danger-color)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }} title="Stop Guide">
                <Square className="w-3 h-3" fill="currentColor" />
              </button>
              
              <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', padding: '8px', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="Minimize">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If no guide is playing, show Global Voice Command button
  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end animate-in">
      {/* Transcription Preview (New) */}
      {(isListeningCommand || showRecentCommand) && (
          <div className="animate-in" style={{ 
            background: 'rgba(0,0,0,0.8)', 
            color: 'white', 
            padding: '0.75rem 1.25rem', 
            borderRadius: '16px 16px 4px 16px', 
            marginBottom: '0.75rem', 
            maxWidth: '240px',
            fontSize: '0.85rem',
            fontWeight: 500,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {isListeningCommand && !voiceCommand?.text ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                    <span className="dot-pulse"></span>
                    <span>Listening...</span>
                </div>
            ) : (
                <span>" {voiceCommand?.text} "</span>
            )}
          </div>
      )}

      <div style={{ 
          background: isListeningCommand ? 'var(--primary-color)' : 'var(--card-bg)', 
          borderRadius: '50%', 
          boxShadow: isListeningCommand ? 'var(--glow-primary)' : 'var(--shadow-lg)',
          padding: '4px',
          border: `2px solid ${isListeningCommand ? 'white' : 'var(--card-border)'}`,
          transition: 'all 0.3s ease'
      }}>
        <button
          onClick={listenForCommand}
          style={{ 
              width: '56px', height: '56px', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              borderRadius: '50%', border: 'none',
              background: 'transparent',
              color: isListeningCommand ? 'white' : 'var(--primary-color)',
              cursor: 'pointer',
              position: 'relative'
          }}
          title="Voice Command Assistant"
        >
          {isListeningCommand && <span className="absolute inset-0 rounded-full bg-white opacity-40 animate-ping"></span>}
          <Mic className={`w-6 h-6 relative z-10 ${isListeningCommand ? 'animate-pulse' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default FloatingVoiceAssistant;
