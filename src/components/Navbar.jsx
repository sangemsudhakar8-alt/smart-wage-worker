import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Volume2, LogOut, Globe } from 'lucide-react';
import { playAudio } from '../utils/audio';

const Navbar = () => {
    const { t, i18n } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLanguageChange = (e) => {
        i18n.changeLanguage(e.target.value);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const speakTitle = () => {
        playAudio(t('app_name'), i18n.language);
    };

    return (
        <div className="nav-bar">
            <h2 onClick={speakTitle} style={{ cursor: 'pointer' }}>
                <Volume2 size={24} /> {t('app_name')}
            </h2>
            <div className="nav-actions">
                <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '4px', padding: '2px 8px' }}>
                    <Globe size={18} color="black" />
                    <select 
                        onChange={handleLanguageChange} 
                        value={i18n.language}
                        style={{ border: 'none', outline: 'none', background: 'transparent', padding: '4px', color:'black' }}
                    >
                        <option value="en">English</option>
                        <option value="te">తెలుగు</option>
                        <option value="hi">हिंदी</option>
                    </select>
                </div>
                {user && (
                    <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                        <LogOut size={24} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Navbar;
