interface ProgressLog {
  googleBooksId: string;
  author: string;
  minutesRead: number;
  pageCount?: number | null;
  categories?: string[];
}

export interface GoalProgressResult {
  progress: string;
  met: boolean;
  autoCheckable: boolean;
}

// Compute progress toward a goal's criteria. `logs` must already be filtered to
// reading recorded AFTER the goal was assigned. books_count / pages / minutes /
// author / genre / specific_book are auto-checkable; custom is manual-only.
export function computeGoalProgress(
  type: string,
  criteria: Record<string, unknown>,
  logs: ProgressLog[]
): GoalProgressResult {
  switch (type) {
    case 'books_count': {
      const target = typeof criteria.count === 'number' ? criteria.count : 0;
      const distinct = new Set(logs.map(l => l.googleBooksId)).size;
      return { progress: `${distinct} / ${target} books`, met: target > 0 && distinct >= target, autoCheckable: true };
    }
    case 'pages': {
      const target = typeof criteria.pages === 'number' ? criteria.pages : 0;
      // Sum each distinct book's page count once (logging a book = "read" it).
      const seen = new Set<string>();
      let total = 0;
      for (const l of logs) {
        if (seen.has(l.googleBooksId)) continue;
        seen.add(l.googleBooksId);
        total += typeof l.pageCount === 'number' ? l.pageCount : 0;
      }
      return { progress: `${total} / ${target} pages`, met: target > 0 && total >= target, autoCheckable: true };
    }
    case 'minutes': {
      const target = typeof criteria.minutes === 'number' ? criteria.minutes : 0;
      const total = logs.reduce((sum, l) => sum + l.minutesRead, 0);
      return { progress: `${total} / ${target} min`, met: target > 0 && total >= target, autoCheckable: true };
    }
    case 'author': {
      const author = typeof criteria.author === 'string' ? criteria.author : '';
      const matches = author ? logs.filter(l => l.author.toLowerCase().includes(author.toLowerCase())).length : 0;
      return { progress: `${matches} book(s) by ${author || '?'}`, met: matches > 0, autoCheckable: true };
    }
    case 'genre': {
      const genre = typeof criteria.genre === 'string' ? criteria.genre : '';
      const matches = genre
        ? logs.filter(l => (l.categories ?? []).some(c => c.toLowerCase().includes(genre.toLowerCase()))).length
        : 0;
      return { progress: `${matches} book(s) in ${genre || '?'}`, met: matches > 0, autoCheckable: true };
    }
    case 'specific_book': {
      const wantId = typeof criteria.googleBooksId === 'string' ? criteria.googleBooksId : '';
      const title = typeof criteria.title === 'string' ? criteria.title : 'the chosen book';
      const read = wantId ? logs.some(l => l.googleBooksId === wantId) : false;
      return { progress: read ? `Read "${title}"` : `Not yet: "${title}"`, met: read, autoCheckable: true };
    }
    default:
      return { progress: 'Manual only', met: false, autoCheckable: false };
  }
}
