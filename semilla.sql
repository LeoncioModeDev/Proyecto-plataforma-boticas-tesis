-- ============================================================
-- Seed data completo — botica-demand-ml → Supabase
-- ============================================================
BEGIN;

-- Namespace para UUIDs deterministas
-- Todas las referencias se generan bajo este namespace fijo.
-- Ej: uuid_generate_v5(NS, 'prod-001') → UUID determinista

-- ============================================================
-- 1. Ubigeos
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
-- 2. Países
-- ============================================================
INSERT INTO paises (codigo, nombre) VALUES
  ('PE', 'Perú'),
  ('US', 'Estados Unidos'),
  ('DE', 'Alemania'),
  ('ES', 'España'),
  ('MX', 'México'),
  ('CO', 'Colombia'),
  ('CL', 'Chile'),
  ('AR', 'Argentina'),
  ('BR', 'Brasil'),
  ('CN', 'China'),
  ('IN', 'India'),
  ('CH', 'Suiza')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 3. Organizaciones
-- Nota: org-000 es la organización del sistema para el super_admin.
-- org-001 en adelante son clientes reales.
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
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mon-002'), 'USD', 'Dólar estadounidense', '$'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mon-003'), 'EUR', 'Euro', '€')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 5. Unidades de medida
-- ============================================================
INSERT INTO unidades_medida (id, nombre, simbolo) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-001'), 'miligramo', 'mg'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-002'), 'gramo', 'g'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-003'), 'mililitro', 'mL'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-004'), 'porcentaje', '%'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-005'), 'unidad internacional', 'UI')
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

-- ============================================================
-- 8. Presentaciones
-- ============================================================
INSERT INTO presentaciones (id, tipo_empaque, cantidad, unidad) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-001'), 'blíster', 10, 'tabletas'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), 'blíster', 30, 'tabletas'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-003'), 'frasco', 60, 'mL'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-004'), 'frasco', 120, 'mL'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-005'), 'tubo', 30, 'g'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-006'), 'caja', 14, 'cápsulas'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-007'), 'caja', 7, 'tabletas'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-008'), 'frasco', 100, 'mL')
ON CONFLICT (tipo_empaque, cantidad, unidad) DO NOTHING;

-- ============================================================
-- 9. Boticas / Ubicaciones
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO boticas (id, org_id, nombre, tipo, ubigeo, direccion, telefono, activa, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001'), org_id, 'Droguería Central', 'drogueria', '150101', 'Av. Abancay 234, Cercado de Lima', '01-4567890', true, '2024-01-01 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002'), org_id, 'Botica Miraflores', 'botica', '150104', 'Calle Schell 412, Miraflores', '01-2345678', true, '2024-01-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003'), org_id, 'Botica San Borja', 'botica', '150143', 'Av. San Luis 1890, San Borja', '01-3456789', true, '2024-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-004'), org_id, 'Botica Surco', 'botica', '150106', 'Av. El Derby 567, Surco', '01-5678901', false, '2024-03-01 08:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-005'), org_id, 'Botica Los Olivos', 'botica', '150121', 'Av. Universitaria 3456, Los Olivos', '01-6789012', true, '2024-04-10 11:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 10. Productos (con referencias a forma farmacéutica y presentación)
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO productos (id, org_id, codigo_interno, nombre_comercial, forma_farmaceutica_id, presentacion_id, codigo_barras, clasificacion, estado, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'), org_id, 'PARA-500MG', 'Paracetamol 500mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), '7750100012345', 'OTC', 'activo', '2024-01-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002'), org_id, 'AMOX-500MG', 'Amoxicilina 500mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-002'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-006'), '7750100012346', 'receta', 'activo', '2024-01-20 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003'), org_id, 'IBUP-400MG', 'Ibuprofeno 400mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), '7750100012347', 'OTC', 'activo', '2024-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'), org_id, 'OMEPR-20MG', 'Omeprazol 20mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-002'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-006'), '7750100012348', 'receta', 'activo', '2024-02-10 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005'), org_id, 'LOSA-50MG', 'Losartán 50mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), '7750100012349', 'receta', 'activo', '2024-02-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006'), org_id, 'METF-850MG', 'Metformina 850mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), '7750100012350', 'receta', 'activo', '2024-03-01 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007'), org_id, 'CETI-10MG', 'Cetirizina 10mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-002'), '7750100012351', 'OTC', 'activo', '2024-03-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008'), org_id, 'DICL-GEL1', 'Diclofenaco Gel 1%', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-004'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-005'), '7750100012352', 'OTC', 'activo', '2024-03-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009'), org_id, 'AZIT-500MG', 'Azitromicina 500mg', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-001'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-007'), '7750100012353', 'receta', 'activo', '2024-04-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010'), org_id, 'AMB-JARABE', 'Ambroxol Jarabe', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ff-003'), extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pres-003'), '7750100012354', 'OTC', 'activo', '2024-04-10 08:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 11. Producto - Principio Activo (relación N:M con concentración)
-- ============================================================
DO $$
DECLARE
  p1   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  p10  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010');
  pa1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-001');
  pa2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-002');
  pa3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-003');
  pa4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-004');
  pa5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-005');
  pa6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-006');
  pa7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-007');
  pa8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-008');
  pa9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-009');
  pa10 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pa-010');
  um1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-001');
  um2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-002');
  um3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-003');
  um4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'um-004');
