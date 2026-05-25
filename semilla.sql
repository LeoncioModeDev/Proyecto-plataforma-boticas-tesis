-- ============================================================
-- Seed data — botica-demand-ml → Supabase
-- Uses uuid_generate_v5 for deterministic IDs matching mock
-- ============================================================
BEGIN;

-- Namespace for deterministic UUIDs (standard DNS UUID)
-- uuid-ossp ya está habilitado en migracion.sql
-- All mock IDs are hashed under this namespace
-- To compute: uuid_generate_v5(NS, 'prod-001')
-- This way 'prod-001' always maps to the same UUID

-- ============================================================
-- 1. Ubigeos
-- ============================================================
INSERT INTO ubigeos (codigo, distrito, provincia, departamento) VALUES
  ('150101', 'Cercado de Lima', 'Lima', 'Lima'),
  ('150102', 'Ate', 'Lima', 'Lima'),
  ('150103', NULL, 'Lima', 'Lima'),
  ('150104', 'Miraflores', 'Lima', 'Lima'),
  ('150105', 'San Juan de Lurigancho', 'Lima', 'Lima'),
  ('150106', 'Santiago de Surco', 'Lima', 'Lima'),
  ('150107', 'San Juan de Miraflores', 'Lima', 'Lima'),
  ('150108', 'Ate', 'Lima', 'Lima'),
  ('150109', 'Villa El Salvador', 'Lima', 'Lima'),
  ('150110', 'Chorrillos', 'Lima', 'Lima'),
  ('150111', NULL, 'Lima', 'Lima'),
  ('150112', NULL, 'Lima', 'Lima'),
  ('150113', 'Lurin', 'Lima', 'Lima'),
  ('150114', 'Santiago de Surco', 'Lima', 'Lima'),
  ('150115', 'Pueblo Libre', 'Lima', 'Lima'),
  ('150116', 'Magdalena del Mar', 'Lima', 'Lima'),
  ('150117', NULL, 'Lima', 'Lima'),
  ('150118', NULL, 'Lima', 'Lima'),
  ('150119', NULL, 'Lima', 'Lima'),
  ('150120', 'Breña', 'Lima', 'Lima'),
  ('150121', 'Los Olivos', 'Lima', 'Lima'),
  ('150122', 'San Miguel', 'Lima', 'Lima'),
  ('150123', 'Rímac', 'Lima', 'Lima'),
  ('150124', 'Barranco', 'Lima', 'Lima'),
  ('150125', 'Comas', 'Lima', 'Lima'),
  ('150126', NULL, 'Lima', 'Lima'),
  ('150127', NULL, 'Lima', 'Lima'),
  ('150128', NULL, 'Lima', 'Lima'),
  ('150129', NULL, 'Lima', 'Lima'),
  ('150130', NULL, 'Lima', 'Lima'),
  ('150131', NULL, 'Lima', 'Lima'),
  ('150132', NULL, 'Lima', 'Lima'),
  ('150133', NULL, 'Lima', 'Lima'),
  ('150134', NULL, 'Lima', 'Lima'),
  ('150135', NULL, 'Lima', 'Lima'),
  ('150136', NULL, 'Lima', 'Lima'),
  ('150137', NULL, 'Lima', 'Lima'),
  ('150138', NULL, 'Lima', 'Lima'),
  ('150139', NULL, 'Lima', 'Lima'),
  ('150140', NULL, 'Lima', 'Lima'),
  ('150141', NULL, 'Lima', 'Lima'),
  ('150142', NULL, 'Lima', 'Lima'),
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
  ('JP', 'Japón'),
  ('CN', 'China'),
  ('IN', 'India'),
  ('FR', 'Francia'),
  ('IT', 'Italia'),
  ('GB', 'Reino Unido'),
  ('CA', 'Canadá'),
  ('AU', 'Australia'),
  ('KR', 'Corea del Sur'),
  ('CH', 'Suiza'),
  ('NL', 'Países Bajos')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- 3. Organizaciones (debe ir antes que usuarios por FK org_id)
