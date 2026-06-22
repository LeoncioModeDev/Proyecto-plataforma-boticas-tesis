import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Pencil, UserPlus } from 'lucide-react'
import { listarOrganizaciones } from '@/services/supabase/organizaciones'
import Tabla from '@/components/common/Tabla'
import Alerta from '@/components/common/Alerta'
import Boton from '@/components/common/Boton'
import useAutenticacion from '@/state/useAutenticacion'
import { esSuperAdmin } from '@/utilities/permisos'

export default function PaginaOrganizaciones() {
  const { usuario } = useAutenticacion()
  const navegar = useNavigate()
  const [datos, setDatos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!esSuperAdmin(usuario)) {
      setCargando(false)
      return
    }
    setCargando(true)
    setError('')
    listarOrganizaciones()
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [usuario])

  if (!esSuperAdmin(usuario)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secundario text-lg">No tienes permisos para acceder a esta página.</p>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-secundario">Cargando organizaciones...</p>
      </div>
    )
  }

  const columnas = [
    { campo: 'nombre', encabezado: 'Nombre' },
    {
      campo: 'tipo_identificacion',
      encabezado: 'Tipo ID',
      render: (fila) => fila.tipo_identificacion?.toUpperCase() || '—',
    },
    { campo: 'numero_identificacion', encabezado: 'N° Identificación' },
    {
      campo: 'pais_origen',
      encabezado: 'País',
      render: (fila) => fila.pais_origen || '—',
    },
    {
      campo: 'dominio_correo_organizacion',
      encabezado: 'Dominio',
      render: (fila) => (
        <span className="text-xs font-mono">{fila.dominio_correo_organizacion || '—'}</span>
      ),
    },
    {
      campo: 'drogueria_nombre',
      encabezado: 'Droguería',
      render: (fila) => (
        <span className="text-xs">
          {fila.drogueria_nombre || '—'}
          {fila.drogueria_codigo && <span className="text-secundario ml-1">({fila.drogueria_codigo})</span>}
        </span>
      ),
    },
    {
      campo: 'admin_nombre',
      encabezado: 'Admin',
      render: (fila) => (
        <div className="text-xs">
          <p>{fila.admin_nombre || '—'}</p>
          {fila.admin_email && <p className="text-secundario">{fila.admin_email}</p>}
        </div>
      ),
    },
    {
      campo: 'created_at',
      encabezado: 'Creado',
      render: (fila) =>
        fila.created_at
          ? new Date(fila.created_at).toLocaleDateString('en-GB')
          : '—',
    },
    {
      campo: 'acciones',
      encabezado: 'Acciones',
      ordenable: false,
      render: (fila) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Eye} onClick={() => navegar(`/admin-saas/organizaciones/${fila.id}`)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro" />
          <Boton variante="icono" icono={Pencil} onClick={() => navegar(`/admin-saas/organizaciones/${fila.id}/editar`)} title="Editar" className="text-marca-principal hover:bg-marca-claro" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-h1 text-principal">Organizaciones</h1>
          <p className="text-cuerpo text-secundario mt-1">
            Gestiona las organizaciones registradas en la plataforma
          </p>
        </div>
        <Boton
          icono={UserPlus}
          onClick={() => navegar('/admin-saas/organizaciones/crear')}
        >
          Crear Organización
        </Boton>
      </div>

      {error && <Alerta tipo="error" titulo={error} />}

      <Tabla
        columnas={columnas}
        datos={datos}
        tamanoPagina={10}
        alClickFila={(fila) => navegar(`/admin-saas/organizaciones/${fila.id}`)}
      />
    </div>
  )
}
