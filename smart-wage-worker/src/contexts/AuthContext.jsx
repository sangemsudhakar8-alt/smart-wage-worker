import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem('wageUser');
            if (storedUser && storedUser !== 'undefined') {
                return JSON.parse(storedUser);
            }
        } catch (e) {
            console.warn('Invalid auth state in storage, resetting...', e);
            localStorage.removeItem('wageUser');
        }
        return null;
    });

    const loginUser = (userData) => {
        setUser(userData);
        localStorage.setItem('wageUser', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('wageUser');
    };

    return (
        <AuthContext.Provider value={{ user, loginUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
