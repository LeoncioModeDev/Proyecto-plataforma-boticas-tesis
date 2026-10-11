export default function CampoNumero({ nombre, etiqueta, requerido, error, register, min, max, paso = 1, className, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && (
        <label htmlFor={nombre} className="text-sm font-medium text-principal">
          {etiqueta} {requerido && <span className="text-estado-critico">*</span>}
        </label>
      )}
      <input
        id={nombre}
        type="number"
        min={min}
        max={max}
        step={paso}
        {...register(nombre)}
        className={`px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal
                   focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal
                   transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-estado-critico">{error}</p>}
    </div>
  )
}
