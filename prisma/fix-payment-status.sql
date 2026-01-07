-- Update all WAITING_DELIVERY status to PAID (since delivery is now tracked separately)
UPDATE doses
SET "paymentStatus" = 'PAID'
WHERE "paymentStatus" = 'WAITING_DELIVERY';
