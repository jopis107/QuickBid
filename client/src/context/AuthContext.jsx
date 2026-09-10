import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('quickbid_token');
    const storedUser = localStorage.getItem('quickbid_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  function persistSession(token, user) {
    localStorage.setItem('quickbid_token', token);
    localStorage.setItem('quickbid_user', JSON.stringify(user));
    setUser(user);
  }

  async function register(username, email, password) {
    const { data } = await api.post('/auth/register', { username, email, password });
    persistSession(data.token, data.user);
    return data.user;
  }

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    persistSession(data.token, data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('quickbid_token');
    localStorage.removeItem('quickbid_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
