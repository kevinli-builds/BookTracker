import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { signToken, requireAuth } from '../lib/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }

  const provisioner = await prisma.provisioner.findUnique({ where: { email } });
  if (!provisioner) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const valid = await bcrypt.compare(password, provisioner.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  res.json({ token: signToken(provisioner.id) });
});

// First-time setup endpoint — disable or protect this after initial account creation
router.post('/register', async (req, res) => {
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
});

router.use(requireAuth);

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    include: {
      streak: true,
      _count: { select: { logs: true, userGoals: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

router.get('/goals', async (_req, res) => {
  const templates = await prisma.goalTemplate.findMany({
    include: { _count: { select: { userGoals: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(templates);
});

router.post('/goals', async (req, res) => {
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
});

router.patch('/goals/:id', async (req, res) => {
  const { title, description, type, criteria, randomPool } = req.body;
  const template = await prisma.goalTemplate.update({
    where: { id: req.params.id },
    data: { title, description, type, criteria, randomPool },
  });
  res.json(template);
});

router.delete('/goals/:id', async (req, res) => {
  await prisma.goalTemplate.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// Randomly assign goals from the pool to all users (or a specified subset)
router.post('/assign', async (req, res) => {
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
});

router.get('/logs', async (_req, res) => {
  const logs = await prisma.readingLog.findMany({
    include: { user: { select: { displayName: true } } },
    orderBy: { loggedAt: 'desc' },
  });
  res.json(logs);
});

router.post('/change-password', async (req, res) => {
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
});

router.get('/data', async (_req, res) => {
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
});

export default router;
