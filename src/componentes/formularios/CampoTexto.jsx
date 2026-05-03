/**
 * Campo de texto integrado con React Hook Form.
 */
export default function CampoTexto({ nombre, etiqueta, placeholder, requerido, error, register, tipo = 'text', ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-etiqueta font-medium text-neutro-negro-suave">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <input
        id={nombre}
        type={tipo}
        placeholder={placeholder}
        {...register(nombre)}
        className="px-3 py-2 text-cuerpo bg-white border border-neutro-gris-borde rounded-boton
                   placeholder:text-neutro-gris-texto
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors"
        {...props}
      />
      {error && <p className="text-etiqueta text-estado-critico">{error}</p>}
    </div>
  )
}
