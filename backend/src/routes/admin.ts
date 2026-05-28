import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken, requireAuth } from '../lib/auth';
import { generateCode } from '../lib/inviteCode';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }

  const provisioner = await prisma.provisioner.findUnique({ where: { email } });
  if (!provisioner) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const valid = await bcrypt.compare(password, provisioner.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  res.json({ token: signToken(provisioner.id) });
}));

// First-time setup endpoint — disable or protect this after initial account creation
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, setupKey } = req.body as { email: string; password: string; setupKey?: string };
  if (setupKey !== process.env.SETUP_KEY) {
    res.status(403).json({ error: 'Invalid setup key' });
    return;
  }
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }

  const existing = await prisma.provisioner.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const provisioner = await prisma.provisioner.create({ data: { email, passwordHash } });
  res.status(201).json({ id: provisioner.id, email: provisioner.email });
}));

router.use(requireAuth);

router.get('/users', asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    include: {
      streak: true,
      _count: { select: { logs: true, userGoals: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

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

// Randomly assign goals from the pool to all users (or a specified subset)
router.post('/assign', asyncHandler(async (req, res) => {
  const { userIds, deadline } = req.body as { userIds?: string[]; deadline?: string };

  const pool = await prisma.goalTemplate.findMany({ where: { randomPool: true } });
  if (pool.length === 0) { res.status(400).json({ error: 'No goals in random pool' }); return; }

  const targets = userIds
    ? await prisma.user.findMany({ where: { id: { in: userIds } } })
    : await prisma.user.findMany();

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

// ── Invite codes ─────────────────────────────────────────────────────────────

// Generate codes. Either pass { labels: ["P001", ...] } to create one
// pre-labeled code per participant, or { count: N } for N unlabeled codes.
router.post('/invites', asyncHandler(async (req, res) => {
  const { count, labels } = req.body as { count?: number; labels?: string[] };

  const requests: { label: string | null }[] = Array.isArray(labels) && labels.length > 0
    ? labels.map(l => ({ label: String(l).trim() || null }))
    : Array.from({ length: Math.min(Math.max(Number(count) || 0, 1), 500) }, () => ({ label: null }));

  if (requests.length === 0) {
    res.status(400).json({ error: 'Provide labels[] or a positive count' });
    return;
  }

  const created = [];
  for (const r of requests) {
    // Retry on the rare chance of a code collision.
    let saved = null;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      try {
        saved = await prisma.inviteCode.create({ data: { code: generateCode(), label: r.label } });
      } catch {
        saved = null;
      }
    }
    if (saved) created.push(saved);
  }

  res.status(201).json(created);
}));

router.get('/invites', asyncHandler(async (_req, res) => {
  const invites = await prisma.inviteCode.findMany({
    include: { usedBy: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invites);
}));

// Revoke an unused code. Used codes can't be deleted (preserves participant link).
router.delete('/invites/:id', asyncHandler(async (req, res) => {
  const invite = await prisma.inviteCode.findUnique({ where: { id: req.params.id } });
  if (!invite) { res.status(404).json({ error: 'Not found' }); return; }
  if (invite.usedByUserId) { res.status(409).json({ error: 'Cannot delete a redeemed code' }); return; }
  await prisma.inviteCode.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
}));

router.get('/logs', asyncHandler(async (_req, res) => {
  const logs = await prisma.readingLog.findMany({
    include: { user: { select: { displayName: true } } },
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
    include: { user: { select: { displayName: true } }, template: true },
    orderBy: { assignedAt: 'desc' },
  });

  const userIds = [...new Set(userGoals.map(g => g.userId))];
  const logs = await prisma.readingLog.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, googleBooksId: true, author: true, minutesRead: true, loggedAt: true },
  });

  const logsByUser = new Map<string, typeof logs>();
  for (const log of logs) {
    const arr = logsByUser.get(log.userId) ?? [];
    arr.push(log);
    logsByUser.set(log.userId, arr);
  }

  const rows = userGoals.map(g => {
    const since = (logsByUser.get(g.userId) ?? []).filter(l => l.loggedAt >= g.assignedAt);
    const criteria = (g.template.criteria ?? {}) as Record<string, unknown>;

    let progress = 'Manual only';
    let met = false;
    let autoCheckable = true;

    switch (g.template.type) {
      case 'books_count': {
        const target = typeof criteria.count === 'number' ? criteria.count : 0;
        const distinct = new Set(since.map(l => l.googleBooksId)).size;
        progress = `${distinct} / ${target} books`;
        met = target > 0 && distinct >= target;
        break;
      }
      case 'minutes': {
        const target = typeof criteria.minutes === 'number' ? criteria.minutes : 0;
        const total = since.reduce((sum, l) => sum + l.minutesRead, 0);
        progress = `${total} / ${target} min`;
        met = target > 0 && total >= target;
        break;
      }
      case 'author': {
        const author = typeof criteria.author === 'string' ? criteria.author : '';
        const matches = author
          ? since.filter(l => l.author.toLowerCase().includes(author.toLowerCase())).length
          : 0;
        progress = `${matches} book(s) by ${author || '?'}`;
        met = matches > 0;
        break;
      }
      default:
        autoCheckable = false;
    }

    return {
      userGoalId: g.id,
      participant: g.user.displayName,
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

router.post('/change-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const provisionerId = (req as { provisionerId?: string }).provisionerId;
  const provisioner = await prisma.provisioner.findUnique({ where: { id: provisionerId } });
  if (!provisioner) { res.status(404).json({ error: 'Not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, provisioner.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.provisioner.update({ where: { id: provisionerId }, data: { passwordHash } });
  res.json({ ok: true });
}));

router.get('/data', asyncHandler(async (_req, res) => {
  const [totalUsers, totalLogs, totalGoals, completedGoals, feedbacks, topBooksRaw] = await Promise.all([
    prisma.user.count(),
    prisma.readingLog.count(),
    prisma.userGoal.count(),
    prisma.userGoal.count({ where: { status: 'completed' } }),
    prisma.feedback.findMany({
      include: { userGoal: { include: { template: true } } },
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
