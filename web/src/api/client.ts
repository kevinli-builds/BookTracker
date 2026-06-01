import axios, { AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const api = axios.create({ baseURL: BASE_URL });

// App-level hooks, registered by App.tsx. Kept out of React so the single axios
// instance can drive a global error banner and session-expiry redirect.
let onApiError: ((message: string) => void) | null = null;
let onSessionExpired: (() => void) | null = null;

export function setApiErrorHandler(fn: ((message: string) => void) | null) { onApiError = fn; }
export function setSessionExpiredHandler(fn: (() => void) | null) { onSessionExpired = fn; }

function humanMessage(error: AxiosError): string {
  const data = error.response?.data as { error?: string } | undefined;
  if (data?.error) return data.error;
  if (error.response) return `Request failed (${error.response.status}).`;
  return "Can't reach the server. Check your connection and try again.";
}

api.interceptors.response.use(
  res => res,
  (error: AxiosError) => {
    const isLogin = (error.config?.url ?? '').includes('/admin/login');
    if (error.response?.status === 401 && !isLogin) {
      // Token missing/expired/invalid — drop it and bounce to the login screen.
      clearToken();
      onSessionExpired?.();
    } else if (!isLogin) {
      // Surface everything else in a global banner (pages may also handle it).
      onApiError?.(humanMessage(error));
    }
    return Promise.reject(error);
  }
);

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

export interface InviteRef {
  code: string;
  label: string | null;
}

export interface AdminUser {
  id: string;
  displayName: string | null;
  status: 'active' | 'withdrawn';
  studyGroup: string | null;
  createdAt: string;
  streak: { currentStreak: number; longestStreak: number } | null;
  inviteCode: InviteRef | null;
  _count: { logs: number; userGoals: number };
}

export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await api.get('/admin/users');
  return data;
}

export async function updateUser(
  id: string,
  payload: { displayName?: string; status?: 'active' | 'withdrawn'; studyGroup?: string | null },
): Promise<AdminUser> {
  const { data } = await api.patch(`/admin/users/${id}`, payload);
  return data;
}

// Randomly distribute participants across named groups (balanced).
export async function assignGroups(payload: { groups: string[]; target: 'all' | 'unassigned' | 'selected'; userIds?: string[] }) {
  const { data } = await api.post('/admin/assign-groups', payload);
  return data as { assigned: number; byGroup: Record<string, number> };
}

export interface UserDetail {
  id: string;
  displayName: string | null;
  status: 'active' | 'withdrawn';
  studyGroup: string | null;
  createdAt: string;
  inviteCode: InviteRef | null;
  streak: { currentStreak: number; longestStreak: number; lastReadDate: string | null } | null;
  logs: { id: string; title: string; author: string; minutesRead: number; loggedAt: string }[];
  goals: {
    userGoalId: string;
    title: string;
    type: string;
    status: string;
    assignedBy: string;
    assignedAt: string;
    deadline: string | null;
    progress: string;
    met: boolean;
    autoCheckable: boolean;
  }[];
  feedback: { id: string; goalTitle: string; rating: number | null; text: string | null; createdAt: string }[];
}

export async function getUserDetail(id: string): Promise<UserDetail> {
  const { data } = await api.get(`/admin/users/${id}`);
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

export interface BookResult {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  pageCount: number | null;
}

// Used by the goal builder to pick a specific book for "read a certain book".
export async function searchBooks(q: string): Promise<BookResult[]> {
  const { data } = await api.get('/books/search', { params: { q } });
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
    user: { displayName: string | null; studyGroup: string | null; inviteCode: InviteRef | null } | null;
  }[];
}

export async function getAdminData(): Promise<AdminData> {
  const { data } = await api.get('/admin/data');
  return data;
}

// ── Goal progress (auto-check) ───────────────────────────────────────────────

export interface GoalProgress {
  userGoalId: string;
  participant: string | null;
  inviteCode: string | null;
  participantLabel: string | null;
  studyGroup: string | null;
  userId: string;
  goalTitle: string;
  type: string;
  status: 'active' | 'completed';
  assignedAt: string;
  progress: string;
  met: boolean;
  autoCheckable: boolean;
}

export async function getGoalProgress(): Promise<GoalProgress[]> {
  const { data } = await api.get('/admin/goal-progress');
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await api.post('/admin/change-password', { currentPassword, newPassword });
}

// ── Check-in survey (admin-configurable) ─────────────────────────────────────

export interface SurveyQuestion {
  id: string;
  prompt: string;
  type: 'number' | 'rating' | 'text';
  sortOrder: number;
  required: boolean;
  active: boolean;
}

export async function getSurveyConfig(): Promise<{ cadenceDays: number }> {
  const { data } = await api.get('/admin/survey/config');
  return data;
}
export async function setSurveyCadence(cadenceDays: number) {
  await api.patch('/admin/survey/config', { cadenceDays });
}
export async function getSurveyQuestions(): Promise<SurveyQuestion[]> {
  const { data } = await api.get('/admin/survey/questions');
  return data;
}
export async function createSurveyQuestion(payload: { prompt: string; type: string; required: boolean }): Promise<SurveyQuestion> {
  const { data } = await api.post('/admin/survey/questions', payload);
  return data;
}
export async function loadStandardQuestions(): Promise<SurveyQuestion[]> {
  const { data } = await api.post('/admin/survey/questions/standard');
  return data;
}
export async function updateSurveyQuestion(id: string, payload: Partial<Pick<SurveyQuestion, 'prompt' | 'type' | 'required' | 'active' | 'sortOrder'>>): Promise<SurveyQuestion> {
  const { data } = await api.patch(`/admin/survey/questions/${id}`, payload);
  return data;
}
export async function deleteSurveyQuestion(id: string) {
  await api.delete(`/admin/survey/questions/${id}`);
}

export interface SurveyResponse {
  id: string;
  userId: string;
  participant: string | null;
  inviteCode: string | null;
  participantLabel: string | null;
  studyGroup: string | null;
  submittedAt: string;
  answers: Record<string, number | string>;
}
export async function getSurveyResponses(): Promise<{ questions: { id: string; prompt: string }[]; responses: SurveyResponse[] }> {
  const { data } = await api.get('/admin/surveys');
  return data;
}

// ── Reading Logs (raw export) ────────────────────────────────────────────────

export interface AdminReadingLog {
  id: string;
  userId: string;
  user: { displayName: string | null; studyGroup: string | null; inviteCode: InviteRef | null };
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

// ── Invite codes ─────────────────────────────────────────────────────────────

export interface InviteCode {
  id: string;
  code: string;
  label: string | null;
  usedByUserId: string | null;
  usedAt: string | null;
  createdAt: string;
  usedBy: { displayName: string | null } | null;
}

export async function getInvites(): Promise<InviteCode[]> {
  const { data } = await api.get('/admin/invites');
  return data;
}

export async function createInvites(payload: { count?: number; labels?: string[] }): Promise<InviteCode[]> {
  const { data } = await api.post('/admin/invites', payload);
  return data;
}

export async function deleteInvite(id: string) {
  await api.delete(`/admin/invites/${id}`);
}
