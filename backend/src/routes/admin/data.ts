import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { computeGoalProgress } from '../../lib/goalProgress';
import { userIdentitySelect } from './shared';

const router = Router();

// All reading logs joined with participant identity — the raw CSV export.
router.get('/logs', asyncHandler(async (_req, res) => {
  const logs = await prisma.readingLog.findMany({
    include: { user: { select: userIdentitySelect } },
    orderBy: { loggedAt: 'desc' },
  });
  res.json(logs);
}));

// Per-assignment progress toward each goal's criteria, computed from reading
// logs recorded AFTER the goal was assigned. Surfaces a "criteria met" flag for
// the admin without changing the participant's self-reported status. Genre and
// custom goals can't be auto-verified from stored data (marked not checkable).
router.get('/goal-progress', asyncHandler(async (_req, res) => {
  const userGoals = await prisma.userGoal.findMany({
    where: { status: { in: ['active', 'completed'] } },
    include: { user: { select: userIdentitySelect }, template: true },
    orderBy: { assignedAt: 'desc' },
  });

  const userIds = [...new Set(userGoals.map(g => g.userId))];
  const logs = await prisma.readingLog.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, googleBooksId: true, author: true, minutesRead: true, loggedAt: true, categories: true },
  });

  const logsByUser = new Map<string, typeof logs>();
  for (const log of logs) {
    const arr = logsByUser.get(log.userId) ?? [];
    arr.push(log);
    logsByUser.set(log.userId, arr);
  }

  const rows = userGoals.map(g => {
    const since = (logsByUser.get(g.userId) ?? []).filter(l => l.loggedAt >= g.assignedAt);
    const { progress, met, autoCheckable } = computeGoalProgress(
      g.template.type,
      (g.template.criteria ?? {}) as Record<string, unknown>,
      since
    );

    return {
      userGoalId: g.id,
      participant: g.user.displayName,
      inviteCode: g.user.inviteCode?.code ?? null,
      participantLabel: g.user.inviteCode?.label ?? null,
      userId: g.userId,
      goalTitle: g.template.title,
      type: g.template.type,
      status: g.status,
      assignedAt: g.assignedAt,
      progress,
      met,
      autoCheckable,
    };
  });

  res.json(rows);
}));

// Dashboard aggregates: totals, top books, goal completion rates, recent feedback.
router.get('/data', asyncHandler(async (_req, res) => {
  const [totalUsers, totalLogs, totalGoals, completedGoals, feedbacks, topBooksRaw] = await Promise.all([
    prisma.user.count(),
    prisma.readingLog.count(),
    prisma.userGoal.count(),
    prisma.userGoal.count({ where: { status: 'completed' } }),
    prisma.feedback.findMany({
      include: {
        userGoal: { include: { template: true } },
        user: { select: userIdentitySelect },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.readingLog.groupBy({
      by: ['googleBooksId', 'title', 'author'],
      _count: { googleBooksId: true },
      orderBy: { _count: { googleBooksId: 'desc' } },
      take: 10,
    }),
  ]);

  const goalTemplates = await prisma.goalTemplate.findMany({
    include: { _count: { select: { userGoals: true } } },
  });
  const goalCompletionRates = await Promise.all(
    goalTemplates.map(async g => {
      const completed = await prisma.userGoal.count({
        where: { templateId: g.id, status: 'completed' },
      });
      return {
        id: g.id,
        title: g.title,
        total: g._count.userGoals,
        completed,
        rate: g._count.userGoals > 0 ? Math.round((completed / g._count.userGoals) * 100) : 0,
      };
    })
  );

  res.json({
    totalUsers,
    totalLogs,
    totalGoals,
    completedGoals,
    completionRate: totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0,
    topBooks: topBooksRaw,
    goalCompletionRates,
    recentFeedback: feedbacks,
  });
}));

export default router;
