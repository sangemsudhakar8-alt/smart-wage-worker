/**
 * Robust text-to-speech utility using the Web Speech API.
 * Handles:
 *  - Chrome bug: speechSynthesis cuts off on long text (chunking)
 *  - Voice selection per language (prefers native voices)
 *  - Graceful fallback to any available voice
 *  - Retry on voices not yet loaded
 */

const LANG_MAP = {
    en: 'en-IN',
    hi: 'hi-IN',
    te: 'te-IN',
};

/**
 * Find the best voice for a given language tag.
 * Preference: exact locale > language prefix > any voice
 */
const findVoice = (langTag) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    // 1. Exact locale match (e.g. 'te-IN')
    let voice = voices.find(v => v.lang === langTag);
    if (voice) return voice;

    // 2. Language prefix match (e.g. 'te' in 'te-IN')
    const prefix = langTag.split('-')[0];
    voice = voices.find(v => v.lang.startsWith(prefix));
    if (voice) return voice;

    // 3. Fallback: en-US or en-GB
    voice = voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB');
    if (voice) return voice;

    // 4. Last resort: first available voice
    return voices[0] || null;
};

/**
 * Split text into chunks at sentence boundaries to avoid Chrome cut-off bug.
 */
const splitIntoChunks = (text, maxLen = 180) => {
    if (text.length <= maxLen) return [text];
    // Split on sentence-ending punctuation
    const chunks = [];
    const sentences = text.split(/(?<=[.!?।\u0964])\s+/);
    let current = '';
    for (const s of sentences) {
        if ((current + ' ' + s).trim().length > maxLen) {
            if (current) chunks.push(current.trim());
            current = s;
        } else {
            current = (current + ' ' + s).trim();
        }
    }
    if (current) chunks.push(current.trim());
    return chunks.length ? chunks : [text];
};

/**
 * Speak a sequence of utterance chunks with proper queueing.
 */
const speakChunks = (chunks, langTag, voice) => {
    window.speechSynthesis.cancel();
    chunks.forEach((chunk, i) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = langTag;
        utterance.rate = 0.88;
        utterance.pitch = 1.05;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
    });
};

/**
 * Main public API — call this to speak any text.
 * @param {string} text - The text to speak.
 * @param {string} lang - Language key: 'en' | 'hi' | 'te'
 */
export const playAudio = (text, lang = 'en') => {
    if (!window.speechSynthesis) {
        console.warn('Speech Synthesis not supported in this browser.');
        return;
    }

    const langTag = LANG_MAP[lang] || 'en-IN';
    const chunks = splitIntoChunks(text);

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        // Voices already loaded
        const voice = findVoice(langTag);
        speakChunks(chunks, langTag, voice);
    } else {
        // Chrome loads voices asynchronously — wait for them
        const onVoicesChanged = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            const voice = findVoice(langTag);
            speakChunks(chunks, langTag, voice);
        };
        window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
        // Safety timeout: speak anyway after 1s even if event never fires
        setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
            speakChunks(chunks, langTag, null);
        }, 1000);
    }
};

/**
 * Stop any currently playing speech.
 */
export const stopAudio = () => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};
