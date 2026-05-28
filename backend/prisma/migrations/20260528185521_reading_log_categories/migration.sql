-- AlterTable
ALTER TABLE "ReadingLog" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
