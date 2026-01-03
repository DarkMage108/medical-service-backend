-- DropForeignKey
ALTER TABLE "dispense_logs" DROP CONSTRAINT IF EXISTS "dispense_logs_doseId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_doseId_fkey";

-- AddForeignKey
ALTER TABLE "dispense_logs" ADD CONSTRAINT "dispense_logs_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "doses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "doses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
