import { Router } from 'express';
import prisma from '../lib/prisma';
import { updateStreak } from '../lib/streak';

const router = Router();

router.post('/', async (req, res) => {
  const { userId, googleBooksId, title, author, coverUrl, minutesRead } = req.body as {
    userId: string;
    googleBooksId: string;
    title: string;
    author: string;
    coverUrl?: string;
    minutesRead?: number;
  };

  if (!userId || !googleBooksId || !title || !author) {
    res.status(400).json({ error: 'userId, googleBooksId, title, author required' });
    return;
  }

  const log = await prisma.readingLog.create({
    data: { userId, googleBooksId, title, author, coverUrl, minutesRead: minutesRead ?? 0 },
  });

  await updateStreak(userId);

  res.status(201).json(log);
});

router.get('/:userId', async (req, res) => {
  const logs = await prisma.readingLog.findMany({
    where: { userId: req.params.userId },
    orderBy: { loggedAt: 'desc' },
  });
  res.json(logs);
});

export default router;
