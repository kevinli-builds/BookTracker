import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { userIdentitySelect } from './shared';

const router = Router();

const VALID_TYPES = ['number', 'rating', 'text'];

// The standard reading check-in, offered as a one-click starting point.
const STANDARD_QUESTIONS = [
  { prompt: 'How many books did you finish this period?', type: 'number', required: true },
  { prompt: 'About how many pages did you read this period?', type: 'number', required: false },
  { prompt: 'About how many minutes did you read this period?', type: 'number', required: false },
  { prompt: 'How satisfied were you with your reading this period?', type: 'rating', required: true },
  { prompt: 'Anything else about your reading this period?', type: 'text', required: false },
];

// ── Config (cadence) ─────────────────────────────────────────────────────────
router.get('/survey/config', asyncHandler(async (_req, res) => {
  const config = await prisma.surveyConfig.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
  res.json(config);
}));

router.patch('/survey/config', asyncHandler(async (req, res) => {
  const { cadenceDays } = req.body as { cadenceDays?: number };
  const n = Number(cadenceDays);
  if (!Number.isInteger(n) || n < 1 || n > 365) { res.status(400).json({ error: 'cadenceDays must be 1–365' }); return; }
  const config = await prisma.surveyConfig.upsert({
    where: { id: 'default' },
    update: { cadenceDays: n },
    create: { id: 'default', cadenceDays: n },
  });
  res.json(config);
}));

// ── Questions ────────────────────────────────────────────────────────────────
router.get('/survey/questions', asyncHandler(async (_req, res) => {
  const questions = await prisma.surveyQuestion.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] });
  res.json(questions);
}));

router.post('/survey/questions', asyncHandler(async (req, res) => {
  const { prompt, type, required } = req.body as { prompt?: string; type?: string; required?: boolean };
  if (!prompt?.trim()) { res.status(400).json({ error: 'prompt required' }); return; }
  if (!VALID_TYPES.includes(type ?? '')) { res.status(400).json({ error: 'type must be number, rating, or text' }); return; }
  const max = await prisma.surveyQuestion.aggregate({ _max: { sortOrder: true } });
  const question = await prisma.surveyQuestion.create({
    data: { prompt: prompt.trim(), type: type!, required: !!required, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  res.status(201).json(question);
}));

router.post('/survey/questions/standard', asyncHandler(async (_req, res) => {
  const existing = await prisma.surveyQuestion.count();
  const created = await prisma.$transaction(
    STANDARD_QUESTIONS.map((q, i) =>
      prisma.surveyQuestion.create({ data: { ...q, sortOrder: existing + i + 1 } })
    )
  );
  res.status(201).json(created);
}));

router.patch('/survey/questions/:id', asyncHandler(async (req, res) => {
  const { prompt, type, required, active, sortOrder } = req.body as {
    prompt?: string; type?: string; required?: boolean; active?: boolean; sortOrder?: number;
  };
  const data: Record<string, unknown> = {};
  if (typeof prompt === 'string' && prompt.trim()) data.prompt = prompt.trim();
  if (type && VALID_TYPES.includes(type)) data.type = type;
  if (typeof required === 'boolean') data.required = required;
  if (typeof active === 'boolean') data.active = active;
  if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
  if (Object.keys(data).length === 0) { res.status(400).json({ error: 'Nothing to update' }); return; }
  const question = await prisma.surveyQuestion.update({ where: { id: req.params.id }, data });
  res.json(question);
}));

// Hard-delete only if no responses could reference it; otherwise archive.
router.delete('/survey/questions/:id', asyncHandler(async (req, res) => {
  const anyResponses = await prisma.surveyResponse.count();
  if (anyResponses === 0) {
    await prisma.surveyQuestion.delete({ where: { id: req.params.id } });
    res.json({ ok: true, deleted: true });
  } else {
    await prisma.surveyQuestion.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ ok: true, archived: true });
  }
}));

// ── Responses (for export) ──────────────────────────────────────────────────
router.get('/surveys', asyncHandler(async (_req, res) => {
  const [responses, questions] = await Promise.all([
    prisma.surveyResponse.findMany({
      include: { user: { select: userIdentitySelect } },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.surveyQuestion.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }] }),
  ]);
  // Return the question set too so the client can build dynamic CSV columns.
  res.json({
    questions: questions.map(q => ({ id: q.id, prompt: q.prompt })),
    responses: responses.map(r => ({
      id: r.id,
      userId: r.userId,
      participant: r.user.displayName,
      inviteCode: r.user.inviteCode?.code ?? null,
      participantLabel: r.user.inviteCode?.label ?? null,
      studyGroup: r.user.studyGroup ?? null,
      submittedAt: r.submittedAt,
      answers: r.answers,
    })),
  });
}));

export default router;
