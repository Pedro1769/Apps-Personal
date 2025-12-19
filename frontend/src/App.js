import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import AnimatedBackground from './components/AnimatedBackground';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import VoiceStudio from './pages/VoiceStudio';
import SongCreator from './pages/SongCreator';
import './App.css';

const ProtectedRoute = ({ children, user }) => {
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C0E] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="App min-h-screen bg-[#0B0C0E]">
      <BrowserRouter>
        <AnimatedBackground />
        <Navbar user={user} onLogout={handleLogout} />
        
        <main className="relative z-10">
          <Routes>
            <Route 
              path="/" 
              element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} 
            />
            <Route 
              path="/auth" 
              element={user ? <Navigate to="/dashboard" replace /> : <AuthPage onLogin={handleLogin} />} 
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute user={user}>
                  <Dashboard token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/voice-studio"
              element={
                <ProtectedRoute user={user}>
                  <VoiceStudio token={token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create"
              element={
                <ProtectedRoute user={user}>
                  <SongCreator token={token} />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
        
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111318',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#E6E7E9',
            },
          }}
        />
      </BrowserRouter>
    </div>
  );
}

export default App;
