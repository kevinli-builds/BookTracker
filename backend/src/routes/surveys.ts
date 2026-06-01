import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const DAY_MS = 86_400_000;

async function getConfig() {
  return prisma.surveyConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

// Participant view: the active questions, the cadence, and whether a check-in
// is due now (no prior response, or the last one was >= cadenceDays ago).
router.get('/:userId', asyncHandler(async (req, res) => {
  const [config, questions, last] = await Promise.all([
    getConfig(),
    prisma.surveyQuestion.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.surveyResponse.findFirst({ where: { userId: req.params.userId }, orderBy: { submittedAt: 'desc' } }),
  ]);

  const lastAt = last?.submittedAt ?? null;
  const due = questions.length > 0 && (!lastAt || Date.now() - lastAt.getTime() >= config.cadenceDays * DAY_MS);
  const nextDueAt = lastAt ? new Date(lastAt.getTime() + config.cadenceDays * DAY_MS) : null;

  res.json({
    cadenceDays: config.cadenceDays,
    questions: questions.map(q => ({ id: q.id, prompt: q.prompt, type: q.type, required: q.required })),
    lastSubmittedAt: lastAt,
    nextDueAt,
    due,
  });
}));

// Submit a check-in. answers is a { questionId: value } map.
router.post('/', asyncHandler(async (req, res) => {
  const { userId, answers } = req.body as { userId?: string; answers?: Record<string, unknown> };
  if (!userId || typeof answers !== 'object' || answers === null) {
    res.status(400).json({ error: 'userId and answers required' });
    return;
  }

  // Enforce required active questions are answered (non-empty).
  const required = await prisma.surveyQuestion.findMany({ where: { active: true, required: true } });
  const missing = required.filter(q => {
    const v = (answers as Record<string, unknown>)[q.id];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length > 0) {
    res.status(400).json({ error: `Please answer: ${missing.map(m => m.prompt).join(', ')}` });
    return;
  }

  await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId } });
  const response = await prisma.surveyResponse.create({
    data: { userId, answers: answers as object },
  });
  res.status(201).json({ id: response.id, submittedAt: response.submittedAt });
}));

export default router;
