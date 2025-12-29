-- AlterTable: Add manual contact fields to dismissed_logs
ALTER TABLE "dismissed_logs" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'regua';
ALTER TABLE "dismissed_logs" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "dismissed_logs" ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE "dismissed_logs" ADD COLUMN IF NOT EXISTS "patientPhone" TEXT;
ALTER TABLE "dismissed_logs" ADD COLUMN IF NOT EXISTS "manualMessage" TEXT;
