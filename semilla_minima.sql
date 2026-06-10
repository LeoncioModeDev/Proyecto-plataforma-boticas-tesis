-- ============================================================
-- semilla_minima.sql — Solo datos de catálogo necesarios
-- para probar registro de productos y flujo básico.
-- ============================================================
BEGIN;

-- ============================================================
-- 1. Países
-- ============================================================
INSERT INTO paises (codigo, nombre) VALUES
  ('PE', 'Perú')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 2. Ubigeos (Lima metropolitana)
-- ============================================================
INSERT INTO ubigeos (codigo, distrito, provincia, departamento) VALUES
  ('150101', 'Cercado de Lima', 'Lima', 'Lima'),
  ('150104', 'Miraflores', 'Lima', 'Lima'),
  ('150106', 'Santiago de Surco', 'Lima', 'Lima'),
  ('150115', 'Pueblo Libre', 'Lima', 'Lima'),
  ('150121', 'Los Olivos', 'Lima', 'Lima'),
  ('150122', 'San Miguel', 'Lima', 'Lima'),
  ('150143', 'San Borja', 'Lima', 'Lima')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 3. Organizaciones
-- org-000 = plataforma (para el super_admin del sistema)
-- org-001 = primer cliente (Boticas Jhodaal)
-- ============================================================
INSERT INTO organizaciones (id, nombre, tipo_identificacion, numero_identificacion, pais_origen, created_at) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-000'), 'Botica Demand ML Platform', 'ruc', '20999999999', 'PE', '2024-01-01 00:00:00+00'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001'), 'Boticas Jhodaal S.A.C.', 'ruc', '20123456789', 'PE', '2024-01-01 08:00:00+00')
ON CONFLICT (tipo_identificacion, numero_identificacion) DO NOTHING;

-- ============================================================
-- 4. Monedas
-- ============================================================
INSERT INTO monedas (id, codigo, nombre, simbolo) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mon-001'), 'PEN', 'Sol peruano', 'S/'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mon-002'), 'USD', 'Dólar estadounidense', '$')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 5. Unidades de medida
-- ============================================================
INSERT INTO unidades_medida (id, nombre, simbolo) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-001'), 'miligramo', 'mg'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-002'), 'gramo', 'g'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-003'), 'mililitro', 'mL'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-004'), 'porcentaje', '%')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 6. Principios activos
-- ============================================================
INSERT INTO principios_activos (id, nombre, codigo_atc) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-001'), 'Paracetamol', 'N02BE01'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-002'), 'Amoxicilina', 'J01CA04'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-003'), 'Ibuprofeno', 'M01AE01'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-004'), 'Omeprazol', 'A02BC01'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-005'), 'Losartán Potásico', 'C09CA01'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-006'), 'Metformina Clorhidrato', 'A10BA02'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-007'), 'Cetirizina Diclorhidrato', 'R06AE07'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-008'), 'Diclofenaco Dietilamonio', 'M01AB05'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-009'), 'Azitromicina', 'J01FA10'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-010'), 'Ambroxol Clorhidrato', 'R05CB06')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 7. Formas farmacéuticas
-- ============================================================
INSERT INTO formas_farmaceuticas (id, nombre) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), 'tableta'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-002'), 'cápsula'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-003'), 'jarabe'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-004'), 'crema'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-005'), 'solución inyectable'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-006'), 'suspensión'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-007'), 'ungüento'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-008'), 'gotas')
ON CONFLICT (nombre) DO NOTHING;

COMMIT;