BEGIN
  INSERT INTO producto_principio_activo (id, producto_id, principio_activo_id, concentracion, unidad_medida_id) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-001'), p1,  pa1,  500,   um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-002'), p2,  pa2,  500,   um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-003'), p3,  pa3,  400,   um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-004'), p4,  pa4,  20,    um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-005'), p5,  pa5,  50,    um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-006'), p6,  pa6,  850,   um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-007'), p7,  pa7,  10,    um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-008'), p8,  pa8,  1,     um4),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-009'), p9,  pa9,  500,   um1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ppa-010'), p10, pa10, 15,    um3)
  ON CONFLICT (producto_id, principio_activo_id) DO NOTHING;
END $$;

-- ============================================================
-- 12. Proveedores
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO proveedores (id, org_id, razon_social, tipo_identificacion, numero_identificacion, pais_origen, activo, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001'), org_id, 'Medifarma S.A.', 'ruc', '20123456789', 'PE', true, '2024-01-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002'), org_id, 'Genfar Perú S.A.C.', 'ruc', '20567890123', 'PE', true, '2024-02-20 09:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003'), org_id, 'IQFarma S.R.L.', 'ruc', '10456789012', 'PE', true, '2024-03-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-004'), org_id, 'Farmindustria S.A.', 'ruc', '20198765432', 'PE', true, '2024-04-05 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-005'), org_id, 'Inversiones FarmaSur E.I.R.L.', 'ruc', '20678901234', 'PE', false, '2024-05-12 11:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-006'), org_id, 'Europharma GmbH', 'vat', 'DE123456789', 'DE', true, '2024-06-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-007'), org_id, 'Asian Pharma Co Ltd', 'tax_id', 'JP1234567890123', 'JP', true, '2024-07-01 10:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 13. Contactos de proveedores
-- ============================================================
DO $$
DECLARE
  pr1 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001');
  pr2 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002');
  pr3 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003');
  pr4 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-004');
BEGIN
  INSERT INTO contactos_proveedor (id, proveedor_id, nombre, telefono, correo, principal) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cp-001'), pr1, 'María López', '01-2345678', 'maria@medifarma.pe', true),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cp-002'), pr2, 'Roberto Díaz', '01-3456789', 'roberto@genfar.pe', true),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cp-003'), pr3, 'Carlos Pérez', '01-4567890', 'carlos@iqfarma.pe', true),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cp-004'), pr4, 'Laura Mendoza', '01-5678901', 'laura@farmindustria.pe', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 14. Condiciones comerciales
-- ============================================================
DO $$
DECLARE
  pr1 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001');
  pr2 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002');
  pr3 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003');
  pr4 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-004');
  mon_pen uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mon-001');
BEGIN
  INSERT INTO condiciones_comerciales (id, proveedor_id, moneda_id, plazo_pago, lead_time_promedio) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cc-001'), pr1, mon_pen, '30 días', 5),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cc-002'), pr2, mon_pen, '45 días', 7),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cc-003'), pr3, mon_pen, '15 días', 3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'cc-004'), pr4, mon_pen, '60 días', 10)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 15. Proveedor - Producto (precios de compra por proveedor)
-- ============================================================
DO $$
DECLARE
  p1   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9   uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  p10  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010');
  pr1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001');
  pr2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002');
  pr3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003');
  pr4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-004');
BEGIN
  INSERT INTO proveedor_producto (id, proveedor_id, producto_id, lead_time_especifico, precio_compra) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-001'), pr1, p1, 5, 5.20),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-002'), pr2, p2, 7, 12.50),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-003'), pr4, p3, 10, 8.00),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-004'), pr3, p4, 3, 10.50),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-005'), pr1, p5, 5, 16.00),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-006'), pr2, p6, 7, 8.80),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-007'), pr1, p7, 5, 9.50),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-008'), pr3, p8, 3, 11.00),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-009'), pr3, p9, 3, 25.00),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'pp-010'), pr1, p10, 5, 7.50)
  ON CONFLICT (proveedor_id, producto_id) DO NOTHING;
END $$;

-- ============================================================
-- 16. Precios de venta
-- ============================================================
DO $$
DECLARE
  p1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  p10 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010');
  bf  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
