import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { computeGoalProgress } from '../../lib/goalProgress';
import { participantInclude, userIdentitySelect } from './shared';

const router = Router();

// Everything the analysis-bundle export (admin "Download analysis bundle")
// needs, in one authenticated read. The per-page endpoints truncate or filter
// for their views — /data caps feedback at 50, /goal-progress omits abandoned
// goals — but an analysis dataset must be complete, so this returns the full
// tables. Read-only; the web client turns it into tidy CSVs + codebook.
router.get('/bundle', asyncHandler(async (_req, res) => {
  const [
    users,
    logs,
    userGoals,
    goalTemplates,
    feedback,
    surveyConfig,
    surveyQuestions,
    surveyResponses,
    studyConfig,
  ] = await Promise.all([
    prisma.user.findMany({ include: participantInclude, orderBy: { createdAt: 'asc' } }),
    prisma.readingLog.findMany({
      include: { user: { select: userIdentitySelect } },
      orderBy: { loggedAt: 'asc' },
    }),
    prisma.userGoal.findMany({
      include: { user: { select: userIdentitySelect }, template: true },
      orderBy: { assignedAt: 'asc' },
    }),
    prisma.goalTemplate.findMany({
      include: { _count: { select: { userGoals: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.feedback.findMany({
      include: {
        userGoal: { include: { template: { select: { title: true } } } },
        user: { select: userIdentitySelect },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.surveyConfig.findUnique({ where: { id: 'default' } }),
    prisma.surveyQuestion.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.surveyResponse.findMany({
      include: { user: { select: userIdentitySelect } },
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.studyConfig.findUnique({ where: { id: 'default' } }),
  ]);

  // Same auto-check computation the Goal Progress view uses, but for EVERY
  // goal (including abandoned), so the export carries criteria_met alongside
  // the participant-visible status.
  const goalLogs = await prisma.readingLog.findMany({
    select: { userId: true, googleBooksId: true, author: true, minutesRead: true, pageCount: true, loggedAt: true, categories: true },
  });
  const logsByUser = new Map<string, typeof goalLogs>();
  for (const log of goalLogs) {
    const arr = logsByUser.get(log.userId) ?? [];
    arr.push(log);
    logsByUser.set(log.userId, arr);
  }
  const userGoalsWithProgress = userGoals.map(g => {
    const since = (logsByUser.get(g.userId) ?? []).filter(l => l.loggedAt >= g.assignedAt);
    const { progress, met, autoCheckable } = computeGoalProgress(
      g.template.type,
      (g.template.criteria ?? {}) as Record<string, unknown>,
      since
    );
    return { ...g, progress, met, autoCheckable };
  });

  res.json({
    exportedAt: new Date().toISOString(),
    users,
    logs,
    userGoals: userGoalsWithProgress,
    goalTemplates,
    feedback,
    surveyConfig,
    surveyQuestions,
    surveyResponses,
    studyConfig,
  });
}));

export default router;
