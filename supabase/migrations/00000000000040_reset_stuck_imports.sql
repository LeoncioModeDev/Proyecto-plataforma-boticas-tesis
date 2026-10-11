-- Resetear importaciones trabadas en estado 'procesando' a 'listo_para_importar'
UPDATE importaciones_datos
SET estado = 'listo_para_importar', detalle_error = 'Reiniciado por deploy de fix anti-trabado', modified_at = now()
WHERE estado = 'procesando';
