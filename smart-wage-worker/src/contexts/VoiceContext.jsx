import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { playAudio, stopAudio, pauseAudio, resumeAudio, subscribeToSpeech, preWarmAudio } from '../utils/audio';
import { voiceGuides } from '../config/voiceGuides';

const VoiceContext = createContext();

export const useVoice = () => useContext(VoiceContext);

export const VoiceProvider = ({ children }) => {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState('');
  
  // Transcription & Captions
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeTranscription, setActiveTranscription] = useState('');
  const [hasVoiceSupport, setHasVoiceSupport] = useState(true);

  // New Global Voice Command State
  const [voiceCommand, setVoiceCommand] = useState(null);
  const [isListeningCommand, setIsListeningCommand] = useState(false);
  const [lastIntent, setLastIntent] = useState(null);
  const commandRecognitionRef = useRef(null);
  
  // Pre-warm audio system on mount
  useEffect(() => {
    preWarmAudio();
  }, []);
  
  // Sync with audio utility events
  useEffect(() => {
    const unsubscribe = subscribeToSpeech((event) => {
      if (event.type === 'start') {
        setIsSpeaking(true);
        setActiveTranscription(event.text);
        setHasVoiceSupport(event.hasVoice);
      } else if (event.type === 'end' || event.type === 'error') {
        // Delay clearing transcription slightly for readability
        setTimeout(() => {
          setIsSpeaking(false);
          setActiveTranscription('');
        }, 1200);
      } else if (event.type === 'pause') {
        setIsSpeaking(false);
      } else if (event.type === 'resume') {
        setIsSpeaking(true);
      }
    });
    return unsubscribe;
  }, []);

  const processCommand = useCallback((transcript) => {
    const text = transcript.toLowerCase().trim();
    let intent = null;

    // --- INTENT DEFINITIONS (Multi-language optimized) ---
    
    // 1. Navigation intents
    const intents = {
        'jobs': /job|search|naukri|kaam|dhundo|khoj|pani|vethuku|udhyogam|chahiye|kavali|పని|వెతుకు|ఉద్యోగం|కావాలి|काम|नौकरी|चाहिए/i,
        'profile': /profile|setting|khata|naa vivaralu|vivaralu|naa profile|నా వివరాలు|సెట్టింగ్స్|प्रोफ़ाइल|प्रोफाइल/i,
        'apps': /application|applied|aavedan|arji|dharakhasthu|naa dharakhasthulu|నా దరఖాస్తులు|అప్లికేషన్|अर्जी/i,
        'home': /home|dashboard|mukhya|home page|mukhya peji|ముఖ్యం|ముఖ్య పేజీ|ఏమైంది|హోమ్|होम|घर/i,
        'post': /post|new job|naya kaam|kotha pani|కొత్త పని|పోస్ట్|నయా కామ్|नया काम/i,
        'attendance': /attendance|presence|haaziri|hajaru|haajiru|హాజరు|హజరు|హాజరీ|हाजिरी/i,
        'leaves': /leave|chutti|selavu|సెలవు|छुट्टी/i,
        'track': /track|map|locat|position|rast|దగ్గర|ట్రాక్|ట్రాకింగ్|ఖోజ్/i,
    };

    for (const [key, regex] of Object.entries(intents)) {
        if (regex.test(text)) {
            intent = { type: 'navigate', view: key };
            break;
        }
    }

    // 2. Search query extraction (Enhancement)
    if (intent?.view === 'jobs') {
        const match = text.match(/(?:for|searching|looking|want|need|dhundo|vethuku|khoj|is)\s+(.+?)(?:\s+work|\s+job|\s+kaam|\s+pani|$)/i) 
                    || text.match(/(.+?)\s+(?:chahiye|kavali|dhundo)/i);
        if (match) {
            let query = match[1].replace(/my name is \w+|i am|please|now|show me|mera naam \w+ hai|mera naam \w+|naa peru \w+/ig, '').trim();
            intent.params = { query };
        }
    }

    // 3. Action intents (e.g., Help)
    if (/help|madad|sahayam|guide|సహాయం|సహాయం కావాలి|సరే|మదద్|मदद/i.test(text)) {
        intent = { type: 'action', action: 'help' };
    }

    if (intent) {
        setLastIntent({ ...intent, timestamp: Date.now() });
        
        // --- SPOKEN CONFIRMATION (Premium Engagement) ---
        const confirmations = {
            'home': { en: "Going back home.", te: "ముఖ్య పేజీకి తీసుకువెళుతున్నాను.", hi: "मुख्य पृष्ठ पर जा रहे हैं।" },
            'jobs': { en: intent.params?.query ? `Searching for ${intent.params.query}` : "Showing available jobs.", te: intent.params?.query ? `${intent.params.query} పనుల కోసం వెతుకుతున్నాను.` : "పనుల వివరాలు చూపిస్తున్నాను.", hi: intent.params?.query ? `${intent.params.query} काम ढूंढ रहे हैं।` : "काम की जानकारी दिखा रहे हैं।" },
            'profile': { en: "Opening your profile.", te: "మీ ప్రొఫైల్ వివరాలు తీస్తున్నాను.", hi: "आपकी प्रोफाइल खोल रहे हैं।" },
            'apps': { en: "Showing your applications.", te: "మీ దరఖాస్తులు చూపిస్తున్నాను.", hi: "आपकी अर्जी दिखा रहे हैं।" },
            'attendance': { en: "Opening attendance.", te: "హాజరు వివరాలు చూపిస్తున్నాను.", hi: "हाजिरी देख रहे हैं।" },
            'post': { en: "Posting a new job.", te: "కొత్త పని నమోదు చేస్తున్నాను.", hi: "नया काम डाल रहे हैं।" },
            'track': { en: "Opening live tracking.", te: "ట్రాకింగ్ మ్యాప్ తీస్తున్నాను.", hi: "ट्रैकिंग खोल रहे हैं।" },
            'help': { en: "Starting voice guide.", te: "వాయిస్ గైడ్ ప్రారంభిస్తున్నాను.", hi: "वॉइस गाइड शुरू कर रहे हैं।" }
        };

        const target = intent.type === 'navigate' ? intent.view : intent.action;
        const msg = confirmations[target]?.[i18n.language] || confirmations[target]?.en;
        if (msg) playAudio(msg, i18n.language);
    }
  }, [i18n.language]);

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
        transcript = transcript.trim().replace(/\.$/, '');
        
        setVoiceCommand({ text: transcript, timestamp: Date.now() });
        processCommand(transcript);
    };

    recognition.onend = () => setIsListeningCommand(false);
    recognition.onerror = () => setIsListeningCommand(false);

    commandRecognitionRef.current = recognition;
    recognition.start();
  }, [i18n.language, isListeningCommand, processCommand]);

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
    
    setCurrentText(textToSpeak);
    setHighlightedElementId(step.targetId);

    // Call our speech-enabled playAudio
    playAudio(textToSpeak, i18n.language, {
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
      lastIntent,
      isSpeaking,
      activeTranscription,
      hasVoiceSupport,
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
