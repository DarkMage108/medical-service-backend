-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- Seed default adherence settings
INSERT INTO "system_settings" ("id", "key", "value", "label", "updatedAt") VALUES
  (gen_random_uuid()::text, 'adherence_max_delay_good', '3', 'Atraso máximo para BOA adesão (dias)', NOW()),
  (gen_random_uuid()::text, 'adherence_max_late_doses_partial', '3', 'Máximo de doses atrasadas para PARCIAL', NOW()),
  (gen_random_uuid()::text, 'adherence_min_delay_bad', '5', 'Atraso mínimo para RUIM (dias)', NOW()),
  (gen_random_uuid()::text, 'adherence_abandonment_days', '30', 'Dias sem aplicação para ABANDONO', NOW());
