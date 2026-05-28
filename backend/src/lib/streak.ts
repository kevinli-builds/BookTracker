import prisma from './prisma';

export async function updateStreak(userId: string): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const streak = await prisma.streak.findUnique({ where: { userId } });

  if (!streak) {
    await prisma.streak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastReadDate: today },
    });
    return;
  }

  const last = streak.lastReadDate ? new Date(streak.lastReadDate) : null;
  if (last) last.setHours(0, 0, 0, 0);

  const diffDays = last
    ? (today.getTime() - last.getTime()) / 86_400_000
    : Infinity;

  if (diffDays === 0) return; // already logged today

  const newCurrent = diffDays === 1 ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestStreak);

  await prisma.streak.update({
    where: { userId },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastReadDate: today },
  });
}
