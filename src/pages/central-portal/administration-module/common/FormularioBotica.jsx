import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import { OPCIONES_TIPO_BOTICA, boticas as boticasMock } from '@/mock-data/boticas'
import { useState } from 'react'

let idTemporal = 100

function generarIdTemporal() {
  return `ub-${++idTemporal}`
}

export default function FormularioBotica({ boticaEditar, alGuardar }) {
  const navegar = useNavigate()
  const esEdicion = !!boticaEditar

  const [formulario, setFormulario] = useState({
    codigoInterno: boticaEditar?.codigoInterno || '',
    nombre: boticaEditar?.nombre || '',
    tipo: boticaEditar?.tipo || 'botica',
    ubigeo: boticaEditar?.ubigeo || '',
    distrito: boticaEditar?.distrito || '',
    direccion: boticaEditar?.direccion || '',
    telefono: boticaEditar?.telefono || '',
    encargado: boticaEditar?.encargado || '',
    activa: boticaEditar?.activa ?? true,
  })
  const [error, setError] = useState('')

  const validar = () => {
    if (!formulario.nombre.trim()) return 'El nombre es obligatorio'
    if (!formulario.tipo) return 'El tipo es obligatorio'
    if (!formulario.distrito.trim()) return 'El distrito es obligatorio'
    if (!formulario.direccion.trim()) return 'La dirección es obligatoria'
    return null
  }

  const alEnviar = (e) => {
    e.preventDefault()
    const errorVal = validar()
    if (errorVal) { setError(errorVal); return }
    const maxCodigo = boticasMock.reduce((max, b) => {
      const match = b.codigoInterno?.match(/BOT-(\d+)/)
      return match ? Math.max(max, parseInt(match[1])) : max
    }, 0)

    const botica = {
      id: boticaEditar?.id || generarIdTemporal(),
      ...formulario,
      codigoInterno: boticaEditar?.codigoInterno || `BOT-${String(maxCodigo + 1).padStart(6, '0')}`,
      organizacionId: boticaEditar?.organizacionId || 'org-001',
      createdAt: boticaEditar?.createdAt || new Date().toISOString(),
    }
    alGuardar(botica)
  }

  const manejarCambio = (campo, valor) => {
    setFormulario(prev => ({ ...prev, [campo]: valor }))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/administracion/boticas')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{esEdicion ? 'Editar Botica' : 'Nueva Botica'}</h1>
      </div>

      {error && <Alerta tipo="error" titulo={error} />}

      <Tarjeta>
        <form onSubmit={alEnviar} className="space-y-5">
          {esEdicion && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Código Interno</label>
              <input
                type="text"
                value={formulario.codigoInterno}
                readOnly
                className="px-3 py-2 text-sm bg-gray-100 border border-estilo rounded-md text-principal cursor-not-allowed"
              />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Nombre <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.nombre}
                onChange={e => manejarCambio('nombre', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Nombre de la ubicación"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Tipo <span className="text-estado-critico">*</span></label>
              <select
                value={formulario.tipo}
                onChange={e => manejarCambio('tipo', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              >
                {OPCIONES_TIPO_BOTICA.map(op => (
                  <option key={op.valor} value={op.valor}>{op.etiqueta}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Distrito <span className="text-estado-critico">*</span></label>
              <input
                type="text"
                value={formulario.distrito}
                onChange={e => manejarCambio('distrito', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="Distrito"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Ubigeo</label>
              <input
                type="text"
                value={formulario.ubigeo}
                onChange={e => manejarCambio('ubigeo', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="6 dígitos"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-principal">Teléfono</label>
              <input
                type="text"
                value={formulario.telefono}
                onChange={e => manejarCambio('telefono', e.target.value)}
                className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
                placeholder="01-2345678"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Dirección <span className="text-estado-critico">*</span></label>
            <input
              type="text"
              value={formulario.direccion}
              onChange={e => manejarCambio('direccion', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              placeholder="Av. / Calle / Jr."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Encargado</label>
            <input
              type="text"
              value={formulario.encargado}
              onChange={e => manejarCambio('encargado', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
              placeholder="Nombre del encargado"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activa"
              checked={formulario.activa}
              onChange={e => manejarCambio('activa', e.target.checked)}
              className="rounded border-estilo"
            />
            <label htmlFor="activa" className="text-sm text-principal">Ubicación activa</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => navegar('/central/administracion/boticas')}>Cancelar</Boton>
            <Boton tipo="submit" variante="primario" icono={Save}>
              {esEdicion ? 'Actualizar' : 'Crear'} Botica
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
