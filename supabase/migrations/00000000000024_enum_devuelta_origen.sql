BEGIN;

ALTER TYPE estado_transferencia ADD VALUE IF NOT EXISTS 'devuelta_a_origen';

COMMIT;
