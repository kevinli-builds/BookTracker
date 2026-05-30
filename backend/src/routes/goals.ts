import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.get('/templates', asyncHandler(async (_req, res) => {
  const templates = await prisma.goalTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(templates);
}));

router.post('/self', asyncHandler(async (req, res) => {
  const { userId, templateId, deadline } = req.body as {
    userId: string;
    templateId: string;
    deadline?: string;
  };

  if (!userId || !templateId) {
    res.status(400).json({ error: 'userId and templateId required' });
    return;
  }

  const existing = await prisma.userGoal.findFirst({
    where: { userId, templateId, status: 'active' },
  });
  if (existing) { res.status(409).json({ error: 'Goal already active' }); return; }

  const goal = await prisma.userGoal.create({
    data: {
      userId,
      templateId,
      assignedBy: 'self',
      deadline: deadline ? new Date(deadline) : undefined,
    },
    include: { template: true },
  });

  res.status(201).json(goal);
}));

router.get('/:userId', asyncHandler(async (req, res) => {
  const goals = await prisma.userGoal.findMany({
    where: { userId: req.params.userId },
    include: { template: true, _count: { select: { feedbacks: true } } },
    orderBy: { assignedAt: 'desc' },
  });
  // Expose hasFeedback so the app can prompt for feedback on auto-completed goals.
  res.json(goals.map(({ _count, ...g }) => ({ ...g, hasFeedback: _count.feedbacks > 0 })));
}));

router.patch('/:goalId/complete', asyncHandler(async (req, res) => {
  const goal = await prisma.userGoal.update({
    where: { id: req.params.goalId },
    data: { status: 'completed', completedAt: new Date() },
    include: { template: true },
  });
  res.json(goal);
}));

router.patch('/:goalId/abandon', asyncHandler(async (req, res) => {
  const goal = await prisma.userGoal.update({
    where: { id: req.params.goalId },
    data: { status: 'abandoned' },
    include: { template: true },
  });
  res.json(goal);
}));

export default router;
