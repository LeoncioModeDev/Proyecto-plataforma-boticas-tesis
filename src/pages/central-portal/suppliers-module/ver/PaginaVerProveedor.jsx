import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ArrowLeft, Edit, Building, Mail, Phone, Star } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import SinDatos from '@/components/common/SinDatos'
import Alerta from '@/components/common/Alerta'
import { obtenerProveedor } from '@/services/supabase/proveedores'

const ETIQUETAS_IDENTIFICACION = {
  ruc: 'RUC',
  dni: 'DNI',
  'carnet-extranjeria': 'Carnet de Extranjería',
  pasaporte: 'Pasaporte',
}

export default function PaginaVerProveedor() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [proveedor, setProveedor] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargar() {
      try {
        setCargando(true)
        setError(null)
        const datos = await obtenerProveedor(id)
        if (!datos) throw new Error('Proveedor no encontrado')
        setProveedor(datos)
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  if (cargando) {
    return <div className="flex justify-center py-12"><p className="text-secundario">Cargando proveedor...</p></div>
  }

  if (error || !proveedor) {
    return <SinDatos titulo="Proveedor no encontrado" descripcion={error || 'El proveedor solicitado no existe.'} textoAccion="Volver a proveedores" alAccionar={() => navegar('/central/proveedores')} />
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {error && <Alerta tipo="error" titulo={error} className="mb-4" />}
      <div className="flex items-center gap-4">
        <Boton variante="texto" icono={ArrowLeft} onClick={() => navegar('/central/proveedores')}>Volver</Boton>
        <h1 className="text-h1 text-principal">{proveedor.razonSocial}</h1>
        <Insignia color={proveedor.activo ? 'verde' : 'gris'}>{proveedor.activo ? 'Activo' : 'Inactivo'}</Insignia>
        <div className="ml-auto">
          <Boton variante="primario" icono={Edit} onClick={() => navegar(`/central/proveedores/${proveedor.id}/editar`)}>Editar</Boton>
        </div>
      </div>

      <Tarjeta titulo="Información del Proveedor">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
          <div>
            <p className="text-etiqueta text-secundario">Razón Social</p>
            <p className="text-cuerpo text-principal mt-0.5">{proveedor.razonSocial}</p>
          </div>
          <div>
            <p className="text-etiqueta text-secundario">Tipo de Identificación</p>
            <p className="text-cuerpo text-principal mt-0.5">{ETIQUETAS_IDENTIFICACION[proveedor.tipoIdentificacion] || proveedor.tipoIdentificacion}</p>
          </div>
          <div>
            <p className="text-etiqueta text-secundario">Número de Identificación</p>
            <p className="text-cuerpo text-principal mt-0.5 font-mono">{proveedor.numeroIdentificacion}</p>
          </div>
          <div>
            <p className="text-etiqueta text-secundario">País de Origen</p>
            <p className="text-cuerpo text-principal mt-0.5">{proveedor.paisOrigen}</p>
          </div>
        </div>
      </Tarjeta>

      {proveedor.contactos?.length > 0 && (
        <Tarjeta titulo="Contactos">
          <div className="divide-y divide-estilo">
            {proveedor.contactos.map(c => (
              <div key={c.id || c.nombre} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                <div className="p-2 bg-marca-claro rounded-full shrink-0">
                  <Building className="h-4 w-4 text-marca-principal" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-principal">{c.nombre}</p>
                    {c.principal && <Star className="h-3 w-3 text-estado-exito shrink-0" />}
                  </div>
                  {c.telefono && (
                    <p className="text-sm text-secundario flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 shrink-0" /> {c.telefono}
                    </p>
                  )}
                  {c.correo && (
                    <p className="text-sm text-secundario flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3 shrink-0" /> {c.correo}
                    </p>
                  )}
                  {c.direccion && <p className="text-sm text-secundario mt-0.5">{c.direccion}</p>}
                </div>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}

      {proveedor.condicionesComerciales?.length > 0 && (
        <Tarjeta titulo="Condiciones Comerciales">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-estilo">
                  <th className="text-left py-2 px-3 text-secundario font-medium">Moneda</th>
                  <th className="text-left py-2 px-3 text-secundario font-medium">Plazo de Pago</th>
                  <th className="text-left py-2 px-3 text-secundario font-medium">Lead Time</th>
                  <th className="text-left py-2 px-3 text-secundario font-medium">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedor.condicionesComerciales.map(c => (
                  <tr key={c.id} className="border-b border-estilo last:border-0">
                    <td className="py-2 px-3 text-principal">{c.moneda ? `${c.moneda.simbolo} ${c.moneda.codigo}` : '—'}</td>
                    <td className="py-2 px-3 text-principal">{c.plazoPago}</td>
                    <td className="py-2 px-3 text-principal">{c.leadTimePromedio} días</td>
                    <td className="py-2 px-3 text-secundario">{c.observaciones || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  )
}