import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTheme } from './contexts/ThemeContext';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import EmployerDashboard from './pages/EmployerDashboard';
import LandingPage from './pages/LandingPage';
import './i18n';
import { Moon, Sun } from 'lucide-react';
import { VoiceProvider } from './contexts/VoiceContext';
import FloatingVoiceAssistant from './components/FloatingVoiceAssistant';

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
    const { user, logout } = useAuth();
    const [showLogin, setShowLogin] = useState(false);

    // If user is logged in, show their dashboard
    if (user) {
        return (
            <div className="main-content-fluid">
                {user.role === 'worker' ? <WorkerDashboard /> : <EmployerDashboard />}
                <ThemeToggle />
            </div>
        );
    }

    // Unauthenticated State (Login/Landing)
    return (
        <div className="main-content-fluid">
            {!showLogin ? (
                <LandingPage onGetStarted={() => setShowLogin(true)} />
            ) : (
                <div style={{minHeight:'100vh', width: '100%'}}>
                     <Login />
                </div>
            )}
            <ThemeToggle />
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <VoiceProvider>
                <Router>
                    <AppContent />
                    <FloatingVoiceAssistant />
                </Router>
            </VoiceProvider>
        </AuthProvider>
    );
}

export default App;
