import { Router } from 'express';
import prisma from '../lib/prisma';
import { updateStreak } from '../lib/streak';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { userId, googleBooksId, title, author, coverUrl, minutesRead, categories, localDate } = req.body as {
    userId: string;
    googleBooksId: string;
    title: string;
    author: string;
    coverUrl?: string;
    minutesRead?: number;
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
      categories: Array.isArray(categories) ? categories.filter(c => typeof c === 'string') : [],
    },
  });

  await updateStreak(userId, localDate);

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
