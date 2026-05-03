/**
 * Campo de fecha integrado con React Hook Form.
 */
export default function CampoFecha({ nombre, etiqueta, requerido, error, register, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-etiqueta font-medium text-neutro-negro-suave">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <input
        id={nombre}
        type="date"
        {...register(nombre)}
        className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                   text-neutro-negro-suave
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors"
        {...props}
      />
      {error && <p className="text-etiqueta text-estado-critico">{error}</p>}
    </div>
  )
}
