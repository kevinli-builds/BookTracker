interface ProgressLog {
  googleBooksId: string;
  author: string;
  minutesRead: number;
}

export interface GoalProgressResult {
  progress: string;
  met: boolean;
  autoCheckable: boolean;
}

// Compute progress toward a goal's criteria. `logs` must already be filtered to
// reading recorded AFTER the goal was assigned. books_count / minutes / author
// are auto-checkable; genre (not stored on logs) and custom are manual-only.
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
    default:
      return { progress: 'Manual only', met: false, autoCheckable: false };
  }
}
