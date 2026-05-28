import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.post('/', async (req, res) => {
  const { userId, displayName } = req.body as { userId?: string; displayName?: string };
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: displayName ? { displayName } : {},
    create: { id: userId, displayName },
    include: { streak: true },
  });

  res.json(user);
});

export default router;
