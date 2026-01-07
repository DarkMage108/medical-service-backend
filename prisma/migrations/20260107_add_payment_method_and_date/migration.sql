-- Add paymentMethod and paymentDate fields to doses table
ALTER TABLE "doses" ADD COLUMN "paymentMethod" "PaymentMethod";
ALTER TABLE "doses" ADD COLUMN "paymentDate" TIMESTAMP(3);
