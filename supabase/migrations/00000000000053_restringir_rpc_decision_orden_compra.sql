BEGIN;

-- El Edge de ordenes-compra es el unico consumidor en el repositorio.
REVOKE EXECUTE ON FUNCTION public.aprobar_orden_compra(uuid, uuid),
  public.rechazar_orden_compra(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.aprobar_orden_compra(uuid, uuid),
  public.rechazar_orden_compra(uuid, uuid, text) TO service_role;

COMMIT;
