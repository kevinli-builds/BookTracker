import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/templates', async (_req, res) => {
  const templates = await prisma.goalTemplate.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(templates);
});

router.post('/self', async (req, res) => {
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
});

router.get('/:userId', async (req, res) => {
  const goals = await prisma.userGoal.findMany({
    where: { userId: req.params.userId },
    include: { template: true },
    orderBy: { assignedAt: 'desc' },
  });
  res.json(goals);
});

router.patch('/:goalId/complete', async (req, res) => {
  const goal = await prisma.userGoal.update({
    where: { id: req.params.goalId },
    data: { status: 'completed', completedAt: new Date() },
    include: { template: true },
  });
  res.json(goal);
});

router.patch('/:goalId/abandon', async (req, res) => {
  const goal = await prisma.userGoal.update({
    where: { id: req.params.goalId },
    data: { status: 'abandoned' },
    include: { template: true },
  });
  res.json(goal);
});

export default router;
