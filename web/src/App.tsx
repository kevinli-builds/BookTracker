import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { hasToken, setApiErrorHandler, setSessionExpiredHandler } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GoalsPage from './pages/GoalsPage';
import UsersPage from './pages/UsersPage';
import DataPage from './pages/DataPage';
import InvitesPage from './pages/InvitesPage';
import SurveyPage from './pages/SurveyPage';
import Nav from './pages/Nav';

export default function App() {
  const [authed, setAuthed] = useState(hasToken());
  const [banner, setBanner] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setApiErrorHandler(message => {
      setBanner(message);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setBanner(null), 6000);
    });
    setSessionExpiredHandler(() => {
      setAuthed(false);
      setNotice('Your session expired. Please log in again.');
    });
    return () => {
      setApiErrorHandler(null);
      setSessionExpiredHandler(null);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const errorBanner = banner && (
    <div style={styles.banner} role="alert">
      <span>{banner}</span>
      <button style={styles.bannerClose} onClick={() => setBanner(null)}>✕</button>
    </div>
  );

  if (!authed) {
    return (
      <>
        {errorBanner}
        <LoginPage notice={notice} onLogin={() => { setNotice(null); setAuthed(true); }} />
      </>
    );
  }

  return (
    <BrowserRouter>
      {errorBanner}
      <Nav onLogout={() => setAuthed(false)} />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/invites" element={<InvitesPage />} />
          <Route path="/survey" element={<SurveyPage />} />
          <Route path="/data" element={<DataPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: '#ef4444',
    color: '#fff',
    padding: '10px 20px',
    fontSize: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  bannerClose: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
  },
};
