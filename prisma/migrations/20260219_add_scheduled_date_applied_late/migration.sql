-- AlterEnum
ALTER TYPE "DoseStatus" ADD VALUE 'APPLIED_LATE';

-- AlterTable - Add scheduledDate column (initially nullable for migration)
ALTER TABLE "doses" ADD COLUMN "scheduledDate" TIMESTAMP(3);

-- Populate scheduledDate from existing applicationDate
UPDATE "doses" SET "scheduledDate" = "applicationDate";

-- Make scheduledDate NOT NULL
ALTER TABLE "doses" ALTER COLUMN "scheduledDate" SET NOT NULL;
