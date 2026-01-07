-- Step 1: Update all doses with WAITING_DELIVERY status to PAID
UPDATE "doses"
SET "paymentStatus" = 'PAID'
WHERE "paymentStatus" = 'WAITING_DELIVERY';

-- Step 2: Remove default temporarily
ALTER TABLE "doses" ALTER COLUMN "paymentStatus" DROP DEFAULT;

-- Step 3: Remove WAITING_DELIVERY from PaymentStatus enum
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";

CREATE TYPE "PaymentStatus" AS ENUM ('WAITING_PIX', 'WAITING_CARD', 'WAITING_BOLETO', 'PAID');

ALTER TABLE "doses"
  ALTER COLUMN "paymentStatus" TYPE "PaymentStatus"
  USING "paymentStatus"::text::"PaymentStatus";

DROP TYPE "PaymentStatus_old";

-- Step 4: Re-add default with new enum type
ALTER TABLE "doses" ALTER COLUMN "paymentStatus" SET DEFAULT 'WAITING_PIX'::"PaymentStatus";

-- Step 5: Add patientNumber to patients table with auto-increment
ALTER TABLE "patients" ADD COLUMN "patientNumber" SERIAL;

-- Step 6: Add unique constraint on patientNumber
ALTER TABLE "patients" ADD CONSTRAINT "patients_patientNumber_key" UNIQUE ("patientNumber");
