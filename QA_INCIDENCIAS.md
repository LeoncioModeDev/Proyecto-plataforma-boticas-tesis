# Reejecución de incidencias de BoticAI

Usar una instancia local o QA y su origen confirmado. La ruta de entrada de la aplicación es `/iniciar-sesion`. No se localizaron las fichas originales de CP112, CP051 ni CP155 en el repositorio. Estos guiones son propuestas para actualizarlas; no documentan ejecuciones realizadas.

## CP112: órdenes de compra por rol

**Admin Central.** Iniciar sesión en `<origen QA>/iniciar-sesion`, abrir `/central/proveedores/ordenes` y usar dos órdenes pendientes de su organización. Aprobar la primera y rechazar la segunda indicando el motivo. Recargar y comprobar que los estados son `aprobada` y `rechazada`. Con una orden aprobada independiente, comprobar la transición a `por_recibir`.

**Operador de Droguería.** Cerrar sesión, entrar con una cuenta independiente y abrir `/operaciones/ordenes-compra`. En una orden pendiente debe aparecer «Pendiente de aprobación por administrador» y no deben aparecer Aprobar ni Rechazar. Verificar las acciones operativas sobre otra orden aprobada, con los estados y datos requeridos. El rechazo de la autorización en el servidor debe verificarse por separado con identidades controladas en QA; la visibilidad no es evidencia de autorización.

La migración de permisos RPC debe probarse primero en local. No cubre el acceso directo a `ordenes_compra` ni resuelve los permisos efectivos de escritura de campos sensibles de `usuarios`.

## CP051: importancia de variables

No usar el dominio antiguo ni `/login/` sin confirmar la versión de QA. La ruta actual de acceso es `<origen QA>/iniciar-sesion`. Como Admin Central, abrir **Machine Learning → Predicciones** (`/ml/predicciones`), elegir botica y producto y consultar la predicción individual. **Monitoreo del Modelo** (`/ml/monitoreo`) muestra métricas y el estado del modelo, no una vista global de importancia de variables. Falta identificar la versión o especificación de esa vista para completar la comparación del paso 8. No se sustituyó la funcionalidad reportada por otra.

## CP155: FEFO con reserva por lote

En local o QA, preparar un producto activo con precio vigente en una botica de prueba y dos lotes no vencidos. Configurar los datos mediante los procesos admitidos del entorno; no crear datos en producción. Registrar los identificadores que genere ese entorno, no asumir un SKU concreto.

| Lote | Físico inicial | Reserva por transferencia aprobada | Consumo esperado | Físico final |
|---|---:|---:|---:|---:|
| Primero en vencer | 8 | 5 | 3 | 5 |
| Segundo en vencer | 12 | 0 | 7 | 5 |

Como Visor de la botica, abrir `/botica/ventas/registrar` y vender 10 unidades. Inicialmente se esperan 20 físicas, 5 comprometidas y 15 disponibles. Al finalizar se esperan 10 físicas, 5 comprometidas y 5 disponibles. Comprobar también las cantidades por lote y los movimientos de la venta. La implementación actual limita por disponible agregado, pero no excluye del FEFO las unidades reservadas del lote; no considerar el caso aprobado solo porque los totales coincidan. Queda pendiente validar y corregir la asignación por lote y la concurrencia con transferencias.

## Verificaciones adicionales en QA

| Área | Verificación pendiente |
|---|---|
| Contenido de usuario | Confirmar visualización literal de texto, caracteres legítimos y marcado no confiable persistido en tablas, formularios y detalle; no ejecutar contenido. |
| Sesión | Probar renovación válida, expiración definitiva, dos pestañas y guardado en Proveedores/OC. Confirmar que no se reenvían escrituras automáticamente ni se pierde sesión ante un `403`. |
| Movimientos e históricos | Revisar fechas iguales, abiertas e invertidas, con y sin ubicación. Verificar que Históricos no emite la consulta si los límites están invertidos. |
| Visor | Abrir Stock Histórico desde el menú y por URL. Confirmar que solo ve su botica y organización, sin operaciones de escritura; cubrir perfil sin asignación. |
| Productos | Abrir el detalle desde Operaciones, volver con el enlace, con el navegador y tras acceder directamente; combinar concentración con principio activo y limpiar filtros. |
| Stock | Guardar mínimo 10 y máximo 20 como Admin Central, recargar y verificar persistencia; comprobar que físico, comprometido y movimientos permanecen iguales. |
| Lotes | Seleccionar un lote existente, comprobar solo movimientos con su identificador, abrir por URL y volver al listado de cada portal; verificar errores y ausencia de movimientos. |

