/**
 * Campo de texto multilínea integrado con React Hook Form.
 */
export default function CampoTextoArea({ nombre, etiqueta, placeholder, requerido, error, register, filas = 3, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-etiqueta font-medium text-neutro-negro-suave">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <textarea
        id={nombre}
        rows={filas}
        placeholder={placeholder}
        {...register(nombre)}
        className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                   placeholder:text-neutro-gris-texto resize-y
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors"
        {...props}
      />
      {error && <p className="text-etiqueta text-estado-critico">{error}</p>}
    </div>
  )
}
