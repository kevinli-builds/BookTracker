import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';

const router = Router();

router.get('/goals', asyncHandler(async (_req, res) => {
  const templates = await prisma.goalTemplate.findMany({
    include: { _count: { select: { userGoals: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
}));

router.post('/goals', asyncHandler(async (req, res) => {
  const { title, description, type, criteria, randomPool } = req.body as {
    title: string;
    description: string;
    type: string;
    criteria: object;
    randomPool?: boolean;
  };

  if (!title || !description || !type || !criteria) {
    res.status(400).json({ error: 'title, description, type, criteria required' });
    return;
  }

  const template = await prisma.goalTemplate.create({
    data: { title, description, type, criteria, randomPool: randomPool ?? false },
  });
  res.status(201).json(template);
}));

router.patch('/goals/:id', asyncHandler(async (req, res) => {
  const { title, description, type, criteria, randomPool } = req.body;
  const template = await prisma.goalTemplate.update({
    where: { id: req.params.id },
    data: { title, description, type, criteria, randomPool },
  });
  res.json(template);
}));

router.delete('/goals/:id', asyncHandler(async (req, res) => {
  await prisma.goalTemplate.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

// Randomly assign pool goals to all active participants (or a specified subset).
router.post('/assign', asyncHandler(async (req, res) => {
  const { userIds, deadline } = req.body as { userIds?: string[]; deadline?: string };

  const pool = await prisma.goalTemplate.findMany({ where: { randomPool: true } });
  if (pool.length === 0) { res.status(400).json({ error: 'No goals in random pool' }); return; }

  const targets = userIds
    ? await prisma.user.findMany({ where: { id: { in: userIds } } })
    : await prisma.user.findMany({ where: { status: 'active' } });

  let assigned = 0;
  for (const user of targets) {
    const template = pool[Math.floor(Math.random() * pool.length)];
    const existing = await prisma.userGoal.findFirst({
      where: { userId: user.id, templateId: template.id, status: 'active' },
    });
    if (existing) continue;

    await prisma.userGoal.create({
      data: {
        userId: user.id,
        templateId: template.id,
        assignedBy: 'system',
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });
    assigned++;
  }

  res.json({ assigned });
}));

export default router;
