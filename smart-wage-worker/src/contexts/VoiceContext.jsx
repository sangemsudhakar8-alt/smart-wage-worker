import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playAudio, stopAudio, pauseAudio, resumeAudio } from '../utils/audio';
import { voiceGuides } from '../config/voiceGuides';

const VoiceContext = createContext();

export const useVoice = () => useContext(VoiceContext);

export const VoiceProvider = ({ children }) => {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState('');
  // New Global Voice Command State
  const [voiceCommand, setVoiceCommand] = useState(null);
  const [isListeningCommand, setIsListeningCommand] = useState(false);
  const commandRecognitionRef = useRef(null);
  
  const listenForCommand = useCallback(() => {
    if (isListeningCommand && commandRecognitionRef.current) {
        commandRecognitionRef.current.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Voice commands are not supported in this browser.");
        return;
    }

    const recognition = new SpeechRecognition();
    const langMap = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' };
    recognition.lang = langMap[i18n.language] || 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListeningCommand(true);
    
    recognition.onresult = (event) => {
        let transcript = event.results[0][0].transcript;
        transcript = transcript.trim().replace(/\.$/, '').toLowerCase();
        
        setVoiceCommand({ text: transcript, timestamp: Date.now() });
    };

    recognition.onend = () => setIsListeningCommand(false);
    recognition.onerror = () => setIsListeningCommand(false);

    commandRecognitionRef.current = recognition;
    recognition.start();
  }, [i18n.language, isListeningCommand]);

  // Track guide state
  const currentGuideRef = useRef(null);
  const currentStepIndexRef = useRef(0);

  // Play a specific step from the current guide
  const playStep = useCallback((guide, stepIndex) => {
    if (!guide || stepIndex >= guide.length) {
      stopGuide();
      return;
    }

    const step = guide[stepIndex];
    const textToSpeak = t(step.textKey);
    const audioUrl = step.audioUrls ? step.audioUrls[i18n.language] : null;
    
    setCurrentText(textToSpeak);
    setHighlightedElementId(step.targetId);

    // Call our new playAudio which expects a URL
    playAudio(audioUrl, {
      onEnd: () => {
        // Move to the next step
        currentStepIndexRef.current += 1;
        playStep(guide, currentStepIndexRef.current);
      },
      onError: () => {
        stopGuide();
      }
    });
  }, [t, i18n.language]);

  const playGuide = useCallback((guideId) => {
    const guide = voiceGuides[guideId];
    if (!guide) return;

    stopAudio();
    setIsPlaying(true);
    setIsPaused(false);
    
    currentGuideRef.current = guide;
    currentStepIndexRef.current = 0;
    
    playStep(guide, 0);
  }, [playStep]);

  const stopGuide = useCallback(() => {
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentText('');
    setHighlightedElementId(null);
    currentGuideRef.current = null;
    currentStepIndexRef.current = 0;
  }, []);

  const pauseGuide = useCallback(() => {
    pauseAudio();
    setIsPaused(true);
  }, []);

  const resumeGuide = useCallback(() => {
    resumeAudio();
    setIsPaused(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const [highlightedElementId, setHighlightedElementId] = useState(null);

  // Update highlighted elements in DOM explicitly by querying them
  useEffect(() => {
    // Remove highlight from old elements
    document.querySelectorAll('.voice-highlight').forEach(el => {
      el.classList.remove('voice-highlight');
    });
    
    // Add highlight to new element
    if (highlightedElementId) {
      const el = document.getElementById(highlightedElementId);
      if (el) {
        el.classList.add('voice-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedElementId]);

  return (
    <VoiceContext.Provider value={{
      isPlaying,
      isPaused,
      currentText,
      highlightedElementId,
      voiceCommand,
      isListeningCommand,
      playGuide,
      pauseGuide,
      resumeGuide,
      stopGuide,
      listenForCommand
    }}>
      {children}
    </VoiceContext.Provider>
  );
};
