import React, { createContext, useContext, useState } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <div key={t.id} className="toast" style={{borderLeft: `4px solid ${t.type === 'success' ? 'var(--secondary-color)' : t.type === 'error' ? 'var(--danger-color)' : 'var(--info-color)'}`}}>
                        {t.type === 'success' && <CheckCircle color="var(--secondary-color)" size={20} />}
                        {t.type === 'error' && <XCircle color="var(--danger-color)" size={20} />}
                        {t.type === 'info' && <Info color="var(--info-color)" size={20} />}
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
