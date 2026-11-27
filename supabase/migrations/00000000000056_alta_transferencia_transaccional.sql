BEGIN;

CREATE OR REPLACE FUNCTION public.crear_transferencia(
  p_org_id uuid,
  p_usuario_id uuid,
  p_tipo_transferencia public.tipo_transferencia,
  p_origen_id uuid,
  p_destino_id uuid,
  p_observaciones text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_transferencia_id uuid;
  v_numero text;
  v_es_redistribucion boolean := p_tipo_transferencia = 'redistribucion';
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los items deben ser un arreglo';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Debe incluir al menos un producto';
  END IF;

  -- Anticipar el lock de la FK de lote antes de tomar el numerador. No esperar
  -- con otros lotes bloqueados si una aprobacion ya tiene el lote en FOR UPDATE.
  PERFORM 1 FROM public.lotes l
  WHERE l.id IN (SELECT i.lote_id FROM jsonb_to_recordset(p_items) AS i(lote_id uuid))
  FOR KEY SHARE OF l NOWAIT;

  -- El lock transaccional del generador protege tambien la insercion del numero.
  v_numero := public.generar_numero_transferencia(p_org_id);

  INSERT INTO public.transferencias (
    org_id, tipo_transferencia, numero_transferencia, origen_tipo, origen_id,
    destino_tipo, destino_id, estado, creado_por, observaciones, created_by, modified_by
  ) VALUES (
    p_org_id, p_tipo_transferencia, v_numero,
    CASE WHEN v_es_redistribucion THEN 'botica'::public.tipo_ubicacion ELSE 'drogueria'::public.tipo_ubicacion END,
    p_origen_id, 'botica', p_destino_id, 'creada', p_usuario_id, p_observaciones, p_usuario_id, p_usuario_id
  ) RETURNING id INTO v_transferencia_id;

  INSERT INTO public.transferencias_items (
    org_id, transferencia_id, producto_id, lote_id, cantidad, created_by, modified_by
  )
  SELECT p_org_id, v_transferencia_id, i.producto_id, i.lote_id, i.cantidad, p_usuario_id, p_usuario_id
  FROM jsonb_to_recordset(p_items) AS i(producto_id uuid, lote_id uuid, cantidad integer);

  INSERT INTO public.auditoria (org_id, usuario_id, accion, entidad, entidad_id, nivel, detalle)
  VALUES (
    p_org_id, p_usuario_id,
    CASE WHEN v_es_redistribucion THEN 'CREAR_REDISTRIBUCION' ELSE 'CREAR_TRANSFERENCIA' END,
    'transferencias', v_transferencia_id, 'info',
    CASE WHEN v_es_redistribucion
      THEN format('Se creó redistribución de botica %s a botica %s con %s producto(s)', p_origen_id, p_destino_id, jsonb_array_length(p_items))
      ELSE format('Se creó transferencia a botica %s con %s producto(s)', p_destino_id, jsonb_array_length(p_items))
    END
  );

  RETURN jsonb_build_object('exito', true, 'id', v_transferencia_id, 'numero_transferencia', v_numero);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crear_transferencia(uuid, uuid, public.tipo_transferencia, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_transferencia(uuid, uuid, public.tipo_transferencia, uuid, uuid, text, jsonb)
  TO service_role;

COMMIT;
