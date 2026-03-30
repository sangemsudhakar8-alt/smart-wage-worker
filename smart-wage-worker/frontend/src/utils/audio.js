/**
 * Robust audio utility using HTMLAudioElement.
 * Manages playing natural, pre-recorded human voice files (MP3).
 * Supports play, pause, resume, and stop controls.
 */

// Singleton audio element to ensure only one audio plays at a time
let currentAudio = null;

/**
 * Main public API — call this to play an audio file.
 * @param {string} url - The URL of the MP3 file to play.
 * @param {object} callbacks - Optional \{onEnd, onError\}
 */
export const playAudio = (url, callbacks = null) => {
    // Stop any currently playing audio
    stopAudio();

    if (!url) {
        console.warn('Audio URL is missing. Falling back gracefully...');
        // Simulate completion to not break sequential sequences
        if (callbacks?.onEnd && typeof callbacks.onEnd === 'function') {
            setTimeout(callbacks.onEnd, 500); 
        }
        return;
    }

    currentAudio = new Audio(url);

    // Event listeners
    const handleEnded = () => {
        cleanupListeners();
        if (callbacks?.onEnd) callbacks.onEnd();
    };

    const handleError = (e) => {
        console.error('Audio playback error for:', url, e);
        cleanupListeners();
        // If file is missing (e.g. 404), continue to next step anyway so the app doesn't break
        if (callbacks?.onEnd) callbacks.onEnd();
        if (callbacks?.onError) callbacks.onError(e);
    };

    const cleanupListeners = () => {
        if (!currentAudio) return;
        currentAudio.removeEventListener('ended', handleEnded);
        currentAudio.removeEventListener('error', handleError);
    };

    currentAudio.addEventListener('ended', handleEnded);
    currentAudio.addEventListener('error', handleError);

    // Attempt to play
    currentAudio.play().catch(err => {
        // Handle AbortError or NotAllowedError (autoplay blocked)
        handleError(err);
    });
};

/**
 * Stop any currently playing audio and reset it.
 */
export const stopAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null; // drop reference
    }
};

/**
 * Pause any currently playing audio.
 */
export const pauseAudio = () => {
    if (currentAudio && !currentAudio.paused) {
        currentAudio.pause();
    }
};

/**
 * Resume any paused audio.
 */
export const resumeAudio = () => {
    if (currentAudio && currentAudio.paused) {
        currentAudio.play().catch(console.error);
    }
};
