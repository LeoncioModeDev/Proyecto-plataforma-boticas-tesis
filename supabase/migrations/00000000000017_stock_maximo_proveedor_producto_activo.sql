-- Migración 17: Agregar stock_maximo a stock_ubicaciones y activo a proveedor_producto

-- 1. Agregar stock_maximo a stock_ubicaciones
ALTER TABLE stock_ubicaciones ADD COLUMN IF NOT EXISTS stock_maximo int;
COMMENT ON COLUMN stock_ubicaciones.stock_maximo IS 'Stock máximo permitido para este producto en esta ubicación. NULL = sin límite.';

-- 2. Agregar activo a proveedor_producto para deshabilitar relaciones sin perder trazabilidad
ALTER TABLE proveedor_producto ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN proveedor_producto.activo IS 'Si es false, la relación existe para trazabilidad pero no puede usarse en nuevas operaciones.';
