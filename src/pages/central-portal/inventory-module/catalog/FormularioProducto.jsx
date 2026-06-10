import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, ArrowLeft, Eraser } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import CampoTexto from '@/components/forms/CampoTexto'
import CampoSeleccion from '@/components/forms/CampoSeleccion'
import CampoSeleccionMultiple from '@/components/forms/CampoSeleccionMultiple'
import Alerta from '@/components/common/Alerta'
import { productoEsquema } from '@/schemas/productoEsquema'
import { OPCIONES_CLASIFICACION } from '@/constants/clasificacionProducto'
import { OPCIONES_FORMAS_FARMACEUTICAS } from '@/mock-data/formas-farmaceuticas'

import { OPCIONES_PRINCIPIOS_ACTIVOS } from '@/mock-data/principios-activos'
import { OPCIONES_UNIDADES_MEDIDA } from '@/mock-data/unidades-medida'
import { productos as productosMock } from '@/mock-data/productos'

export default function FormularioProducto({ productoEditar }) {
  const navegar = useNavigate()
  const { id } = useParams()
  const [exito, setExito] = useState(false)
  const productoExistente = productoEditar || (id ? productosMock.find(p => p.id === id) : null)
  const esEdicion = !!productoExistente

  const [principiosActivosIds, setPrincipiosActivosIds] = useState([])
  const [concentraciones, setConcentraciones] = useState({})

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(productoEsquema),
    defaultValues: productoExistente || {
      nombreComercial: '',
      formaFarmaceuticaId: '',
      presentacion: '',
      clasificacion: '',
      estado: 'activo',
    },
  })

  const alCambiarPrincipios = (ids) => {
    setPrincipiosActivosIds(ids)
    const nuevas = { ...concentraciones }
    ids.forEach(id => {
      if (!nuevas[id]) nuevas[id] = { concentracion: '', unidadMedidaId: '' }
    })
    Object.keys(nuevas).forEach(k => {
      if (!ids.includes(k)) delete nuevas[k]
    })
    setConcentraciones(nuevas)
  }

  const actualizarConcentracion = (id, campo, valor) => {
    setConcentraciones(prev => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor },
    }))
  }

  const principiosSeleccionados = OPCIONES_PRINCIPIOS_ACTIVOS.filter(op => principiosActivosIds.includes(op.valor))

  const alEnviar = (datos) => {
    const principiosActivos = principiosActivosIds.map(id => ({
      principioActivoId: id,
      concentracion: Number(concentraciones[id]?.concentracion) || 0,
      unidadMedidaId: concentraciones[id]?.unidadMedidaId || '',
    }))

    const ahora = new Date().toISOString()
    const maxCodigo = productosMock.reduce((max, p) => {
      const match = p.codigoInterno?.match(/PRD-(\d+)/)
      return match ? Math.max(max, parseInt(match[1])) : max
    }, 0)
    const producto = {
      ...datos,
      id: productoExistente?.id || crypto.randomUUID(),
      codigoInterno: productoExistente?.codigoInterno || `PRD-${String(maxCodigo + 1).padStart(6, '0')}`,
      principiosActivos,
      createdAt: productoExistente?.createdAt || ahora,
      modifiedAt: ahora,
      modifiedBy: null,
    }
    console.log(esEdicion ? '[Mock] Producto actualizado:' : '[Mock] Producto creado:', producto)
    setExito(true)
    setTimeout(() => navegar(esEdicion ? `/central/inventario/catalogo/${producto.id}` : '/central/inventario/catalogo'), 1500)
  }

  const limpiar = () => {
    setPrincipiosActivosIds([])
    setConcentraciones({})
    setValue('nombreComercial', '')
    setValue('formaFarmaceuticaId', '')
    setValue('presentacion', '')
    setValue('clasificacion', '')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar(esEdicion ? `/central/inventario/catalogo/${id}` : '/central/inventario/catalogo')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{esEdicion ? 'Editar Producto' : 'Nuevo Producto'}</h1>
      </div>
      {exito && <Alerta tipo="exito" titulo="¡Guardado exitosamente!" mensaje="El producto ha sido registrado correctamente." />}
      <Tarjeta>
        <form onSubmit={handleSubmit(alEnviar)} className="space-y-5">
          {esEdicion && (
            <CampoTexto nombre="codigoInterno" etiqueta="Código Interno" register={register} error={errors.codigoInterno?.message} readonly className="bg-gray-100 cursor-not-allowed" />
          )}
          <CampoTexto nombre="nombreComercial" etiqueta="Nombre Comercial" requerido register={register} error={errors.nombreComercial?.message} placeholder="Ingrese el nombre comercial" />

          <CampoSeleccionMultiple
            nombre="principiosActivos"
            etiqueta="Principios Activos"
            opciones={OPCIONES_PRINCIPIOS_ACTIVOS}
            valoresSeleccionados={principiosActivosIds}
            alCambiar={alCambiarPrincipios}
            requerido
            error={errors.principiosActivos?.message}
          />

          {principiosActivosIds.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-principal">
                Concentraciones <span className="text-estado-critico">*</span>
              </label>
              {principiosSeleccionados.map(pa => (
                <div key={pa.valor} className="flex items-center gap-3">
                  <span className="text-sm font-medium min-w-[140px] truncate">{pa.etiqueta}:</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Valor"
                    value={concentraciones[pa.valor]?.concentracion || ''}
                    onChange={e => actualizarConcentracion(pa.valor, 'concentracion', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal focus:ring-1 focus:ring-marca-principal"
                  />
                  <select
                    value={concentraciones[pa.valor]?.unidadMedidaId || ''}
                    onChange={e => actualizarConcentracion(pa.valor, 'unidadMedidaId', e.target.value)}
                    className="w-24 px-3 py-2 text-sm bg-fondo border border-estilo rounded-md focus:outline-none focus:border-marca-principal"
                  >
                    <option value="">Unidad</option>
                    {OPCIONES_UNIDADES_MEDIDA.map(u => (
                      <option key={u.valor} value={u.valor}>{u.etiqueta}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <CampoSeleccion nombre="formaFarmaceuticaId" etiqueta="Forma Farmacéutica" opciones={OPCIONES_FORMAS_FARMACEUTICAS} requerido register={register} error={errors.formaFarmaceuticaId?.message} placeholder="Seleccione la forma" />
            <CampoTexto nombre="presentacion" etiqueta="Presentación" register={register} error={errors.presentacion?.message} placeholder="Ej: Caja x 30 Tabletas, Frasco x 60 mL" />
            <CampoSeleccion nombre="clasificacion" etiqueta="Clasificación" opciones={OPCIONES_CLASIFICACION} requerido register={register} error={errors.clasificacion?.message} placeholder="Seleccione la clasificación" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-estilo">
            <Boton tipo="submit" variante="primario" icono={Save} cargando={isSubmitting} className="flex-1">
              Guardar Producto
            </Boton>
            <Boton variante="secundario" icono={Eraser} onClick={limpiar}>
              Limpiar
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  )
}
