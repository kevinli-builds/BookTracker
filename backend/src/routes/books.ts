import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';

router.get('/search', asyncHandler(async (req, res) => {
  const q = req.query.q as string;
  if (!q) { res.status(400).json({ error: 'q required' }); return; }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY ?? '';
  const url = `${GOOGLE_BOOKS_API}?q=${encodeURIComponent(q)}&maxResults=15${apiKey ? `&key=${apiKey}` : ''}`;

  try {
    const response = await fetch(url);
    const data = await response.json() as any;
    const items = (data.items ?? []).map((item: any) => ({
      id: item.id,
      title: item.volumeInfo?.title ?? 'Unknown',
      author: (item.volumeInfo?.authors ?? ['Unknown']).join(', '),
      coverUrl: item.volumeInfo?.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
      description: item.volumeInfo?.description ?? null,
      pageCount: item.volumeInfo?.pageCount ?? null,
      categories: item.volumeInfo?.categories ?? [],
    }));
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Failed to search books' });
  }
}));

export default router;
