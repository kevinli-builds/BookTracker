import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// Participant redeems an invite code to join the study. No auth — gated by the
// code itself. Idempotent: re-entering the same code on the same device is OK.
router.post('/redeem', async (req, res) => {
  const { code, userId } = req.body as { code?: string; userId?: string };
  if (!code || !userId) {
    res.status(400).json({ error: 'code and userId required' });
    return;
  }

  const normalized = code.trim().toUpperCase();
  const invite = await prisma.inviteCode.findUnique({ where: { code: normalized } });

  if (!invite) {
    res.status(404).json({ error: 'Invalid code' });
    return;
  }
  if (invite.usedByUserId && invite.usedByUserId !== userId) {
    res.status(409).json({ error: 'This code has already been used' });
    return;
  }

  // Make sure the user row exists (the app upserts on launch, but be safe).
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });

  // Mark the code used by this device (no-op if already theirs).
  if (!invite.usedByUserId) {
    await prisma.inviteCode.update({
      where: { code: normalized },
      data: { usedByUserId: userId, usedAt: new Date() },
    });
  }

  // If the code carried a pre-assigned label and the user has no name yet,
  // adopt the label as their participant identity.
  let user = await prisma.user.findUnique({ where: { id: userId }, include: { streak: true } });
  if (invite.label && user && !user.displayName) {
    user = await prisma.user.update({
      where: { id: userId },
      data: { displayName: invite.label },
      include: { streak: true },
    });
  }

  res.json({ ...user, hasAccess: true });
});

export default router;
