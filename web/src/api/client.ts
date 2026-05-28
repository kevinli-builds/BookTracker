import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const api = axios.create({ baseURL: BASE_URL });

let _token: string | null = localStorage.getItem('admin_token');

export function setToken(t: string) {
  _token = t;
  localStorage.setItem('admin_token', t);
  api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
}

export function clearToken() {
  _token = null;
  localStorage.removeItem('admin_token');
  delete api.defaults.headers.common['Authorization'];
}

export function hasToken() {
  return !!_token;
}

if (_token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${_token}`;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const { data } = await api.post('/admin/login', { email, password });
  setToken(data.token);
  return data;
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  displayName: string | null;
  createdAt: string;
  streak: { currentStreak: number; longestStreak: number } | null;
  _count: { logs: number; userGoals: number };
}

export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await api.get('/admin/users');
  return data;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  type: string;
  criteria: Record<string, unknown>;
  randomPool: boolean;
  createdAt: string;
  _count?: { userGoals: number };
}

export async function getAdminGoals(): Promise<GoalTemplate[]> {
  const { data } = await api.get('/admin/goals');
  return data;
}

export async function createGoal(payload: Omit<GoalTemplate, 'id' | 'createdAt' | '_count'>): Promise<GoalTemplate> {
  const { data } = await api.post('/admin/goals', payload);
  return data;
}

export async function updateGoal(id: string, payload: Partial<GoalTemplate>): Promise<GoalTemplate> {
  const { data } = await api.patch(`/admin/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string) {
  await api.delete(`/admin/goals/${id}`);
}

export async function assignGoals(userIds?: string[], deadline?: string) {
  const { data } = await api.post('/admin/assign', { userIds, deadline });
  return data as { assigned: number };
}

// ── Data ───────────────────────────────────────────────────────────────────

export interface AdminData {
  totalUsers: number;
  totalLogs: number;
  totalGoals: number;
  completedGoals: number;
  completionRate: number;
  topBooks: { googleBooksId: string; title: string; author: string; _count: { googleBooksId: number } }[];
  goalCompletionRates: { id: string; title: string; total: number; completed: number; rate: number }[];
  recentFeedback: {
    id: string;
    userId: string;
    rating: number | null;
    text: string | null;
    createdAt: string;
    userGoal: { template: { title: string } };
  }[];
}

export async function getAdminData(): Promise<AdminData> {
  const { data } = await api.get('/admin/data');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.post('/admin/change-password', { currentPassword, newPassword });
}

// ── Reading Logs (raw export) ────────────────────────────────────────────────

export interface AdminReadingLog {
  id: string;
  userId: string;
  user: { displayName: string | null };
  googleBooksId: string;
  title: string;
  author: string;
  minutesRead: number;
  loggedAt: string;
}

export async function getAllLogs(): Promise<AdminReadingLog[]> {
  const { data } = await api.get('/admin/logs');
  return data;
}
