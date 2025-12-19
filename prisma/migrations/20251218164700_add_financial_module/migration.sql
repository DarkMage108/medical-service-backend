-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CARD', 'BOLETO');

-- AlterTable: Add financial fields to inventory_items
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "baseSalePrice" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "defaultCommission" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "defaultTax" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "defaultDelivery" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "defaultOther" DOUBLE PRECISION DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delivery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sales_doseId_key" ON "sales"("doseId");

-- AddForeignKey (only if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_doseId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "doses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_inventoryItemId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_patientId_fkey') THEN
        ALTER TABLE "sales" ADD CONSTRAINT "sales_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
