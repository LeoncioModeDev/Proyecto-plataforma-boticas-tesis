export default function CampoSeleccion({ nombre, etiqueta, opciones = [], requerido, error, register, placeholder = 'Seleccionar...', className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-sm font-medium text-principal">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <select
        id={nombre}
        {...register(nombre)}
        className={`px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {opciones.map(op => (
          <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
        ))}
      </select>
      {error && <p className="text-xs text-estado-critico">{error}</p>}
    </div>
  )
}