BEGIN
  INSERT INTO precios (id, producto_id, botica_id, precio_venta, precio_costo, vigente_desde) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-001'), p1,  NULL, 8.50,  5.20, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-002'), p1,  bf,  9.00,  5.20, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-003'), p1,  sb,  9.00,  5.20, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-004'), p2,  NULL, 18.00, 12.50, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-005'), p3,  NULL, 12.00, 8.00, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-006'), p4,  NULL, 15.00, 10.50, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-007'), p5,  NULL, 22.00, 16.00, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-008'), p6,  NULL, 12.50, 8.80, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-009'), p7,  NULL, 14.00, 9.50, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-010'), p8,  NULL, 16.50, 11.00, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-011'), p9,  NULL, 35.00, 25.00, '2024-06-01 00:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-012'), p10, NULL, 11.00, 7.50, '2024-06-01 00:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 17. Stock en ubicaciones
-- ============================================================
DO $$
DECLARE
  p1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  p10 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010');
  dc  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
BEGIN
  INSERT INTO stock_ubicaciones (id, producto_id, ubicacion_tipo, ubicacion_id, cantidad_disponible, stock_minimo, updated_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-001'), p1, 'drogueria', dc, 450, 100, '2026-05-03 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-002'), p2, 'drogueria', dc, 200, 80,  '2026-05-03 09:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-003'), p3, 'drogueria', dc, 320, 60,  '2026-05-02 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-004'), p4, 'drogueria', dc, 15,  50,  '2026-05-03 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-005'), p5, 'drogueria', dc, 180, 40,  '2026-05-01 16:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-006'), p6, 'drogueria', dc, 0,   60,  '2026-05-03 07:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-007'), p1, 'botica',  bf, 85,  30,  '2026-05-03 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-008'), p2, 'botica',  bf, 12,  20,  '2026-05-02 17:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-009'), p3, 'botica',  bf, 45,  15,  '2026-05-03 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-010'), p7, 'botica',  bf, 500, 25,  '2026-05-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-011'), p9, 'botica',  bf, 0,   15,  '2026-05-02 12:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-012'), p1, 'botica',  sb, 60,  25,  '2026-05-03 10:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-013'), p4, 'botica',  sb, 8,   20,  '2026-05-02 15:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-014'), p5, 'botica',  sb, 35,  10,  '2026-05-03 08:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-015'), p8, 'botica',  sb, 22,  10,  '2026-05-01 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'stk-016'), p10,'botica',  sb, 40,  12,  '2026-05-02 09:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 18. Lotes
-- ============================================================
DO $$
DECLARE
  p1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  p10 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010');
  dc  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
  pr1 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001');
  pr2 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002');
  pr3 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003');
BEGIN
  INSERT INTO lotes (id, producto_id, ubicacion_tipo, ubicacion_id, numero_lote, fecha_vencimiento, cantidad, proveedor_id) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), p1, 'drogueria', dc, 'LT-2024-001', '2026-06-15', 200, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), p1, 'drogueria', dc, 'LT-2024-002', '2027-01-20', 250, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), p2, 'drogueria', dc, 'LT-2024-003', '2026-05-20', 70,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-004'), p2, 'botica',   bf, 'LT-2024-004', '2026-08-10', 50,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-005'), p3, 'drogueria', dc, 'LT-2024-005', '2027-03-25', 325, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), p4, 'drogueria', dc, 'LT-2024-006', '2026-05-10', 15,  pr3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-007'), p5, 'drogueria', dc, 'LT-2025-001', '2027-06-30', 155, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-010'), p9, 'drogueria', dc, 'LT-2025-004', '2026-07-01', 75,  pr3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), p1, 'botica', bf, 'LT-2025-002', '2026-12-31', 75,  pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-009'), p7, 'botica', bf, 'LT-2025-003', '2027-09-15', 500, pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-011'), p1, 'botica', sb, 'LT-2025-005', '2026-05-28', 60,  pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-012'), p4, 'botica', sb, 'LT-2025-006', '2026-06-05', 8,   pr3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-013'), p8, 'botica', sb, 'LT-2025-007', '2027-11-20', 22,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-014'), p10,'botica', sb, 'LT-2025-008', '2027-02-14', 40,  pr1)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 19. Transferencias
-- ============================================================
DO $$
DECLARE
  dc    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
