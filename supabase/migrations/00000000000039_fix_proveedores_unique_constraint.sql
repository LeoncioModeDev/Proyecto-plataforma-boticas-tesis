-- Corregir constraint unique de proveedores para incluir org_id
-- El RUC debe ser único por organización, no global

ALTER TABLE proveedores DROP CONSTRAINT IF EXISTS proveedores_tipo_identificacion_numero_identificacion_key;
ALTER TABLE proveedores ADD CONSTRAINT proveedores_org_tipo_id_numero_id_key UNIQUE (org_id, tipo_identificacion, numero_identificacion);
