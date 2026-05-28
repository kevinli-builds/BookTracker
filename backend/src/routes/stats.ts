import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.get('/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const [logs, streak, goals] = await Promise.all([
    prisma.readingLog.findMany({ where: { userId } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.userGoal.findMany({ where: { userId }, include: { template: true } }),
  ]);

  const totalMinutes = logs.reduce((s, l) => s + l.minutesRead, 0);
  const totalBooks = new Set(logs.map(l => l.googleBooksId)).size;

  const byMonth: Record<string, Set<string>> = {};
  for (const log of logs) {
    const key = log.loggedAt.toISOString().slice(0, 7);
    if (!byMonth[key]) byMonth[key] = new Set();
    byMonth[key].add(log.googleBooksId);
  }
  const booksPerMonth = Object.entries(byMonth)
    .map(([month, books]) => ({ month, count: books.size }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const timeByBook: Record<string, { title: string; author: string; coverUrl: string | null; minutes: number }> = {};
  for (const log of logs) {
    if (!timeByBook[log.googleBooksId]) {
      timeByBook[log.googleBooksId] = { title: log.title, author: log.author, coverUrl: log.coverUrl ?? null, minutes: 0 };
    }
    timeByBook[log.googleBooksId].minutes += log.minutesRead;
  }
  const topBooks = Object.values(timeByBook)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  res.json({
    totalBooks,
    totalMinutes,
    totalHours: Math.round(totalMinutes / 60),
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    lastReadDate: streak?.lastReadDate ?? null,
    booksPerMonth,
    topBooks,
    completedGoals: goals.filter(g => g.status === 'completed').length,
    activeGoals: goals.filter(g => g.status === 'active').length,
  });
}));

export default router;
