import React, { useState } from 'react';
import { Play, Pause, Square, Mic, X, MessageSquare } from 'lucide-react';
import { useVoice } from '../contexts/VoiceContext';

const FloatingVoiceAssistant = () => {
  const { isPlaying, isPaused, currentText, stopGuide, pauseGuide, resumeGuide, listenForCommand, isListeningCommand } = useVoice();
  const [expanded, setExpanded] = useState(false);

  // If a guide is playing, show the Guide player UI
  if (isPlaying) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end w-full max-w-sm">
        {/* Speech Bubble */}
        {currentText && expanded && (
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-t-xl rounded-l-xl shadow-lg border border-indigo-100 dark:border-gray-700 mb-3 ml-4 animate-in fade-in slide-in-from-bottom-2 relative">
            <p className="text-sm font-medium leading-relaxed">{currentText}</p>
            <div className="absolute -bottom-2 right-4 w-4 h-4 bg-white dark:bg-gray-800 border-b border-r border-indigo-100 dark:border-gray-700 transform rotate-45"></div>
          </div>
        )}

        {/* Control Bar for Guide */}
        <div className="bg-indigo-600 text-white rounded-full shadow-2xl flex items-center p-2 backdrop-blur-sm bg-opacity-95">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-indigo-500 transition-colors relative"
          >
            {/* Ripples when active */}
            {!isPaused && (
              <>
                <span className="absolute inset-0 rounded-full bg-indigo-400 opacity-75 animate-ping"></span>
              </>
            )}
            <MessageSquare className="w-6 h-6 text-white relative z-10" />
          </button>

          {expanded && (
            <div className="flex items-center gap-2 px-3 pl-2">
              <div className="h-6 w-px bg-indigo-400 mx-1"></div>
              
              {isPaused ? (
                <button onClick={resumeGuide} className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-full transition-colors" title="Resume Guide">
                  <Play className="w-5 h-5" fill="currentColor" />
                </button>
              ) : (
                <button onClick={pauseGuide} className="p-2 bg-indigo-500 hover:bg-indigo-400 rounded-full transition-colors" title="Pause Guide">
                  <Pause className="w-5 h-5" fill="currentColor" />
                </button>
              )}

              <button onClick={stopGuide} className="p-2 bg-red-500 hover:bg-red-400 rounded-full transition-colors ml-1" title="Stop Guide">
                <Square className="w-4 h-4" fill="currentColor" />
              </button>
              
              <button onClick={() => setExpanded(false)} className="p-2 hover:bg-indigo-500 rounded-full transition-colors ml-2" title="Minimize">
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
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
      <div className={`bg-white dark:bg-gray-800 rounded-full shadow-xl flex items-center p-1 border-2 ${isListeningCommand ? 'border-primary-color pulse' : 'border-indigo-100'}`}>
        <button
          onClick={listenForCommand}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors relative ${isListeningCommand ? 'bg-primary-color text-white' : 'bg-gray-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50'}`}
          title="Voice Command Assistant"
        >
          {isListeningCommand && <span className="absolute inset-0 rounded-full bg-primary-color opacity-30 animate-ping"></span>}
          <Mic className="w-6 h-6 relative z-10" />
        </button>
      </div>
    </div>
  );
};

export default FloatingVoiceAssistant;