BEGIN
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, fecha_recepcion, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'recibida', '00000000-0000-0000-0000-000000000000', '2024-09-11 09:00:00+00', '2024-09-11 09:00:00+00', '2024-09-10 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'recibida', '00000000-0000-0000-0000-000000000000', '2024-10-02 10:00:00+00', '2024-10-02 10:00:00+00', '2024-10-01 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'en_transito', '00000000-0000-0000-0000-000000000000', '2026-05-02 16:00:00+00', NULL, '2026-05-02 16:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'), 'transferencia_central', 'drogueria', dc, 'botica', sb, 'en_transito', '00000000-0000-0000-0000-000000000000', '2026-05-22 10:00:00+00', NULL, '2026-05-21 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005'), 'transferencia_central', 'drogueria', dc, 'botica', sb, 'recibida', '00000000-0000-0000-0000-000000000000', '2025-02-28 10:00:00+00', '2025-02-28 10:30:00+00', '2025-02-25 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006'), 'redistribucion', 'botica', bf, 'botica', sb, 'cancelada', '00000000-0000-0000-0000-000000000000', NULL, NULL, '2026-05-10 10:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), 50),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-002'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), 30),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 10),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-010'), 20),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-005'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 5),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-006'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), 30),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-007'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), 60),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-008'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), 50)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 20. Movimientos de inventario
-- ============================================================
DO $$
DECLARE
  p1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  dc  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
BEGIN
  INSERT INTO movimientos_inventario (id, producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, transferencia_id, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-001'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), 'drogueria', dc, 'entrada', 200, 'Compra a proveedor Medifarma', '00000000-0000-0000-0000-000000000000', NULL, '2024-06-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-002'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), 'drogueria', dc, 'entrada', 250, 'Compra a proveedor Medifarma', '00000000-0000-0000-0000-000000000000', NULL, '2024-08-01 10:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-003'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), 'drogueria', dc, 'salida', 50, 'Transferencia a Botica Miraflores', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001'), '2024-09-10 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-004'), p2, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), 'drogueria', dc, 'entrada', 100, 'Compra a proveedor Genfar', '00000000-0000-0000-0000-000000000000', NULL, '2024-05-20 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-005'), p2, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), 'drogueria', dc, 'salida', 30, 'Transferencia a Botica Miraflores', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'), '2024-10-01 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-006'), p3, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-005'), 'drogueria', dc, 'entrada', 320, 'Compra a proveedor Farmindustria', '00000000-0000-0000-0000-000000000000', NULL, '2024-10-25 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-007'), p4, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 'drogueria', dc, 'entrada', 50, 'Compra a proveedor IQFarma', '00000000-0000-0000-0000-000000000000', NULL, '2024-05-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-008'), p4, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 'drogueria', dc, 'salida', 35, 'Venta directa en mostrador', '00000000-0000-0000-0000-000000000000', NULL, '2025-03-15 16:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-009'), p4, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 'drogueria', dc, 'merma', 10, 'Producto dañado por humedad', '00000000-0000-0000-0000-000000000000', NULL, '2025-04-01 08:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-010'), p5, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-007'), 'drogueria', dc, 'entrada', 180, 'Compra a proveedor Medifarma', '00000000-0000-0000-0000-000000000000', NULL, '2025-01-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-011'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), 'botica', bf, 'entrada', 85, 'Recepción de transferencia desde Droguería Central', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'), '2025-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-012'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), 'botica', bf, 'salida', 10, 'Venta a cliente', '00000000-0000-0000-0000-000000000000', NULL, '2025-04-15 15:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-013'), p3, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-005'), 'drogueria', dc, 'ajuste', 5, 'Ajuste positivo por conteo físico', '00000000-0000-0000-0000-000000000000', NULL, '2025-04-30 17:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-014'), p7, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-009'), 'botica', bf, 'entrada', 500, 'Recepción de transferencia desde Droguería Central', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'), '2025-03-15 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-015'), p2, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), 'drogueria', dc, 'merma', 5, 'Producto próximo a vencer', '00000000-0000-0000-0000-000000000000', NULL, '2026-04-20 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-016'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-011'), 'botica', sb, 'entrada', 60, 'Recepción de transferencia desde Droguería Central', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005'), '2025-02-28 10:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-017'), p5, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-007'), 'drogueria', dc, 'salida', 25, 'Transferencia a Botica San Borja', '00000000-0000-0000-0000-000000000000', extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006'), '2025-03-20 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-018'), p8, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-013'), 'botica', sb, 'entrada', 22, 'Compra directa a proveedor IQFarma', '00000000-0000-0000-0000-000000000000', NULL, '2025-04-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-019'), p1, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), 'drogueria', dc, 'ajuste', -3, 'Ajuste negativo por conteo físico', '00000000-0000-0000-0000-000000000000', NULL, '2025-04-30 17:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-020'), p6, NULL, 'drogueria', dc, 'entrada', 120, 'Compra a proveedor Genfar', '00000000-0000-0000-0000-000000000000', NULL, '2025-01-20 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-021'), p6, NULL, 'drogueria', dc, 'devolucion', 25, 'Devolución de cliente', '00000000-0000-0000-0000-000000000000', NULL, '2026-04-28 14:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
