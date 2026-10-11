export default function CampoTexto({ nombre, etiqueta, placeholder, requerido, error, register, tipo = 'text', className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-sm font-medium text-principal">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <input
        id={nombre}
        type={tipo}
        placeholder={placeholder}
        {...register(nombre)}
        className={`px-3 py-2 text-sm bg-fondo border border-estilo rounded-md
                   placeholder:text-secundario
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-estado-critico">{error}</p>}
    </div>
  )
}
