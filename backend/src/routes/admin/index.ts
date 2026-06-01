import { Router } from 'express';
import { requireAuth } from '../../lib/auth';
import { login, register, changePassword } from './auth';
import participantsRouter from './participants';
import goalsRouter from './goals';
import invitesRouter from './invites';
import dataRouter from './data';
import surveyRouter from './survey';

const router = Router();

// ── Public (no session) ──────────────────────────────────────────────────────
router.post('/login', login);
router.post('/register', register); // gated by SETUP_KEY inside the handler

// ── Everything below requires a valid provisioner JWT ────────────────────────
router.use(requireAuth);

router.post('/change-password', changePassword);
router.use(participantsRouter);
router.use(goalsRouter);
router.use(invitesRouter);
router.use(dataRouter);
router.use(surveyRouter);

export default router;