## 0003167 / 0003171: vencimientos y trazabilidad

- Con Admin Central y Operador, abrir **Inventario → Clasificación de vencimiento** y **Trazabilidad de lotes** desde el menú y por URL. Verificar título, detalle y regreso a la lista de origen. Con Visor o sin sesión, comprobar que las rutas nuevas siguen bloqueadas y que `/botica/lotes` conserva su acceso habitual.

## CP151, CP149 y CP150: acceso y datos de QA

El mensaje de cuenta desactivada corresponde a la validación de `usuarios.activo`, no a un fallo demostrado de Ventas o Distribución. No se consultó la cuenta reportada. El responsable de QA debe proporcionar un Admin Central ya habilitado de la organización de pruebas, o tramitar por el procedimiento autorizado la recuperación de la cuenta. La migración 54 no reactiva perfiles y no cambia el índice que limita la organización a un Admin Central.

- **CP151:** abrir `/central/ventas`, combinar filtros de botica y fechas, abrir un detalle, contrastar folios y totales con los registros de las boticas de QA y verificar que no aparezcan ventas de otra organización.
- **CP149:** en `/central/distribucion/transferencias`, registrar el estado y los saldos previos, confirmar una transición válida y contrastar estado, compromisos, existencias y movimientos tras recargar.
- **CP150:** con una base aislada, registrar los mismos valores previos y forzar de manera controlada un fallo en la transición, incluido un fallo en la inserción de un movimiento. Verificar reversión y que dos confirmaciones simultáneas no produzcan transiciones incompatibles. Consultar también [el guion de transferencias y ajustes](tests/transferencias-ajustes-local.md); la prueba del alta no sustituye la prueba de la transición.
- **CP153:** entrar con un Operador habilitado y abrir `/operaciones/ventas`. Verificar el alcance de la organización asignada (incluida `org-001` si es el escenario de QA), que no haya controles de registro manual y que la ruta mantenga la consulta. Confirmar el nombre oficial con la ficha HU77 antes de renombrar la opción.

## Datos y comprobaciones de lotes para CP067 y CP069

- Con un valor de `alerta_vencimiento_dias` distinto al predeterminado, comprobar ayer, hoy, el último día del umbral y el siguiente día en los tres listados. Para el calendario se usa UTC, como en las validaciones de inventario de la migración 51. Hoy todavía es válido. En Trazabilidad deben aparecer también los lotes agotados.
- Preparar dos lotes del mismo producto y recepciones de OC, ventas (incluida una anulación) y transferencias. Contrastar `recepcion_items.lote_id`, `movimientos_inventario.lote_id`, `venta_id` y `transferencia_id`. Verificar visibilidad con sesiones reales de dos organizaciones y dos boticas. El estado de la OC, venta o transferencia es el actual, no el estado histórico a la fecha del movimiento.
- Las recepciones se muestran en una tabla separada: `recepcion_items` vincula el lote a la recepción y a la OC, pero no identifica el movimiento individual. No se interpreta el motivo como una clave. Las recepciones sin UUID de lote no se muestran.
- La migración 21 registraba ciertas entradas con el UUID de origen y la ubicación de destino. No se atribuyen al origen ni se reconstruyen para el destino por producto o número de lote. Las migraciones 47 y 51 sí escriben el UUID de destino en el movimiento y permiten mostrar esas entradas. No se enlaza un ítem origen con un lote destino si no hay vínculo persistido.
