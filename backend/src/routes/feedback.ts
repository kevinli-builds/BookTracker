import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { userId, userGoalId, rating, text } = req.body as {
    userId: string;
    userGoalId: string;
    rating?: number;
    text?: string;
  };

  if (!userId || !userGoalId) {
    res.status(400).json({ error: 'userId and userGoalId required' });
    return;
  }

  const feedback = await prisma.feedback.create({
    data: { userId, userGoalId, rating, text },
  });

  res.status(201).json(feedback);
}));

export default router;
