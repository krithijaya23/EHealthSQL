import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProfileProvider } from './context/ProfileContext';

import Layout from './components/layout/Layout';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/Dashboard';
import UploadRecord from './pages/UploadRecord';
import MedicalHistory from './pages/MedicalHistory';
import RecordDetails from './pages/RecordDetails';
import HealthInsights from './pages/HealthInsights';
import ShareAccess from './pages/ShareAccess';
import DoctorDashboard from './pages/DoctorDashboard';
import Settings from './pages/Settings';
import ManagedAccount from './pages/ManagedAccount';
import Reminders from './pages/Reminders';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="upload" element={<UploadRecord />} />
        <Route path="history" element={<MedicalHistory />} />
        <Route path="history/:id" element={<RecordDetails />} />
        <Route path="insights" element={<HealthInsights />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="share" element={<ShareAccess />} />
        <Route path="doctor" element={<DoctorDashboard />} />
        <Route path="managed-account/:ownerUserId" element={<ManagedAccount />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AuthProvider>
          <ProfileProvider>
            <Router>
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    boxShadow: 'var(--shadow)',
                  },
                  // Error toasts stay longer
                  error: {
                    duration: 6000,
                    style: {
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                    },
                  },
                  success: {
                    duration: 3500,
                  },
                }}
              />
            </Router>
          </ProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
