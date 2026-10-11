import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, ArrowLeft, Building2, Globe, Calendar, User, MapPin, Phone, Mail, IdCard, Check, X } from 'lucide-react'
import { obtenerOrganizacion } from '@/services/supabase/organizaciones'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import useAutenticacion from '@/state/useAutenticacion'
import { esSuperAdmin } from '@/utilities/permisos'

function ItemDetalle({ icono: Icono, etiqueta, valor, monospace }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="p-1.5 bg-fondo rounded-md shrink-0 mt-0.5">
        <Icono className="h-4 w-4 text-marca-principal" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-secundario font-medium">{etiqueta}</p>
        <p className={`text-sm text-principal mt-0.5 ${monospace ? 'font-mono' : ''}`}>
          {valor || <span className="text-secundario italic">No registrado</span>}
        </p>
      </div>
    </div>
  )
}

export default function PaginaDetalleOrganizacion() {
  const { usuario } = useAutenticacion()
  const { id } = useParams()
  const navegar = useNavigate()
  const [org, setOrg] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!esSuperAdmin(usuario)) {
      setCargando(false)
      return
    }
    if (!id) return
    setCargando(true)
    setError('')
    obtenerOrganizacion(id)
      .then(setOrg)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [usuario, id])

  if (!esSuperAdmin(usuario)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secundario text-lg">No tienes permisos para acceder a esta página.</p>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-6 w-6 border-2 border-marca-principal border-t-transparent rounded-full" />
        <span className="ml-3 text-secundario">Cargando organización…</span>
      </div>
    )
  }

  if (error) {
    return <Alerta tipo="error" titulo={error} />
  }

  if (!org) {
    return <Alerta tipo="advertencia" titulo="Organización no encontrada" />
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navegar('/admin-saas/organizaciones')}
          className="inline-flex items-center gap-1.5 text-sm text-secundario hover:text-principal transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a organizaciones
        </button>
        <Boton
          variante="secundario"
          icono={Pencil}
          onClick={() => navegar(`/admin-saas/organizaciones/${id}/editar`)}
        >
          Editar
        </Boton>
      </div>

      <div>
        <h1 className="text-h1 text-principal">{org.nombre}</h1>
        <p className="text-cuerpo text-secundario mt-1">Detalle de la organización</p>
      </div>

      <Tarjeta titulo="Información de la Organización" descripcion="Datos legales y de identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 md:divide-x divide-estilo">
          <div className="md:pr-6 divide-y divide-estilo">
            <ItemDetalle icono={Building2} etiqueta="Nombre o Razón Social" valor={org.nombre} />
            <ItemDetalle icono={IdCard} etiqueta="Tipo de Identificación" valor={org.tipo_identificacion?.toUpperCase()} />
            <ItemDetalle icono={IdCard} etiqueta="Número de Identificación" valor={org.numero_identificacion} />
          </div>
          <div className="md:pl-6 divide-y divide-estilo">
            <ItemDetalle icono={Globe} etiqueta="País de Origen" valor={org.pais_origen} />
            <ItemDetalle
              icono={Globe}
              etiqueta="Dominio Institucional"
              valor={org.dominio_correo_organizacion ? `@${org.dominio_correo_organizacion}` : null}
              monospace
            />
            <ItemDetalle
              icono={Calendar}
              etiqueta="Fecha de Creación"
              valor={org.created_at ? new Date(org.created_at).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null}
            />
          </div>
        </div>
        {org.dominio_correo_organizacion && (
          <div className="mt-4 bg-marca-claro/50 border border-marca-claro rounded-md p-3">
            <p className="text-xs text-secundario">
              <strong className="text-marca-principal">Importante:</strong> El dominio institucional se define al crear la organización y <strong>no puede modificarse</strong> después.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Droguería Central" descripcion="Ubicación principal de almacenamiento y distribución">
        {org.drogueria ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 md:divide-x divide-estilo">
            <div className="md:pr-6 divide-y divide-estilo">
              <ItemDetalle icono={Building2} etiqueta="Nombre" valor={org.drogueria.nombre} />
              <ItemDetalle icono={MapPin} etiqueta="Ubigeo" valor={org.drogueria.ubigeo} monospace />
              <ItemDetalle icono={Phone} etiqueta="Teléfono" valor={org.drogueria.telefono} />
            </div>
            <div className="md:pl-6 divide-y divide-estilo">
              <ItemDetalle icono={IdCard} etiqueta="Código Interno" valor={org.drogueria.codigo_interno} monospace />
              <ItemDetalle icono={MapPin} etiqueta="Dirección" valor={org.drogueria.direccion} />
              <ItemDetalle
                icono={org.drogueria.activa ? Check : X}
                etiqueta="Estado"
                valor={org.drogueria.activa ? 'Activa' : 'Inactiva'}
              />
            </div>
          </div>
        ) : (
          <p className="text-secundario text-sm">No se encontró droguería central para esta organización.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Administrador Central" descripcion="Usuario administrador principal">
        {org.admin ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 md:divide-x divide-estilo">
            <div className="md:pr-6 divide-y divide-estilo">
              <ItemDetalle icono={User} etiqueta="Nombre" valor={org.admin.nombre} />
              <ItemDetalle icono={org.admin.activo ? Check : X} etiqueta="Estado" valor={org.admin.activo ? 'Activo' : 'Inactivo'} />
            </div>
            <div className="md:pl-6 divide-y divide-estilo">
              <ItemDetalle icono={Mail} etiqueta="Correo Electrónico" valor={org.admin.email} monospace />
              {org.admin.ultimo_acceso && (
                <ItemDetalle
                  icono={Calendar}
                  etiqueta="Último Acceso"
                  valor={new Date(org.admin.ultimo_acceso).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="text-secundario text-sm">No se encontró administrador central para esta organización.</p>
        )}
      </Tarjeta>
    </div>
  )
}