-- ============================================================
INSERT INTO organizaciones (id, nombre, tipo_identificacion, numero_identificacion, pais_origen, created_at) VALUES
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001'), 'D&R Farma S.A.C.', 'ruc', '20123456789', 'PE', '2024-01-01 08:00:00+00'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-002'), 'PharmaCorp International', 'vat', 'US123456789', 'US', '2024-02-15 09:00:00+00'),
  (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-003'), 'Medicamentos India Pvt Ltd', 'tax_id', 'IN27AAAAU9613G1ZQ', 'IN', '2024-03-01 10:00:00+00')
ON CONFLICT (tipo_identificacion, numero_identificacion) DO NOTHING;

-- ============================================================
-- 4. Usuarios (auth + perfil público)
-- Crea los usuarios en auth.users via Auth Admin API usando pg_net,
-- luego inserta (o upserta) en public.usuarios sus perfiles.
--
-- IMPORTANTE:
--   Reemplaza TU_SUPABASE_URL con la URL de tu proyecto.
--   Reemplaza TU_SERVICE_ROLE_KEY con tu service_role key
--   (Project Settings > API > service_role key).
--   pg_net debe estar habilitado (migracion.sql lo instala en net).
-- ============================================================
DO $$
DECLARE
  o1 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
  api_url text := 'https://gijafqewxvzukzxlfzsh.supabase.co/auth/v1/admin/users';
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpamFmcWV3eHZ6dWt6eGxmenNoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTY1ODM0NiwiZXhwIjoyMDk1MjM0MzQ2fQ.wo-r7WlgGzbMUcVepHRiZkNM5KmSmOGK_lryQtdwm2M';
  headers_ jsonb;
  usr RECORD;
  req_id bigint;
  http_status int;
  http_body text;
BEGIN
  headers_ := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', api_key,
    'Authorization', 'Bearer ' || api_key
  );

  -- Eliminar usuarios existentes para recrearlos limpios
  DELETE FROM auth.users WHERE email IN ('carlos@boticaml.pe', 'ana@boticaml.pe', 'luis@boticaml.pe');

  FOR usr IN VALUES
    ('dffc076b-9ea7-463a-b869-bd88d1658cca'::uuid, 'carlos@boticaml.pe', 'Carlos Mendoza', 'admin_central',       NULL),
    ('d7c88864-9104-437d-8f2b-361924ed91dd'::uuid, 'ana@boticaml.pe',    'Ana Torres',     'operador_drogueria', NULL),
    ('aa99fd73-a72b-4e37-87a3-92cdd6bf6b59'::uuid, 'luis@boticaml.pe',   'Luis Garcia',    'visor_botica',       extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003'))
  LOOP
    -- Llamar Auth Admin API via pg_net
    SELECT net.http_post(
      url     := api_url,
      headers := headers_,
      body    := jsonb_build_object(
        'email', usr.column2,
        'password', 'BoticaML2024!',
        'email_confirm', true,
        'user_metadata', jsonb_build_object('org_id', o1, 'nombre', usr.column3, 'rol', usr.column4, 'botica_id', usr.column5),
        'app_metadata', jsonb_build_object('rol', usr.column4, 'org_id', o1, 'botica_id', usr.column5)
      )
    ) INTO req_id;

    -- Esperar respuesta (timeout por defecto del extension)
    BEGIN
      SELECT status_code, body INTO http_status, http_body
      FROM net.http_collect_response(req_id);
      IF http_status NOT IN (200, 201) THEN
        RAISE WARNING 'Error creando usuario %: HTTP % — %', usr.column2, http_status, http_body;
      ELSE
        RAISE NOTICE 'Usuario creado: % (HTTP %)', usr.column2, http_status;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fallback: verificar en auth.users directamente
      PERFORM pg_sleep(2);
      IF EXISTS (SELECT 1 FROM auth.users WHERE email = usr.column2) THEN
        RAISE NOTICE 'Usuario creado (verificado): %', usr.column2;
      ELSE
        RAISE WARNING 'No se pudo verificar creación de %', usr.column2;
      END IF;
    END;
  END LOOP;
END $$;

-- Insertar/actualizar perfiles en public.usuarios (solo si existen en auth.users)
INSERT INTO public.usuarios (id, org_id, nombre, email, rol, botica_id, created_at)
SELECT id, org_id, nombre, email, rol, botica_id, now()
FROM (VALUES
  ('dffc076b-9ea7-463a-b869-bd88d1658cca'::uuid, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001'), 'Carlos Mendoza', 'carlos@boticaml.pe', 'admin_central'::rol_usuario,       NULL::uuid),
  ('d7c88864-9104-437d-8f2b-361924ed91dd'::uuid, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001'), 'Ana Torres',     'ana@boticaml.pe',    'operador_drogueria'::rol_usuario, NULL::uuid),
  ('aa99fd73-a72b-4e37-87a3-92cdd6bf6b59'::uuid, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001'), 'Luis Garcia',    'luis@boticaml.pe',   'visor_botica'::rol_usuario,       extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003'))
) AS datos(id, org_id, nombre, email, rol, botica_id)
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = datos.id)
ON CONFLICT (id) DO UPDATE SET
  org_id    = EXCLUDED.org_id,
  nombre    = EXCLUDED.nombre,
  email     = EXCLUDED.email,
  rol       = EXCLUDED.rol,
  botica_id = EXCLUDED.botica_id;

-- ============================================================
-- 5. Boticas / Ubicaciones
-- Modelo: cada organización tiene UNA droguería (la central es la
-- bodega principal). Las boticas adicionales son sucursales retail
-- sin bodega central propia. Solo org-001 tiene boticas.
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO boticas (id, org_id, nombre, tipo, ubigeo, direccion, telefono, activa, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001'), org_id, 'Droguería Central', 'drogueria', '150101', 'Av. Abancay 234, Cercado de Lima', '01-4567890', true, '2024-01-01 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002'), org_id, 'Botica Miraflores', 'botica', '150104', 'Calle Schell 412, Miraflores', '01-2345678', true, '2024-01-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003'), org_id, 'Botica San Borja', 'botica', '150143', 'Av. San Luis 1890, San Borja', '01-3456789', true, '2024-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-004'), org_id, 'Botica Surco', 'botica', '150114', 'Av. El Derby 567, Surco', '01-5678901', false, '2024-03-01 08:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-005'), org_id, 'Botica Los Olivos', 'botica', '150116', 'Av. Universitaria 3456, Los Olivos', '01-6789012', true, '2024-04-10 11:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 6. Productos
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO productos (id, org_id, codigo_interno, nombre_comercial, principio_activo, forma_farmaceutica, concentracion, laboratorio, codigo_barras, categoria_terapeutica, clasificacion, requiere_receta, estado, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'), org_id, 'PARA-500MG', 'Paracetamol 500mg', 'Paracetamol', 'tableta', '500 mg', 'Medifarma', '7750100012345', 'Analgésico', 'OTC', false, 'activo', '2024-01-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002'), org_id, 'AMOX-500MG', 'Amoxicilina 500mg', 'Amoxicilina', 'cápsula', '500 mg', 'Genfar', '7750100012346', 'Antibiótico', 'receta', true, 'activo', '2024-01-20 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003'), org_id, 'IBUP-400MG', 'Ibuprofeno 400mg', 'Ibuprofeno', 'tableta', '400 mg', 'Farmindustria', '7750100012347', 'Antiinflamatorio', 'OTC', false, 'activo', '2024-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'), org_id, 'OMEPR-20MG', 'Omeprazol 20mg', 'Omeprazol', 'cápsula', '20 mg', 'IQFarma', '7750100012348', 'Antiácido', 'receta', false, 'activo', '2024-02-10 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005'), org_id, 'LOSA-50MG', 'Losartán 50mg', 'Losartán Potásico', 'tableta', '50 mg', 'Medifarma', '7750100012349', 'Antihipertensivo', 'receta', true, 'activo', '2024-02-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006'), org_id, 'METF-850MG', 'Metformina 850mg', 'Metformina Clorhidrato', 'tableta', '850 mg', 'Genfar', '7750100012350', 'Antidiabético', 'receta', true, 'activo', '2024-03-01 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007'), org_id, 'CETI-10MG', 'Cetirizina 10mg', 'Cetirizina Diclorhidrato', 'tableta', '10 mg', 'Farmindustria', '7750100012351', 'Antihistamínico', 'OTC', false, 'activo', '2024-03-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008'), org_id, 'DICL-GEL1', 'Diclofenaco Gel 1%', 'Diclofenaco Dietilamonio', 'crema', '1%', 'IQFarma', '7750100012352', 'Antiinflamatorio tópico', 'OTC', false, 'activo', '2024-03-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009'), org_id, 'AZIT-500MG', 'Azitromicina 500mg', 'Azitromicina', 'tableta', '500 mg', 'AC Farma', '7750100012353', 'Antibiótico', 'receta', true, 'activo', '2024-04-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-010'), org_id, 'AMB-JARABE', 'Ambroxol Jarabe', 'Ambroxol Clorhidrato', 'jarabe', '15 mg/5 mL', 'Medifarma', '7750100012354', 'Mucolítico', 'OTC', false, 'activo', '2024-04-10 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-011'), org_id, 'CLON-0.5MG', 'Clonazepam 0.5mg', 'Clonazepam', 'tableta', '0.5 mg', 'AC Farma', '7750100012355', 'Ansiolítico', 'receta', true, 'inactivo', '2024-05-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-012'), org_id, 'RANI-150MG', 'Ranitidina 150mg', 'Ranitidina', 'tableta', '150 mg', 'Genfar', '7750100012356', 'Antiácido', 'receta', false, 'descontinuado', '2024-01-10 08:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 7. Proveedores
-- ============================================================
DO $$
DECLARE
  org_id uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'org-001');
BEGIN
  INSERT INTO proveedores (id, org_id, razon_social, tipo_identificacion, numero_identificacion, pais_origen, lead_time_dias, contacto, activo, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-001'), org_id, 'Medifarma S.A.', 'ruc', '20123456789', 'PE', 5, 'María López', true, '2024-01-15 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-002'), org_id, 'Genfar Perú S.A.C.', 'ruc', '20567890123', 'PE', 7, 'Roberto Díaz', true, '2024-02-20 09:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-003'), org_id, 'IQFarma S.R.L.', 'ruc', '10456789012', 'PE', 3, 'Carlos Pérez', true, '2024-03-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-004'), org_id, 'Farmindustria S.A.', 'ruc', '20198765432', 'PE', 10, 'Laura Mendoza', true, '2024-04-05 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-005'), org_id, 'Inversiones FarmaSur E.I.R.L.', 'ruc', '20678901234', 'PE', 4, 'Pedro Sánchez', false, '2024-05-12 11:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-006'), org_id, 'Europharma GmbH', 'vat', 'DE123456789', 'DE', 21, 'Hans Mueller', true, '2024-06-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prov-007'), org_id, 'Asian Pharma Co Ltd', 'tax_id', 'JP1234567890123', 'JP', 28, 'Yuki Tanaka', true, '2024-07-01 10:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 8. Stock en ubicaciones
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
-- 9. Lotes
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
    -- Droguería Central
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), p1, 'drogueria', dc, 'LT-2024-001', '2026-06-15', 200, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), p1, 'drogueria', dc, 'LT-2024-002', '2027-01-20', 250, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), p2, 'drogueria', dc, 'LT-2024-003', '2026-05-20', 70,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-004'), p2, 'botica',   bf, 'LT-2024-004', '2026-08-10', 50,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-005'), p3, 'drogueria', dc, 'LT-2024-005', '2027-03-25', 325, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), p4, 'drogueria', dc, 'LT-2024-006', '2026-05-10', 15,  pr3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-007'), p5, 'drogueria', dc, 'LT-2025-001', '2027-06-30', 155, pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-010'), p9, 'drogueria', dc, 'LT-2025-004', '2026-07-01', 75,  pr3),
    -- Botica Miraflores
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), p1, 'botica', bf, 'LT-2025-002', '2026-12-31', 75,  pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-009'), p7, 'botica', bf, 'LT-2025-003', '2027-09-15', 500, pr2),
    -- Botica San Borja
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-011'), p1, 'botica', sb, 'LT-2025-005', '2026-05-28', 60,  pr1),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-012'), p4, 'botica', sb, 'LT-2025-006', '2026-06-05', 8,   pr3),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-013'), p8, 'botica', sb, 'LT-2025-007', '2027-11-20', 22,  pr2),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-014'), p10,'botica', sb, 'LT-2025-008', '2027-02-14', 40,  pr1)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 10. Transferencias
-- ============================================================
DO $$
DECLARE
  dc    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb    uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
  carlos uuid := 'dffc076b-9ea7-463a-b869-bd88d1658cca'::uuid;
  ana   uuid := 'd7c88864-9104-437d-8f2b-361924ed91dd'::uuid;
  ti_id uuid;
