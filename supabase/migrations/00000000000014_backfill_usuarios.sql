-- Backfill usuarios records for auth.users missing from public.usuarios
-- The trigger sincronizar_usuario() silently fails when org_id is null
-- in raw_user_meta_data, leaving auth.users without a public.usuarios record.

DO $$
DECLARE
  v_count   integer := 0;
  v_skipped integer := 0;
  v_rec     record;
BEGIN
  FOR v_rec IN
    SELECT
      u.id,
      u.email,
      u.raw_user_meta_data,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.usuarios pu ON pu.id = u.id
    WHERE pu.id IS NULL
    ORDER BY u.created_at
  LOOP
    IF v_rec.raw_user_meta_data->>'org_id' IS NOT NULL
       AND v_rec.raw_user_meta_data->>'org_id' != ''
    THEN
      BEGIN
        INSERT INTO public.usuarios (
          id, org_id, nombre, email, rol, botica_id, activo, created_at
        ) VALUES (
          v_rec.id,
          (v_rec.raw_user_meta_data->>'org_id')::uuid,
          COALESCE(
            NULLIF(v_rec.raw_user_meta_data->>'nombre', ''),
            split_part(v_rec.email, '@', 1)
          ),
          v_rec.email,
          COALESCE(
            NULLIF(v_rec.raw_user_meta_data->>'rol', ''),
            'visor_botica'
          )::rol_usuario,
          NULLIF(v_rec.raw_user_meta_data->>'botica_id', '')::uuid,
          true,
          v_rec.created_at
        );
        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'backfill_usuarios: error al insertar %: %', v_rec.email, SQLERRM;
        v_skipped := v_skipped + 1;
      END;
    ELSE
      RAISE WARNING 'backfill_usuarios: % no tiene org_id en metadata, se omite', v_rec.email;
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'backfill_usuarios: % registros creados, % omitidos', v_count, v_skipped;
END;
$$;
