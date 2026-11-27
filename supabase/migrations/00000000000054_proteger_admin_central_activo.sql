BEGIN;

-- El indice de la migracion 08 garantiza un solo admin_central por org.
-- El lock de la fila que UPDATE/DELETE ya toma basta para proteger la transicion.
CREATE OR REPLACE FUNCTION public.proteger_admin_central_activo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.activo IS TRUE
      AND NEW.rol IS NOT DISTINCT FROM OLD.rol
      AND NEW.org_id IS NOT DISTINCT FROM OLD.org_id THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = 'PT409',
    MESSAGE = 'No se puede desactivar, cambiar de rol, mover ni eliminar al administrador central activo de la organización.';
END;
$$;

-- El DELETE tambien se ejecuta si la FK desde auth.users borra en cascada.
DROP TRIGGER IF EXISTS trg_proteger_admin_central_activo ON public.usuarios;
CREATE TRIGGER trg_proteger_admin_central_activo
BEFORE UPDATE OR DELETE ON public.usuarios
FOR EACH ROW
WHEN (OLD.rol = 'admin_central' AND OLD.activo IS TRUE)
EXECUTE FUNCTION public.proteger_admin_central_activo();

COMMIT;
