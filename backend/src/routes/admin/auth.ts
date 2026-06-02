import prisma from '../../lib/prisma';
import { signToken } from '../../lib/auth';
import { asyncHandler } from '../../lib/asyncHandler';
import bcrypt from 'bcryptjs';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }

  const provisioner = await prisma.provisioner.findUnique({ where: { email } });
  if (!provisioner) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const valid = await bcrypt.compare(password, provisioner.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  res.json({ token: signToken(provisioner.id) });
});

// First-time setup endpoint — protected by SETUP_KEY, not a session.
export const register = asyncHandler(async (req, res) => {
  const { email, password, setupKey } = req.body as { email: string; password: string; setupKey?: string };
  // Require SETUP_KEY to be configured AND to match — otherwise registration is
  // closed. (Without the first check, an unset key would make `undefined ===
  // undefined` pass and leave registration wide open.)
  if (!process.env.SETUP_KEY || setupKey !== process.env.SETUP_KEY) {
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

// Protected — wired after requireAuth, so req.provisionerId is set.
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ error: 'currentPassword and newPassword required' }); return; }
  if (newPassword.length < 8) { res.status(400).json({ error: 'New password must be at least 8 characters' }); return; }

  const provisioner = await prisma.provisioner.findUnique({ where: { id: req.provisionerId } });
  if (!provisioner) { res.status(404).json({ error: 'Not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, provisioner.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Current password is incorrect' }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.provisioner.update({ where: { id: req.provisionerId }, data: { passwordHash } });
  res.json({ ok: true });
});
