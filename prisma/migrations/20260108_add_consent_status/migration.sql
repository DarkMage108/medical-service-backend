-- Add status field to consent_documents table
ALTER TABLE "consent_documents" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Make fileName, fileType, and fileUrl optional (nullable)
ALTER TABLE "consent_documents" ALTER COLUMN "fileName" DROP NOT NULL;
ALTER TABLE "consent_documents" ALTER COLUMN "fileType" DROP NOT NULL;
ALTER TABLE "consent_documents" ALTER COLUMN "fileUrl" DROP NOT NULL;