BEGIN
  -- trans-001: recibida, Central → Miraflores
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, fecha_recepcion, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'recibida', carlos, '2024-09-11 09:00:00+00', '2024-09-11 09:00:00+00', '2024-09-10 14:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-001'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001'), 50)
  ON CONFLICT (id) DO NOTHING;

  -- trans-002: recibida, Central → Miraflores
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, fecha_recepcion, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'recibida', carlos, '2024-10-02 10:00:00+00', '2024-10-02 10:00:00+00', '2024-10-01 11:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-002'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003'), 30)
  ON CONFLICT (id) DO NOTHING;

  -- trans-003: en_transito, Central → Miraflores
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'), 'transferencia_central', 'drogueria', dc, 'botica', bf, 'en_transito', carlos, '2026-05-02 16:00:00+00', '2026-05-02 16:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 10),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-010'), 20)
  ON CONFLICT (id) DO NOTHING;

  -- trans-004: en_transito, Central → San Borja
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'), 'transferencia_central', 'drogueria', dc, 'botica', sb, 'en_transito', carlos, '2026-05-22 10:00:00+00', '2026-05-21 08:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-005'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006'), 5),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-006'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
     extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), 30)
  ON CONFLICT (id) DO NOTHING;

  -- trans-005: recibida, Central → San Borja
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, fecha_despacho, fecha_recepcion, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005'), 'transferencia_central', 'drogueria', dc, 'botica', sb, 'recibida', carlos, '2025-02-28 10:00:00+00', '2025-02-28 10:30:00+00', '2025-02-25 10:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-007'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002'), 60)
  ON CONFLICT (id) DO NOTHING;

  -- trans-006: cancelada, redistribución Miraflores → San Borja
  INSERT INTO transferencias (id, tipo_transferencia, origen_tipo, origen_id, destino_tipo, destino_id, estado, creado_por, created_at)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006'), 'redistribucion', 'botica', bf, 'botica', sb, 'cancelada', ana, '2026-05-10 10:00:00+00')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO transferencias_items (id, transferencia_id, producto_id, lote_id, cantidad)
  VALUES (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ti-008'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007'),
    extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008'), 50)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 11. Movimientos de inventario
