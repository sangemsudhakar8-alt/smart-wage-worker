import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import EmployerDashboard from './pages/EmployerDashboard';
import LandingPage from './pages/LandingPage';
import { Moon, Sun } from 'lucide-react';
import { VoiceProvider } from './contexts/VoiceContext';
import FloatingVoiceAssistant from './components/FloatingVoiceAssistant';
import VoiceCaption from './components/VoiceCaption';

const PrivateRoute = ({ children, role }) => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (role && user.role !== role) return <Navigate to="/" />;
    return children;
};

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    return (
        <button onClick={toggleTheme} className="audio-btn" style={{position:'fixed', bottom:'20px', right:'20px', zIndex: 100, background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-float)'}}>
            {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
        </button>
    );
};

const AppContent = () => {
    console.log('[DEBUG] AppContent: Rendering start');
    const { user } = useAuth();
    const [showLogin, setShowLogin] = useState(false);

    // If user is logged in, show their dashboard directly
    if (user) {
        return (
            <div className="main-content-fluid">
                {user.role === 'worker' ? <WorkerDashboard /> : <EmployerDashboard />}
                <ThemeToggle />
            </div>
        );
    }

    // Unauthenticated State: Show Landing Page first, then Login
    if (!showLogin) {
        return <LandingPage onGetStarted={() => setShowLogin(true)} />;
    }

    return (
        <div className="main-content-fluid">
            <div style={{minHeight:'100vh', width: '100%'}}>
                 <Login />
            </div>
            <ThemeToggle />
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <VoiceProvider>
                <Router>
                    <React.Suspense fallback={<div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--primary-color)', color:'white', fontWeight:'bold', fontSize:'1.5rem'}}>Smart Wage...</div>}>
                        <AppContent />
                        <FloatingVoiceAssistant />
                        <VoiceCaption />
                    </React.Suspense>
                </Router>
            </VoiceProvider>
        </AuthProvider>
    );
}

export default App;
