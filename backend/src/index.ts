import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import usersRouter from './routes/users';
import invitesRouter from './routes/invites';
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
app.use('/books', booksRouter);
app.use('/logs', logsRouter);
app.use('/goals', goalsRouter);
app.use('/feedback', feedbackRouter);
app.use('/stats', statsRouter);
app.use('/admin', adminRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

// Local dev only — Vercel handles routing in serverless mode
if (!process.env.VERCEL) {
  const PORT = process.env.PORT ?? 3000;
  app.listen(PORT, () => console.log(`BookTracker backend on port ${PORT}`));
}

export default app;