-- ============================================================
DO $$
DECLARE
  p1     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-001');
  p2     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-002');
  p3     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-003');
  p4     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-004');
  p5     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-005');
  p6     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-006');
  p7     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-007');
  p8     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-008');
  p9     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prod-009');
  dc     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-001');
  bf     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-002');
  sb     uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'ub-003');
  carlos uuid := 'dffc076b-9ea7-463a-b869-bd88d1658cca'::uuid;
  ana    uuid := 'd7c88864-9104-437d-8f2b-361924ed91dd'::uuid;
  luis   uuid := 'aa99fd73-a72b-4e37-87a3-92cdd6bf6b59'::uuid;
  l1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-001');
  l2  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-002');
  l3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-003');
  l4  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-004');
  l5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-005');
  l6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-006');
  l7  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-007');
  l8  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-008');
  l9  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-009');
  l10 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-010');
  l11 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-011');
  l13 uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'lot-013');
  t1  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-001');
  t3  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-003');
  t5  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-005');
  t6  uuid := extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-006');
BEGIN
  INSERT INTO movimientos_inventario (id, producto_id, lote_id, ubicacion_tipo, ubicacion_id, tipo_movimiento, cantidad, motivo, usuario_id, transferencia_id, created_at) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-001'), p1, l1,  'drogueria', dc, 'entrada', 200, 'Compra a proveedor Medifarma — Orden #OC-2024-001', carlos, NULL, '2024-06-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-002'), p1, l2,  'drogueria', dc, 'entrada', 250, 'Compra a proveedor Medifarma — Orden #OC-2024-015', carlos, NULL, '2024-08-01 10:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-003'), p1, l1,  'drogueria', dc, 'salida', 50, 'Transferencia a Botica Miraflores — TR-001', carlos, t1, '2024-09-10 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-004'), p2, l3,  'drogueria', dc, 'entrada', 100, 'Compra a proveedor Genfar — Orden #OC-2024-020', carlos, NULL, '2024-05-20 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-005'), p2, l3,  'drogueria', dc, 'salida', 30,  'Transferencia a Botica Miraflores — TR-002', carlos, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-002'), '2024-10-01 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-006'), p3, l5,  'drogueria', dc, 'entrada', 320, 'Compra a proveedor Farmindustria — Orden #OC-2024-030', carlos, NULL, '2024-10-25 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-007'), p4, l6,  'drogueria', dc, 'entrada', 50,  'Compra a proveedor IQFarma — Orden #OC-2024-035', carlos, NULL, '2024-05-10 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-008'), p4, l6,  'drogueria', dc, 'salida', 35,  'Venta directa en mostrador', carlos, NULL, '2025-03-15 16:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-009'), p4, l6,  'drogueria', dc, 'merma', 10,  'Producto dañado por humedad en almacén — Acta de merma #MER-001', carlos, NULL, '2025-04-01 08:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-010'), p5, l7,  'drogueria', dc, 'entrada', 180, 'Compra a proveedor Medifarma — Orden #OC-2025-002', carlos, NULL, '2025-01-15 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-011'), p1, l8,  'botica', bf, 'entrada', 85,  'Recepción de transferencia desde Droguería Central — TR-003', ana, t3, '2025-02-01 10:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-012'), p1, l8,  'botica', bf, 'salida', 10,  'Venta a cliente — Boleta #B-2025-0501', ana, NULL, '2025-04-15 15:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-013'), p3, l5,  'drogueria', dc, 'ajuste', 5,   'Ajuste positivo por conteo físico — Inventario mensual abril 2025', carlos, NULL, '2025-04-30 17:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-014'), p7, l9,  'botica', bf, 'entrada', 500, 'Recepción de transferencia desde Droguería Central — TR-004', ana, extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'trans-004'), '2025-03-15 11:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-015'), p2, l3,  'drogueria', dc, 'merma', 5,   'Producto próximo a vencer — Retiro preventivo', carlos, NULL, '2026-04-20 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-016'), p1, l11, 'botica', sb, 'entrada', 60,  'Recepción de transferencia desde Droguería Central — TR-005', luis, t5, '2025-02-28 10:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-017'), p5, l7,  'drogueria', dc, 'salida', 25,  'Transferencia a Botica San Borja — TR-006', carlos, t6, '2025-03-20 14:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-018'), p8, l13, 'botica', sb, 'entrada', 22,  'Compra directa a proveedor IQFarma', carlos, NULL, '2025-04-01 09:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-019'), p1, l1,  'drogueria', dc, 'ajuste', -3,  'Ajuste negativo por diferencia en conteo físico — Inventario abril 2025', carlos, NULL, '2025-04-30 17:30:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-020'), p6, NULL, 'drogueria', dc, 'entrada', 120, 'Compra a proveedor Genfar — Orden #OC-2025-010', carlos, NULL, '2025-01-20 08:00:00+00'),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'mov-021'), p6, NULL, 'drogueria', dc, 'devolucion', 25, 'Devolución de cliente — producto sin abrir', carlos, NULL, '2026-04-28 14:00:00+00')
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================
-- 12. Precios
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
  INSERT INTO precios (id, producto_id, botica_id, precio_venta, precio_costo, vigente_desde, vigente_hasta) VALUES
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-001'), p1,  NULL, 8.50,  5.20, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-002'), p1,  bf,  9.00,  5.20, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-003'), p1,  sb,  9.00,  5.20, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-004'), p2,  NULL, 18.00, 12.50, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-005'), p3,  NULL, 12.00, 8.00, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-006'), p4,  NULL, 15.00, 10.50, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-007'), p5,  NULL, 22.00, 16.00, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-008'), p6,  NULL, 12.50, 8.80, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-009'), p7,  NULL, 14.00, 9.50, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-010'), p8,  NULL, 16.50, 11.00, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-011'), p9,  NULL, 35.00, 25.00, '2024-06-01 00:00:00+00', NULL),
    (extensions.uuid_generate_v5('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid, 'prec-012'), p10, NULL, 11.00, 7.50, '2024-06-01 00:00:00+00', NULL)
  ON CONFLICT (id) DO NOTHING;
END $$;

COMMIT;
