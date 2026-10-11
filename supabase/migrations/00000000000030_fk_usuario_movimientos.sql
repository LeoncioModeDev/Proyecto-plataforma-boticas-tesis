-- ============================================================
-- Migration 30: Agregar FK faltante en movimientos_inventario
-- ============================================================
-- PostgREST necesita la FK explícita para resolver
-- la relación usuarios:usuario_id(nombre) en las consultas.

ALTER TABLE movimientos_inventario
  ADD CONSTRAINT fk_movimientos_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

-- También agregamos FK para transferencias.creado_por
ALTER TABLE transferencias
  ADD CONSTRAINT fk_transferencias_creado_por
  FOREIGN KEY (creado_por) REFERENCES usuarios(id);
