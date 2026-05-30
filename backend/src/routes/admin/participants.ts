import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { computeGoalProgress } from '../../lib/goalProgress';
import { participantInclude } from './shared';

const router = Router();

router.get('/users', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    include: participantInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

// Edit a participant: rename and/or change status (active | withdrawn).
router.patch('/users/:id', asyncHandler(async (req, res) => {
  const { displayName, status } = req.body as { displayName?: string; status?: string };
  const data: { displayName?: string | null; status?: string } = {};
  if (typeof displayName === 'string') data.displayName = displayName.trim() || null;
  if (status === 'active' || status === 'withdrawn') data.status = status;
  if (Object.keys(data).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    include: participantInclude,
  });
  res.json(user);
}));

// Full detail for one participant: code/label, status, logs, goals (with
// auto-checked progress), and feedback — powers the admin detail view.
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      streak: true,
      inviteCode: { select: { code: true, label: true } },
      logs: { orderBy: { loggedAt: 'desc' } },
      userGoals: { include: { template: true }, orderBy: { assignedAt: 'desc' } },
      feedbacks: { include: { userGoal: { include: { template: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const goals = user.userGoals.map(g => {
    const since = user.logs.filter(l => l.loggedAt >= g.assignedAt);
    const { progress, met, autoCheckable } = computeGoalProgress(
      g.template.type,
      (g.template.criteria ?? {}) as Record<string, unknown>,
      since
    );
    return {
      userGoalId: g.id,
      title: g.template.title,
      type: g.template.type,
      status: g.status,
      assignedBy: g.assignedBy,
      assignedAt: g.assignedAt,
      deadline: g.deadline,
      progress,
      met,
      autoCheckable,
    };
  });

  res.json({
    id: user.id,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    inviteCode: user.inviteCode,
    streak: user.streak,
    logs: user.logs.map(l => ({
      id: l.id,
      title: l.title,
      author: l.author,
      minutesRead: l.minutesRead,
      loggedAt: l.loggedAt,
    })),
    goals,
    feedback: user.feedbacks.map(f => ({
      id: f.id,
      goalTitle: f.userGoal.template.title,
      rating: f.rating,
      text: f.text,
      createdAt: f.createdAt,
    })),
  });
}));

export default router;
