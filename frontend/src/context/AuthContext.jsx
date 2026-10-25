import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('hotel_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Initial temporary hydrate from localStorage
      const storedUser = localStorage.getItem('hotel_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          // Ignore invalid JSON
        }
      }

      try {
        const { data } = await api.get('/auth/me');
        const refreshedUser = {
          ...data.user,
          customer_id: data.customer ? data.customer.customer_id : null,
          name: data.customer ? data.customer.name : data.user.username,
        };
        localStorage.setItem('hotel_user', JSON.stringify(refreshedUser));
        setUser(refreshedUser);
      } catch {
        // Validation failed -> clear session
        localStorage.removeItem('hotel_token');
        localStorage.removeItem('hotel_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('hotel_token', data.token);
    localStorage.setItem('hotel_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    await api.post('/auth/register', payload);
  };

  const logout = () => {
    localStorage.removeItem('hotel_token');
    localStorage.removeItem('hotel_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react/only-export-components, react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
