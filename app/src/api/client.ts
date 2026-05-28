import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://localhost:3000';

const api = axios.create({ baseURL: BASE_URL });

// ── Users ──────────────────────────────────────────────────────────────────

export async function upsertUser(userId: string, displayName?: string) {
  const { data } = await api.post('/users', { userId, displayName });
  return data;
}

export async function redeemInvite(userId: string, code: string) {
  const { data } = await api.post('/invites/redeem', { userId, code });
  return data as { displayName: string | null; hasAccess: boolean };
}

// ── Books ──────────────────────────────────────────────────────────────────

export interface BookResult {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string[];
}

export async function searchBooks(q: string): Promise<BookResult[]> {
  const { data } = await api.get('/books/search', { params: { q } });
  return data;
}

// ── Reading Logs ───────────────────────────────────────────────────────────

export interface ReadingLog {
  id: string;
  userId: string;
  googleBooksId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  minutesRead: number;
  loggedAt: string;
}

export async function logBook(params: {
  userId: string;
  googleBooksId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  minutesRead?: number;
}): Promise<ReadingLog> {
  const { data } = await api.post('/logs', params);
  return data;
}

export async function getLogs(userId: string): Promise<ReadingLog[]> {
  const { data } = await api.get(`/logs/${userId}`);
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
}

export interface UserGoal {
  id: string;
  userId: string;
  templateId: string;
  status: 'active' | 'completed' | 'abandoned';
  assignedBy: 'self' | 'system';
  assignedAt: string;
  completedAt: string | null;
  deadline: string | null;
  template: GoalTemplate;
}

export async function getGoalTemplates(): Promise<GoalTemplate[]> {
  const { data } = await api.get('/goals/templates');
  return data;
}

export async function getUserGoals(userId: string): Promise<UserGoal[]> {
  const { data } = await api.get(`/goals/${userId}`);
  return data;
}

export async function addSelfGoal(userId: string, templateId: string, deadline?: string): Promise<UserGoal> {
  const { data } = await api.post('/goals/self', { userId, templateId, deadline });
  return data;
}

export async function completeGoal(goalId: string): Promise<UserGoal> {
  const { data } = await api.patch(`/goals/${goalId}/complete`);
  return data;
}

export async function abandonGoal(goalId: string): Promise<UserGoal> {
  const { data } = await api.patch(`/goals/${goalId}/abandon`);
  return data;
}

// ── Feedback ───────────────────────────────────────────────────────────────

export async function submitFeedback(params: {
  userId: string;
  userGoalId: string;
  rating?: number;
  text?: string;
}) {
  const { data } = await api.post('/feedback', params);
  return data;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export interface UserStats {
  totalBooks: number;
  totalMinutes: number;
  totalHours: number;
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string | null;
  booksPerMonth: { month: string; count: number }[];
  topBooks: { title: string; author: string; coverUrl: string | null; minutes: number }[];
  completedGoals: number;
  activeGoals: number;
}

export async function getStats(userId: string): Promise<UserStats> {
  const { data } = await api.get(`/stats/${userId}`);
  return data;
}
