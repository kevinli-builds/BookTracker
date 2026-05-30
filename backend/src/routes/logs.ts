import { Router } from 'express';
import prisma from '../lib/prisma';
import { updateStreak } from '../lib/streak';
import { asyncHandler } from '../lib/asyncHandler';
import { computeGoalProgress } from '../lib/goalProgress';

const router = Router();

// After a book is logged, auto-complete any of the user's active goals whose
// criteria are now met — driven by reading logged since each goal was assigned.
// Custom goals aren't auto-checkable and are left for manual completion.
async function autoCompleteGoals(userId: string): Promise<void> {
  const activeGoals = await prisma.userGoal.findMany({
    where: { userId, status: 'active' },
    include: { template: true },
  });
  if (activeGoals.length === 0) return;

  const logs = await prisma.readingLog.findMany({
    where: { userId },
    select: { googleBooksId: true, author: true, minutesRead: true, pageCount: true, categories: true, loggedAt: true },
  });

  for (const g of activeGoals) {
    const since = logs.filter(l => l.loggedAt >= g.assignedAt);
    const { met, autoCheckable } = computeGoalProgress(
      g.template.type,
      (g.template.criteria ?? {}) as Record<string, unknown>,
      since
    );
    if (autoCheckable && met) {
      await prisma.userGoal.update({
        where: { id: g.id },
        data: { status: 'completed', completedAt: new Date() },
      });
    }
  }
}

router.post('/', asyncHandler(async (req, res) => {
  const { userId, googleBooksId, title, author, coverUrl, minutesRead, pageCount, categories, localDate } = req.body as {
    userId: string;
    googleBooksId: string;
    title: string;
    author: string;
    coverUrl?: string;
    minutesRead?: number;
    pageCount?: number;
    categories?: string[];
    localDate?: string;
  };

  if (!userId || !googleBooksId || !title || !author) {
    res.status(400).json({ error: 'userId, googleBooksId, title, author required' });
    return;
  }

  const log = await prisma.readingLog.create({
    data: {
      userId,
      googleBooksId,
      title,
      author,
      coverUrl,
      minutesRead: minutesRead ?? 0,
      pageCount: typeof pageCount === 'number' ? pageCount : null,
      categories: Array.isArray(categories) ? categories.filter(c => typeof c === 'string') : [],
    },
  });

  await updateStreak(userId, localDate);
  await autoCompleteGoals(userId);

  res.status(201).json(log);
}));

router.get('/:userId', asyncHandler(async (req, res) => {
  const logs = await prisma.readingLog.findMany({
    where: { userId: req.params.userId },
    orderBy: { loggedAt: 'desc' },
  });
  res.json(logs);
}));

export default router;
