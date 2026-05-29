import prisma from './prisma';

// Day boundaries are evaluated in the PARTICIPANT's local calendar, passed from
// the app as `localDate` ("YYYY-MM-DD"). Each day is anchored to UTC midnight so
// day-to-day differences are exact integers. Falls back to the server's UTC date
// if the client didn't send one (older app builds).
function dayKey(localDate?: string): Date {
  if (localDate && /^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return new Date(`${localDate}T00:00:00.000Z`);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function updateStreak(userId: string, localDate?: string): Promise<void> {
  const today = dayKey(localDate);

  const streak = await prisma.streak.findUnique({ where: { userId } });

  if (!streak) {
    await prisma.streak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastReadDate: today },
    });
    return;
  }

  const last = streak.lastReadDate ? startOfUtcDay(streak.lastReadDate) : null;
  const diffDays = last ? (today.getTime() - last.getTime()) / 86_400_000 : Infinity;

  if (diffDays === 0) return; // already logged today
  if (diffDays < 0) return;   // out-of-order date (clock skew / timezone jump) — ignore

  const newCurrent = diffDays === 1 ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestStreak);

  await prisma.streak.update({
    where: { userId },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastReadDate: today },
  });
}
