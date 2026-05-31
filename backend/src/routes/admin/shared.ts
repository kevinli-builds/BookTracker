import { Prisma } from '@prisma/client';

// Reusable Prisma selection fragments shared across the admin routes, so the
// shape of "participant + their invite code" stays consistent everywhere.

export const inviteCodeSelect = Prisma.validator<Prisma.InviteCodeSelect>()({
  code: true,
  label: true,
});

// A participant row for list/management views: streak, their code, and counts.
export const participantInclude = Prisma.validator<Prisma.UserInclude>()({
  streak: true,
  inviteCode: { select: inviteCodeSelect },
  _count: { select: { logs: true, userGoals: true } },
});

// Just enough of a user to label exported/aggregated rows with their identity
// and experimental condition.
export const userIdentitySelect = Prisma.validator<Prisma.UserSelect>()({
  displayName: true,
  studyGroup: true,
  inviteCode: { select: inviteCodeSelect },
});
