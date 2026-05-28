import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { hasToken } from './api/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GoalsPage from './pages/GoalsPage';
import UsersPage from './pages/UsersPage';
import DataPage from './pages/DataPage';
import Nav from './pages/Nav';

export default function App() {
  const [authed, setAuthed] = useState(hasToken());

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <Nav onLogout={() => setAuthed(false)} />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/data" element={<DataPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
