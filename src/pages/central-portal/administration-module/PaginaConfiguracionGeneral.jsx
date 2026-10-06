import { useState, useEffect, useRef } from 'react'
import { Save, Building2, Package } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import useConfiguracion from '@/state/useConfiguracion'

export default function PaginaConfiguracionGeneral() {
  const { config, cargando, guardando, error, cargarConfig, guardarConfig, limpiarError } = useConfiguracion()
  const [form, setForm] = useState(null)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    cargarConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inicializado = useRef(false)
  useEffect(() => {
    if (config && !inicializado.current) {
      inicializado.current = true
      setForm({ ...config })
    }
  }, [config])

  useEffect(() => {
    if (exito) {
      const t = setTimeout(() => setExito(false), 3000)
      return () => clearTimeout(t)
    }
  }, [exito])

  if (cargando && !form) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-h1 text-principal">Configuración General</h1>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-marca-principal border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (!form && !cargando) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-h1 text-principal">Configuración General</h1>
        <Alerta tipo="error" titulo={error || 'No se pudo cargar la configuración'} />
        <Boton variante="secundario" onClick={cargarConfig}>Reintentar</Boton>
      </div>
    )
  }

  const manejarCambio = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const manejarGuardar = async () => {
    const camposEditables = {
      nombre_comercial: form.nombreComercial,
      direccion_fiscal: form.direccionFiscal,
      telefono_contacto: form.telefonoContacto,
      email_contacto: form.emailContacto,
      dominio_web: form.dominioWeb,
      alerta_vencimiento_dias: Number(form.alertaVencimientoDias),
      umbral_sobrestock_dias: Number(form.umbralSobrestockDias),
      horizonte_alerta_quiebre_dias: Number(form.horizonteAlertaQuiebreDias),
    }
    const result = await guardarConfig(camposEditables)
    if (result.exito) setExito(true)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-h1 text-principal">Configuración General</h1>
        <p className="text-cuerpo text-secundario mt-1">Información de la organización y reglas de inventario</p>
      </div>

      {error && <Alerta tipo="error" titulo={error} onClose={limpiarError} />}
      {exito && <Alerta tipo="exito" titulo="Configuración guardada correctamente" />}

      <Tarjeta titulo="Información de la Organización" icono={Building2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Nombre Comercial</label>
            <input
              type="text"
              value={form.nombreComercial || ''}
              onChange={e => manejarCambio('nombreComercial', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Dirección Fiscal</label>
            <input
              type="text"
              value={form.direccionFiscal || ''}
              onChange={e => manejarCambio('direccionFiscal', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Teléfono de Contacto</label>
            <input
              type="text"
              value={form.telefonoContacto || ''}
              onChange={e => manejarCambio('telefonoContacto', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Email de Contacto</label>
            <input
              type="email"
              value={form.emailContacto || ''}
              onChange={e => manejarCambio('emailContacto', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Sitio Web</label>
            <input
              type="text"
              value={form.dominioWeb || ''}
              onChange={e => manejarCambio('dominioWeb', e.target.value)}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Reglas de Inventario" icono={Package}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Alerta de Vencimiento (días)</label>
            <p className="text-xs text-secundario">Lotes próximos a vencer dentro de este rango</p>
            <select
              value={form.alertaVencimientoDias}
              onChange={e => manejarCambio('alertaVencimientoDias', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            >
              {[15, 30, 45, 60, 90, 120].map(d => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Umbral de Sobrestock (días)</label>
            <p className="text-xs text-secundario">Inventario suficiente para más de X días</p>
            <input
              type="number"
              min={1}
              value={form.umbralSobrestockDias ?? 60}
              onChange={e => manejarCambio('umbralSobrestockDias', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Horizonte Alerta de Quiebre (días)</label>
            <p className="text-xs text-secundario">Días hacia adelante para proyectar quiebre de stock</p>
            <input
              type="number"
              min={1}
              value={form.horizonteAlertaQuiebreDias ?? 30}
              onChange={e => manejarCambio('horizonteAlertaQuiebreDias', Number(e.target.value))}
              className="px-3 py-2 text-sm bg-fondo border border-estilo rounded-md text-principal focus:outline-none focus:border-marca-principal"
            />
          </div>
        </div>
      </Tarjeta>

      <div className="flex justify-end pt-4">
        <Boton
          variante="primario"
          icono={Save}
          onClick={manejarGuardar}
          deshabilitado={guardando}
          cargando={guardando}
        >
          Guardar Configuración
        </Boton>
      </div>
    </div>
  )
}
