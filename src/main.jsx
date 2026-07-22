import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './i18n'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { registerSW } from 'virtual:pwa-register'

console.log('[DEBUG] Main.jsx: Starting initialization');

// Global Error Handler for Production Diagnostics
window.onerror = (msg, url, lineNo, columnNo, error) => {
    const errorMsg = `[CRITICAL] ${msg} at ${lineNo}:${columnNo}`;
    console.error(errorMsg, error);
    // Force a visual cue if everything else fails
    if (document.getElementById('root')) {
        document.getElementById('root').innerHTML = `<div style="padding:20px; color:red; font-family:sans-serif;">
            <h3>App Launch Error</h3>
            <p>${errorMsg}</p>
            <button onclick="localStorage.clear(); location.reload();">Reset App & Clear Cache</button>
        </div>`;
    }
    return false;
};

// Auto update the service worker
registerSW({ immediate: true })

const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('[CRITICAL] Root element NOT FOUND in DOM');
} else {
    console.log('[DEBUG] Main.jsx: Mounting root');
    createRoot(rootElement).render(
      <StrictMode>
        <ThemeProvider>
            <ToastProvider>
                <App />
            </ToastProvider>
        </ThemeProvider>
      </StrictMode>,
    )
}
