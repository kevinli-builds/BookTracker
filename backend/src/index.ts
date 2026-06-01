import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';

import usersRouter from './routes/users';
import invitesRouter from './routes/invites';
import surveysRouter from './routes/surveys';
import booksRouter from './routes/books';
import logsRouter from './routes/logs';
import goalsRouter from './routes/goals';
import feedbackRouter from './routes/feedback';
import statsRouter from './routes/stats';
import adminRouter from './routes/admin';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/users', usersRouter);
app.use('/invites', invitesRouter);
app.use('/surveys', surveysRouter);
app.use('/books', booksRouter);
app.use('/logs', logsRouter);
app.use('/goals', goalsRouter);
app.use('/feedback', feedbackRouter);
app.use('/stats', statsRouter);
app.use('/admin', adminRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Unknown routes → 404 JSON (instead of Express's default HTML page)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — catches anything thrown/rejected in route handlers
// (forwarded by asyncHandler) plus malformed-JSON body parse errors. Logs the
// real error server-side and returns a generic 500 so stack traces never leak.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return;
  // express.json() sets err.status (e.g. 400) for malformed request bodies.
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode
    ?? 500;
  res.status(status >= 400 && status < 500 ? status : 500).json({
    error: status >= 400 && status < 500 ? 'Bad request' : 'Internal server error',
  });
});

// Local dev only — Vercel handles routing in serverless mode
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => console.log(`BookTracker backend on port ${PORT}`));
}

export default app;
