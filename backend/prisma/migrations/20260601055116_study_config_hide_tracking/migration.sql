-- CreateTable
CREATE TABLE "StudyConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "hideTrackingGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyConfig_pkey" PRIMARY KEY ("id")
);
