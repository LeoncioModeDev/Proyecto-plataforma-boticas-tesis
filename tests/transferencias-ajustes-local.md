# Guion local: 0003223 / 0003222

Solo en Supabase **local y descartable**, con las migraciones 55 y 56 y el Edge actualizado (`supabase functions serve transferencias`). No usar un proyecto enlazado ni datos reales. Preparar una organizacion aislada, un admin, una drogueria, dos boticas activas y un producto activo con stock y lotes vigentes tanto en drogueria como en una botica. Registrar los UUID de las fixtures. Para las sesiones SQL, usar el puerto local informado por `supabase status` y limitar las esperas:

```sql
SET statement_timeout = '15s';
```

## Alta, permisos y rollback

1. Crear una transferencia central y una redistribucion por el Edge. Verificar `exito`, `id`, `numero_transferencia`; por cada ID debe existir una cabecera `creada`, todos los items sin compromiso, y exactamente un evento de alta (`CREAR_TRANSFERENCIA` o `CREAR_REDISTRIBUCION`, con el actor y detalle anteriores). Confirmar que el alta no altera stock ni lotes.
2. Comprobar los permisos efectivos: debe devolver `false, false, true` en ese orden.

```sql
SELECT rol, has_function_privilege(rol,
  'public.crear_transferencia(uuid,uuid,public.tipo_transferencia,uuid,uuid,text,jsonb)', 'EXECUTE')
FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS roles(rol);
```

3. En la organizacion aislada, anotar conteos de cabeceras, items y auditoria de altas, y el ultimo numero. Sustituir los marcadores con IDs locales y ejecutar como `service_role`, con un item valido y otro con lote inexistente. Debe fallar con `23503`. Los tres conteos y el ultimo numero deben quedar iguales. Repetir con un observador SQL o desde otra sesion, no dentro de una transaccion abortada. Corregir el lote y repetir: deben persistir dos items y el siguiente numero sin hueco atribuible al fallo.

```sql
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.crear_transferencia(
  '<org>', '<actor>', 'transferencia_central', '<drogueria>', '<destino>', 'prueba-rollback-local',
  jsonb_build_array(
    jsonb_build_object('producto_id', '<producto>', 'lote_id', '<lote-central>', 'cantidad', 1),
    jsonb_build_object('producto_id', '<producto>', 'lote_id', '00000000-0000-0000-0000-000000000001', 'cantidad', 1)
  )
);
COMMIT; -- PostgreSQL revierte la transaccion si fallo el SELECT.
```

4. Para comprobar rollback por auditoria (no solo por items), en la base desechable instalar temporalmente, dentro de `BEGIN`, un trigger de auditoria que rechace `CREAR_TRANSFERENCIA` con una excepcion. Ejecutar un alta valida bajo `SET LOCAL ROLE service_role` y comprobar el error. Si se usa un `SAVEPOINT` justo antes del alta, volver a el y verificar que no hay cabecera ni items antes de cerrar con `ROLLBACK`, que elimina tambien el trigger de prueba.

## Concurrencia del alta

1. Abrir dos sesiones `READ COMMITTED`. En A, iniciar transaccion y hacer un alta valida sin confirmar. En B, hacer otra alta valida para la misma organizacion y los mismos lotes. B debe esperar por el numerador, no fallar por numero duplicado. Confirmar A; B debe continuar y obtener un numero distinto y consecutivo. Repetir con `ROLLBACK` en A: solo se conserva la de B. Verificar items y auditoria por ID.
2. En A tomar `FOR UPDATE` sobre el lote de prueba y mantener la transaccion abierta. En B intentar el alta para ese lote. Debe fallar con `55P03` (HTTP `409` a traves del Edge), sin cabecera ni items ni auditoria, y poder reintentarse manualmente tras liberar A. No equivale a reservar stock: el alta sigue en `creada` y las transiciones siguen a cargo de sus RPC existentes.

## Ajustes y reserva por lote

1. Preparar dos lotes ubicados en la misma ubicacion con fisico 8 y 12 (fisico agregado 20). Aprobar una transferencia de 5 unidades del primero. Un decremento o merma de 4 en el primer lote debe fallar por reserva, aunque queden 15 unidades libres en total. Confirmar que no se escribieron movimiento ni auditoria y que no cambio el fisico. Un decremento de 3 debe prosperar: primer lote 5, segundo 12, agregado 17 y comprometido 5; debe existir un solo movimiento y su auditoria. Repetir para merma con una fixture independiente. Verificar que un incremento sigue funcionando.
2. En una fixture equivalente, en A aprobar una transferencia de 5 unidades y no confirmar. En B intentar el decremento de 4 del mismo lote. Confirmar A; B debe rechazar el ajuste por reserva. Repetir con una transferencia ya aprobada, cancelarla en A y no confirmar: B debe esperar y admitir el decremento tras confirmarse la cancelacion. Verificar cantidades, estado de reserva y ausencia de `40P01` en estas intercalaciones.
3. Con una fixture sin compromisos, iniciar simultaneamente dos decrementos de 5 de un lote con 8. Solo uno debe persistir y el lote debe quedar en 3, con el fisico agregado reducido en 5 y una auditoria. Esto comprueba la serializacion existente, no reproduce un `lost update`.

La migracion 55 conserva `lote -> stock`: `aprobar_transferencia` y `enviar_transferencia` vigentes ya toman los locks en ese sentido. Cambiar solo el ajuste a `stock -> lote` introduciria un ciclo sobre el mismo par de filas. Un cambio global exige definir un orden comun (incluidas operaciones de varios lotes y ubicaciones) y verificarlo tambien contra ventas y otras escrituras de inventario. La 55 no toma locks de transferencias ni intenta corregir reservas que ya excedan la cantidad fisica por otras rutas.
