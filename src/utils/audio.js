/**
 * Robust audio utility using Web Speech API (SpeechSynthesis).
 * Optimized for English, Telugu, and Hindi with high-quality voice selection.
 */

let currentUtterance = null;
let fallbackAudio = null;
const listeners = new Set();

/**
 * Register a listener for speech events.
 * Returns an unsubscribe function.
 */
export const subscribeToSpeech = (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
};

const broadcast = (event) => {
    listeners.forEach(cb => cb(event));
};

// Helper to find the best available voice for a given language
const getBestVoice = (langCode) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // Direct mapping for our supported languages
    const langMap = {
        'en': 'en-IN',
        'te': 'te-IN',
        'hi': 'hi-IN'
    };
    const targetLang = langMap[langCode] || langCode;
    const baseLang = targetLang.split('-')[0];

    // Priority 1: Exact Locale Match (e.g., hi-IN)
    let matches = voices.filter(v => v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase());
    
    // Priority 2: Base Language Match (e.g., hi)
    if (matches.length === 0) {
        matches = voices.filter(v => v.lang.toLowerCase().startsWith(baseLang.toLowerCase()));
    }

    // Special case for English: default to en-US if en-IN is missing
    if (matches.length === 0 && baseLang === 'en') {
        matches = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    }

    if (matches.length === 0) return null;

    // Within matches, prioritize natural/online/premium voices
    const premiumPaths = ['Online', 'Natural', 'Neural', 'Google', 'Microsoft'];
    
    // Create a sorted list based on priority
    const sortedMatches = [...matches].sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Find best index for each
        const aIndex = premiumPaths.findIndex(p => aName.includes(p.toLowerCase()));
        const bIndex = premiumPaths.findIndex(p => bName.includes(p.toLowerCase()));

        // If one is in premiumPaths and other isn't, favor it
        if (aIndex !== -1 && bIndex === -1) return -1;
        if (aIndex === -1 && bIndex !== -1) return 1;
        
        // If both are in, favor the one with earlier index in premiumPaths
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

        return 0; // Keep original order otherwise
    });

    return sortedMatches[0] || null;
};

/**
 * Main public API — speaks the provided text.
 * @param {string} text - The text to speak.
 * @param {string} lang - The language code (en, te, hi).
 * @param {object} callbacks - Optional {onEnd, onError}
 */
export const playAudio = (text, lang = 'en', callbacks = null) => {
    stopAudio();

    if (!text) {
        if (callbacks?.onEnd) callbacks.onEnd();
        return;
    }

    if (!window.speechSynthesis) {
        console.warn('Speech Synthesis not supported in this browser.');
        if (callbacks?.onEnd) callbacks.onEnd();
        return;
    }

    const setVoiceAndSpeak = () => {
        const voice = getBestVoice(lang);
        
        if (voice) {
            const utterance = new SpeechSynthesisUtterance(text);
            currentUtterance = utterance;
            utterance.voice = voice;
            utterance.lang = voice.lang; // Use the actual voice lang
            
            // ADJUST: Premium tuning for Indian languages (Telugu/Hindi)
            // Rural workers often prefer slightly slower, clearer speech.
            if (lang === 'te') {
                utterance.rate = 0.82; // Slower for clarity
                utterance.pitch = 0.95; // Slightly deeper, more natural
            } else if (lang === 'hi') {
                utterance.rate = 0.8;
                utterance.pitch = 1.0;
            } else {
                utterance.rate = 0.95;
                utterance.pitch = 1.0;
            }

            utterance.onstart = () => broadcast({ type: 'start', text, lang, hasVoice: true });
            utterance.onend = () => {
                currentUtterance = null;
                broadcast({ type: 'end' });
                if (callbacks?.onEnd) callbacks.onEnd();
            };
            utterance.onerror = (e) => {
                console.warn('SpeechSynthesis error:', e);
                currentUtterance = null;
                broadcast({ type: 'error', error: e });
                if (callbacks?.onEnd) callbacks.onEnd();
            };

            window.speechSynthesis.speak(utterance);
        } else {
            // FALLBACK: Google Translate TTS API (gtx client is more stable for web)
            console.log(`No native voice for ${lang}. Using network fallback...`);
            const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx&total=1&idx=0&textlen=${text.length}`;
            
            fallbackAudio = new Audio();
            fallbackAudio.src = fallbackUrl;
            
            fallbackAudio.onplay = () => broadcast({ type: 'start', text, lang, hasVoice: false });
            fallbackAudio.onended = () => {
                fallbackAudio = null;
                broadcast({ type: 'end' });
                if (callbacks?.onEnd) callbacks.onEnd();
            };
            fallbackAudio.onerror = (e) => {
                console.error('Fallback audio failed:', e);
                broadcast({ type: 'error', error: 'FALLBACK_FAILED' });
                if (callbacks?.onEnd) callbacks.onEnd();
            };

            const playPromise = fallbackAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    if (err.name === 'NotAllowedError') {
                        console.warn('Auto-playback blocked. User interaction required.');
                        broadcast({ type: 'error', error: 'USER_INTERACTION_REQUIRED' });
                    } else {
                        console.error('Playback failed:', err);
                        broadcast({ type: 'error', error: err.name });
                    }
                    if (callbacks?.onEnd) callbacks.onEnd();
                });
            }
        }
    };

    // Ensure voices are loaded
    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null; // Prevent double call
            setVoiceAndSpeak();
        };
    } else {
        setVoiceAndSpeak();
    }
};

/**
 * Stop any currently playing speech.
 */
export const stopAudio = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        if (currentUtterance) {
            broadcast({ type: 'end' });
        }
        currentUtterance = null;
    }
    if (fallbackAudio) {
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
        broadcast({ type: 'end' });
        fallbackAudio = null;
    }
};

/**
 * Pause any currently playing speech.
 */
export const pauseAudio = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.pause();
        broadcast({ type: 'pause' });
    }
    if (fallbackAudio) {
        fallbackAudio.pause();
        broadcast({ type: 'pause' });
    }
};

/**
 * Resume any paused speech.
 */
export const resumeAudio = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.resume();
        broadcast({ type: 'resume' });
    }
    if (fallbackAudio) {
        fallbackAudio.play();
        broadcast({ type: 'resume' });
    }
};

/**
 * Pre-warm the speech synthesis system to ensure voices are loaded.
 * Call this in the main entry point or VoiceProvider.
 */
export const preWarmAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
    }
};

