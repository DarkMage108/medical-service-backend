-- ===========================================
-- March 2026 client update: treatment wizard,
-- dose wizard, protocol per-dose config,
-- message templates, application tracking
-- ===========================================

-- AlterEnum: add CONFIRM_APPLICATION to DoseStatus
ALTER TYPE "DoseStatus" ADD VALUE 'CONFIRM_APPLICATION';

-- CreateEnum: MessageTemplateTrigger
CREATE TYPE "MessageTemplateTrigger" AS ENUM (
  'CONSENT_TERM',
  'SURVEY_PENDING',
  'SCHEDULE_CONSULTATION',
  'NEXT_DOSE',
  'LATE_DOSE',
  'GENERAL'
);

-- AlterTable: doses — track who set status to APPLIED
ALTER TABLE "doses"
  ADD COLUMN "appliedByUserId" TEXT,
  ADD COLUMN "appliedAt" TIMESTAMP(3);

ALTER TABLE "doses"
  ADD CONSTRAINT "doses_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: treatments — structured next consultation forecast (Quinzena) + doctor
ALTER TABLE "treatments"
  ADD COLUMN "nextConsultationMonth" INTEGER,
  ADD COLUMN "nextConsultationYear" INTEGER,
  ADD COLUMN "nextConsultationFortnight" INTEGER,
  ADD COLUMN "doctorId" TEXT;

ALTER TABLE "treatments"
  ADD CONSTRAINT "treatments_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill structured fortnight from existing nextConsultationDate
UPDATE "treatments"
   SET "nextConsultationMonth"     = EXTRACT(MONTH FROM "nextConsultationDate")::INTEGER,
       "nextConsultationYear"      = EXTRACT(YEAR  FROM "nextConsultationDate")::INTEGER,
       "nextConsultationFortnight" = CASE WHEN EXTRACT(DAY FROM "nextConsultationDate")::INTEGER <= 15 THEN 1 ELSE 2 END
 WHERE "nextConsultationDate" IS NOT NULL;

-- AlterTable: protocols — per-dose message configuration
ALTER TABLE "protocols"
  ADD COLUMN "dose1MessageEnabled"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "dose1ExtraMessage"      TEXT,
  ADD COLUMN "lastDoseMessageEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastDoseExtraMessage"   TEXT;

-- CreateTable: message_templates
CREATE TABLE "message_templates" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "trigger"   "MessageTemplateTrigger" NOT NULL DEFAULT 'GENERAL',
  "content"   TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_templates_trigger_idx" ON "message_templates"("trigger");
