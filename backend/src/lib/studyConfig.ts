import prisma from './prisma';

// Whether a participant's study group is configured to hide the tracking
// features (book logging + goals) in the app. Defaults to visible for everyone.
export async function shouldHideTracking(studyGroup: string | null | undefined): Promise<boolean> {
  if (!studyGroup) return false;
  const config = await prisma.studyConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  return config.hideTrackingGroups.includes(studyGroup);
}
