import React, { useState, useRef } from 'react';
import { Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';

const VoiceInput = ({ value, onChange, placeholder, type = 'text', required = false, className = "form-input", style = {} }) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const { i18n } = useTranslation();
    const { showToast } = useToast();

    const handleVoice = (e) => {
        e.preventDefault();
        
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("Voice input is not supported in this browser.", "error");
            return;
        }

        const recognition = new SpeechRecognition();
        const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
        recognition.lang = langMap[i18n.language] || 'en-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            
            // Clean up periods or trailing spaces
            transcript = transcript.trim().replace(/\.$/, '');
            
            // Simulate an event object to work with standard onChange handlers
            onChange({ target: { value: transcript } });
            
            // Optional: small confirmation toast for dictated input
            showToast(`Dictated: "${transcript}"`, "info");
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            setIsListening(false);
            if (event.error !== 'no-speech') {
                console.warn("Speech recognition error:", event.error);
                showToast("Voice input error. Please try again.", "error");
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input 
                type={type}
                className={className} 
                value={value} 
                onChange={onChange} 
                placeholder={placeholder}
                required={required}
                style={{ ...style, paddingRight: '44px', width: '100%' }}
            />
            <button 
                type="button"
                onClick={handleVoice} 
                className={`btn ${isListening ? 'btn-primary pulse' : 'btn-outline'}`}
                style={{ 
                    position: 'absolute', 
                    right: '4px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    width: '36px', 
                    height: '36px',
                    padding: '0', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    borderRadius: '8px', 
                    border: 'none',
                    background: isListening ? 'var(--primary-color)' : 'transparent',
                    boxShadow: 'none'
                }}
                title="Dictate Input"
            >
                <Mic size={18} color={isListening ? 'white' : '#9ca3af'} />
            </button>
        </div>
    );
};

export default VoiceInput;
