import { Router } from 'express';
import prisma from '../../lib/prisma';
import { asyncHandler } from '../../lib/asyncHandler';
import { generateCode } from '../../lib/inviteCode';

const router = Router();

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

export default router;
