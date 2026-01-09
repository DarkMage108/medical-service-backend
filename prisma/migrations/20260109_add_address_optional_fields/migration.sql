-- Add optional address fields: condominium and referencePoint
ALTER TABLE "addresses" ADD COLUMN "condominium" TEXT;
ALTER TABLE "addresses" ADD COLUMN "referencePoint" TEXT;
