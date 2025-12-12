-- AlterTable
ALTER TABLE "doses" ADD COLUMN "purchased" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "doses" ADD COLUMN "deliveryStatus" TEXT;
