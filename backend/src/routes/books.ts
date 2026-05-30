import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

export interface BookResult {
  id: string;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  pageCount: number | null;
  categories: string[];
}

// Open Library — free, no API key, run by the Internet Archive. Default source.
async function searchOpenLibrary(q: string): Promise<BookResult[]> {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=15` +
    `&fields=key,title,author_name,cover_i,number_of_pages_median,subject`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BookTracker/1.0 (research app)' } });
  if (!res.ok) throw new Error(`Open Library responded ${res.status}`);
  const data = (await res.json()) as { docs?: any[] };
  return (data.docs ?? []).map(d => ({
    id: d.key, // stable per-work id, e.g. "/works/OL82563W"
    title: d.title ?? 'Unknown',
    author: (d.author_name ?? ['Unknown']).join(', '),
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    description: null, // not returned by the search endpoint
    pageCount: typeof d.number_of_pages_median === 'number' ? d.number_of_pages_median : null,
    categories: Array.isArray(d.subject) ? d.subject.slice(0, 5) : [],
  }));
}

// Google Books — only used when GOOGLE_BOOKS_API_KEY is configured. Keyless
// access shares a global anonymous quota that is routinely exhausted, so we no
// longer call it without a key.
async function searchGoogleBooks(q: string, apiKey: string): Promise<BookResult[]> {
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
    `&maxResults=15&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books responded ${res.status}`);
  const data = (await res.json()) as { items?: any[] };
  return (data.items ?? []).map(item => ({
    id: item.id,
    title: item.volumeInfo?.title ?? 'Unknown',
    author: (item.volumeInfo?.authors ?? ['Unknown']).join(', '),
    coverUrl: item.volumeInfo?.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null,
    description: item.volumeInfo?.description ?? null,
    pageCount: item.volumeInfo?.pageCount ?? null,
    categories: item.volumeInfo?.categories ?? [],
  }));
}

router.get('/search', asyncHandler(async (req, res) => {
  const q = (req.query.q as string)?.trim();
  if (!q) { res.status(400).json({ error: 'q required' }); return; }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  // Prefer Google Books when a key is set (richer descriptions); otherwise use
  // Open Library. Either way, fall back to Open Library and surface a real
  // error if everything fails — never silently return an empty list on error.
  if (apiKey) {
    try {
      res.json(await searchGoogleBooks(q, apiKey));
      return;
    } catch (err) {
      console.error('Google Books search failed, falling back to Open Library:', err);
    }
  }

  try {
    res.json(await searchOpenLibrary(q));
  } catch (err) {
    console.error('Book search failed:', err);
    res.status(502).json({ error: 'Book search is temporarily unavailable. Please try again.' });
  }
}));

export default router;
