import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { shouldHideTracking } from '../lib/studyConfig';

const router = Router();

router.post('/', asyncHandler(async (req, res) => {
  const { userId, displayName } = req.body as { userId?: string; displayName?: string };
  if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: displayName ? { displayName } : {},
    create: { id: userId, displayName },
    include: { streak: true, inviteCode: true },
  });

  const { inviteCode, ...rest } = user;
  res.json({ ...rest, hasAccess: !!inviteCode, hideTracking: await shouldHideTracking(user.studyGroup) });
}));

export default router;
