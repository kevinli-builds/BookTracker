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

// Edit a participant: rename, change status, and/or set experimental group.
// studyGroup: a non-empty string assigns; "" or null clears it.
router.patch('/users/:id', asyncHandler(async (req, res) => {
  const { displayName, status, studyGroup } = req.body as { displayName?: string; status?: string; studyGroup?: string | null };
  const data: { displayName?: string | null; status?: string; studyGroup?: string | null } = {};
  if (typeof displayName === 'string') data.displayName = displayName.trim() || null;
  if (status === 'active' || status === 'withdrawn') data.status = status;
  if (studyGroup !== undefined) data.studyGroup = (typeof studyGroup === 'string' && studyGroup.trim()) ? studyGroup.trim() : null;
  if (Object.keys(data).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    include: participantInclude,
  });
  res.json(user);
}));

// Randomly distribute participants across named groups (balanced). target:
// 'all' | 'unassigned' | 'selected' (with userIds). Manual edits via PATCH above.
router.post('/assign-groups', asyncHandler(async (req, res) => {
  const { groups, target, userIds } = req.body as { groups?: string[]; target?: string; userIds?: string[] };
  const names = Array.isArray(groups) ? [...new Set(groups.map(g => String(g).trim()).filter(Boolean))] : [];
  if (names.length < 2) { res.status(400).json({ error: 'Provide at least two group names' }); return; }

  let where: { id?: { in: string[] }; studyGroup?: null } = {};
  if (target === 'selected') {
    if (!Array.isArray(userIds) || userIds.length === 0) { res.status(400).json({ error: 'No participants selected' }); return; }
    where = { id: { in: userIds } };
  } else if (target === 'unassigned') {
    where = { studyGroup: null };
  } // 'all' → no filter

  const participants = await prisma.user.findMany({ where, select: { id: true } });
  if (participants.length === 0) { res.json({ assigned: 0, byGroup: {} }); return; }

  // Shuffle, then deal round-robin so groups stay balanced.
  const ids = participants.map(p => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[k]] = [ids[k], ids[i]];
  }
  const byGroup: Record<string, number> = Object.fromEntries(names.map(n => [n, 0]));
  await Promise.all(ids.map((id, idx) => {
    const group = names[idx % names.length];
    byGroup[group]++;
    return prisma.user.update({ where: { id }, data: { studyGroup: group } });
  }));

  res.json({ assigned: ids.length, byGroup });
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
    studyGroup: user.studyGroup,
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
