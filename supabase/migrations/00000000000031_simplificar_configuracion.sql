-- Migration 31: Simplificar configuracion
-- Agregar dominio institucional unico, umbrales de stock
-- Actualizar validar_dominio_correo() para usar dominio unico
-- NO eliminar columnas deprecadas (solo retirar de UI, whitelist y payloads)

-- ============================================================
-- 1. Nuevos campos en configuracion_organizacion
-- ============================================================

ALTER TABLE configuracion_organizacion
  ADD COLUMN IF NOT EXISTS dominio_correo_organizacion text,
  ADD COLUMN IF NOT EXISTS umbral_sobrestock_dias integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS horizonte_alerta_quiebre_dias integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN configuracion_organizacion.dominio_correo_organizacion IS
  'Dominio institucional unico. Solo super_admin. Normalizado: minusculas, sin @, sin espacios.';

COMMENT ON COLUMN configuracion_organizacion.umbral_sobrestock_dias IS
  'Umbral de sobrestock predictivo en dias. Maximo de cobertura antes de considerar sobrestock.';

COMMENT ON COLUMN configuracion_organizacion.horizonte_alerta_quiebre_dias IS
  'Horizonte de alerta de quiebre en dias. Riesgo de desabastecimiento.';

-- ============================================================
-- 2. CHECK constraints para campos de dias
-- ============================================================

ALTER TABLE configuracion_organizacion
  ADD CONSTRAINT chk_alerta_vencimiento_dias CHECK (alerta_vencimiento_dias > 0),
  ADD CONSTRAINT chk_umbral_sobrestock_dias CHECK (umbral_sobrestock_dias > 0),
  ADD CONSTRAINT chk_horizonte_alerta_quiebre_dias CHECK (horizonte_alerta_quiebre_dias > 0);

-- ============================================================
-- 3. Actualizar funcion validar_dominio_correo
--    Ahora usa dominio_correo_organizacion (singular, unico)
--    en lugar de dominios_correo_permitidos (array, multiple)
--    Si no hay dominio configurado -> rechazar
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_dominio_correo(
  p_email  text,
  p_org_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dominio     text;
  v_dominio_org text;
BEGIN
  v_dominio := split_part(p_email, '@', 2);

  IF v_dominio = '' OR v_dominio IS NULL THEN
    RETURN false;
  END IF;

  SELECT dominio_correo_organizacion INTO v_dominio_org
  FROM configuracion_organizacion
  WHERE org_id = p_org_id;

  -- Sin dominio configurado = rechazar (admin_central no puede crear usuarios sin dominio)
  IF v_dominio_org IS NULL OR v_dominio_org = '' THEN
    RETURN false;
  END IF;

  -- Comparacion exacta, sin coincidencias parciales
  RETURN v_dominio = v_dominio_org;
END;
$$;
