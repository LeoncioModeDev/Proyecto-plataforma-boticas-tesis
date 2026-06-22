import { useState, useEffect } from 'react'
import {
  Upload, FileSpreadsheet, FileText, Download, CheckCircle2,
  Building2, Package, Truck, Users,
  Handshake, PackageOpen, BarChart3, Eye,
} from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Alerta from '@/components/common/Alerta'
import useAutenticacion from '@/state/useAutenticacion'
import {
  listarImportaciones, validarImportacion, ejecutarImportacion,
  descargarPlantilla, descargarErrores, subirArchivoStorage,
} from '@/services/supabase/configuracion'

const TIPOS = [
  { id: 'boticas', etiqueta: 'Boticas', descripcion: 'Importar boticas desde archivo CSV', icono: Building2 },
  { id: 'productos', etiqueta: 'Productos', descripcion: 'Importar catálogo de productos', icono: Package },
  { id: 'proveedores', etiqueta: 'Proveedores', descripcion: 'Importar lista de proveedores', icono: Truck },
  { id: 'usuarios', etiqueta: 'Usuarios', descripcion: 'Importar usuarios mediante invitación', icono: Users },
  { id: 'proveedor_producto', etiqueta: 'Proveedor-Producto', descripcion: 'Asignar productos a proveedores', icono: Handshake },
  { id: 'stock_inicial', etiqueta: 'Stock Inicial', descripcion: 'Importar stock inicial con lotes', icono: PackageOpen },
  { id: 'ventas_historicas', etiqueta: 'Ventas Históricas', descripcion: 'Importar ventas pasadas (no genera movimientos)', icono: BarChart3 },
]

const ETIQUETAS_ESTADO = {
  validando: 'Validando',
  listo_para_importar: 'Listo para importar',
  procesando: 'Procesando',
  completada: 'Completada',
  completada_con_errores: 'Completada con errores',
  fallida: 'Fallida',
}

const COLORES_ESTADO = {
  validando: 'text-marca-principal bg-marca-claro',
  listo_para_importar: 'text-principal bg-fondo',
  procesando: 'text-marca-principal bg-marca-claro',
  completada: 'text-estado-exito bg-green-50 dark:bg-green-900/20',
  completada_con_errores: 'text-estado-advertencia bg-yellow-50 dark:bg-yellow-900/20',
  fallida: 'text-estado-critico bg-red-50 dark:bg-red-900/20',
}

export default function PaginaImportacionDatos() {
  const usuario = useAutenticacion(s => s.usuario)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [importacionId, setImportacionId] = useState(null)
  const [validando, setValidando] = useState(false)
  const [validacion, setValidacion] = useState(null)
  const [importando, setImportando] = useState(false)
  const [resultadoImportacion, setResultadoImportacion] = useState(null)
  const [historial, setHistorial] = useState([])
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLineas, setPreviewLineas] = useState([])
  const [descargando, setDescargando] = useState(false)

  const refrescarHistorial = () => {
    listarImportaciones({ limite: 20 })
      .then(data => setHistorial(data.datos || []))
      .catch(console.error)
  }

  useEffect(() => {
    refrescarHistorial()
  }, [])

  const handleTipoClick = (tipo) => {
    setTipoSeleccionado(tipo)
    setArchivo(null)
    setImportacionId(null)
    setValidacion(null)
    setResultadoImportacion(null)
    setError(null)
    setPreviewUrl(null)
    setPreviewLineas([])
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setArchivo(file)
    setImportacionId(null)
    setValidacion(null)
    setResultadoImportacion(null)
    setError(null)

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    if (file.name.endsWith('.csv')) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target.result
        const lineas = text.split('\n').filter(l => l.trim()).slice(0, 6)
        setPreviewLineas(lineas)
      }
      reader.readAsText(file)
    } else {
      setPreviewLineas(['Vista previa no disponible para archivos XLSX. Use la validación para revisar los datos.'])
    }
  }

  const handleUploadAndValidate = async () => {
    if (!archivo || !tipoSeleccionado) return
    setError(null)
    setSubiendo(true)

    try {
      const tempId = crypto.randomUUID()
      const orgId = usuario?.orgId
      if (!orgId) throw new Error('No se pudo determinar la organización')

      const ruta = await subirArchivoStorage(archivo, orgId, tempId)

      setSubiendo(false)
      setValidando(true)

      const resultado = await validarImportacion(
        tipoSeleccionado.id,
        ruta,
        archivo.name,
        archivo.type || 'text/csv',
        archivo.size,
      )

      setValidacion(resultado)
      setImportacionId(resultado.importacion_id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(false)
      setValidando(false)
    }
  }

  const handleImport = async () => {
    if (!importacionId || !tipoSeleccionado) return
    setError(null)
    setImportando(true)

    try {
      const resultado = await ejecutarImportacion(tipoSeleccionado.id, importacionId)
      setResultadoImportacion(resultado)
      refrescarHistorial()
    } catch (e) {
      setError(e.message)
    } finally {
      setImportando(false)
    }
  }

  const handleDownloadTemplate = async () => {
    if (!tipoSeleccionado) return
    setDescargando(true)
    try {
      const csv = await descargarPlantilla(tipoSeleccionado.id)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plantilla_${tipoSeleccionado.id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setDescargando(false)
    }
  }

  const handleDownloadErrors = async (id) => {
    try {
      const csv = await descargarErrores(id)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `errores_${id}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    }
  }

  const formatearFecha = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('es-PE', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatearTamano = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-h1 text-principal">Importación de Datos</h1>
        <p className="text-cuerpo text-secundario mt-1">
          Importe datos masivos mediante archivos CSV. Proceso en dos pasos: validar e importar.
        </p>
      </div>

      {error && <Alerta tipo="error" titulo={error} onClose={() => setError(null)} />}

      {!tipoSeleccionado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIPOS.map(tipo => {
            const Icono = tipo.icono
            return (
              <button
                key={tipo.id}
                onClick={() => handleTipoClick(tipo)}
                className="flex items-start gap-4 p-5 bg-fondo-secundario border border-estilo rounded-lg hover:border-marca-principal hover:shadow-md transition-all text-left"
              >
                <div className="p-2.5 bg-marca-claro rounded-lg shrink-0">
                  <Icono className="h-5 w-5 text-marca-principal" />
                </div>
                <div>
                  <p className="font-medium text-principal text-cuerpo">{tipo.etiqueta}</p>
                  <p className="text-etiqueta text-secundario mt-0.5">{tipo.descripcion}</p>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <Boton variante="texto" onClick={() => handleTipoClick(null)}>
              ← Volver a tipos
            </Boton>
            <span className="text-secundario">|</span>
            <span className="text-sm font-medium text-principal">
              Importando: {TIPOS.find(t => t.id === tipoSeleccionado.id)?.etiqueta}
            </span>
          </div>

          <Tarjeta titulo="Archivo" descripcion="Seleccione un archivo CSV o XLSX para importar">
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <Boton
                  variante="secundario"
                  icono={Download}
                  onClick={handleDownloadTemplate}
                  cargando={descargando}
                >
                  Descargar Plantilla
                </Boton>
              </div>

              <div className="border-2 border-dashed border-estilo rounded-lg p-8 text-center hover:border-marca-principal transition-colors">
                {archivo ? (
                  <div className="space-y-3">
                    <FileSpreadsheet className="h-10 w-10 text-marca-principal mx-auto" />
                    <p className="font-medium text-principal">{archivo.name}</p>
                    <p className="text-etiqueta text-secundario">{formatearTamano(archivo.size)}</p>
                    <label className="inline-block cursor-pointer">
                      <span className="text-sm text-marca-principal hover:underline">Cambiar archivo</span>
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-10 w-10 text-secundario mx-auto mb-3" />
                    <p className="text-principal font-medium">Haga clic para seleccionar un archivo</p>
                    <p className="text-etiqueta text-secundario mt-1">CSV o XLSX (máx. 50 MB)</p>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                  </label>
                )}
              </div>

              {previewLineas.length > 0 && (
                <div className="bg-fondo rounded-lg p-4 overflow-x-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-secundario" />
                    <span className="text-sm font-medium text-secundario">Vista previa</span>
                  </div>
                  <pre className="text-xs text-principal font-mono whitespace-pre">
                    {previewLineas.join('\n')}
                  </pre>
                </div>
              )}

              <div className="flex justify-end">
                <Boton
                  variante="primario"
                  icono={Upload}
                  onClick={handleUploadAndValidate}
                  deshabilitado={!archivo || subiendo || validando}
                  cargando={subiendo || validando}
                >
                  {subiendo ? 'Subiendo...' : validando ? 'Validando...' : 'Validar Archivo'}
                </Boton>
              </div>
            </div>
          </Tarjeta>

          {validacion && (
            <Tarjeta titulo="Resultado de Validación">
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-fondo rounded-lg text-center">
                    <p className="text-2xl font-bold text-principal">{validacion.resumen?.total || 0}</p>
                    <p className="text-xs text-secundario mt-1">Total Filas</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-exito">{validacion.resumen?.validos || 0}</p>
                    <p className="text-xs text-secundario mt-1">Válidas</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-critico">{validacion.resumen?.invalidos || 0}</p>
                    <p className="text-xs text-secundario mt-1">Inválidas</p>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-advertencia">{validacion.resumen?.warnings || 0}</p>
                    <p className="text-xs text-secundario mt-1">Advertencias</p>
                  </div>
                </div>

                {validacion.errores && validacion.errores.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-estilo">
                          <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Fila</th>
                          <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Columna</th>
                          <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Valor</th>
                          <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validacion.errores.slice(0, 50).map((err, i) => (
                          <tr key={i} className="border-b border-estilo hover:bg-fondo">
                            <td className="py-2 px-3 text-principal">{err.fila}</td>
                            <td className="py-2 px-3 text-principal">{err.columna || '—'}</td>
                            <td className="py-2 px-3 text-principal font-mono text-xs">{err.valor || '—'}</td>
                            <td className="py-2 px-3 text-estado-critico text-xs">{err.mensaje}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validacion.errores.length > 50 && (
                      <p className="text-xs text-secundario mt-2 text-center">
                        Mostrando 50 de {validacion.errores.length} errores
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Boton
                    variante="primario"
                    icono={CheckCircle2}
                    onClick={handleImport}
                    deshabilitado={
                      importando ||
                      !validacion.resumen?.validos ||
                      validacion.resumen?.validos === 0
                    }
                    cargando={importando}
                  >
                    {importando ? 'Importando...' : 'Importar Datos Válidos'}
                  </Boton>
                </div>

                {resultadoImportacion && (
                  <Alerta
                    tipo={resultadoImportacion.exito ? 'exito' : 'error'}
                    titulo={
                      resultadoImportacion.exito
                        ? `Importación completada: ${resultadoImportacion.insertados || 0} insertados, ${resultadoImportacion.actualizados || 0} actualizados`
                        : 'Error durante la importación'
                    }
                  />
                )}
              </div>
            </Tarjeta>
          )}

          <Tarjeta titulo="Historial de Importaciones">
            {historial.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-secundario mx-auto mb-2" />
                <p className="text-principal font-medium">No hay importaciones registradas</p>
                <p className="text-etiqueta text-secundario mt-1">Seleccione un tipo de importación para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-estilo">
                      <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Tipo</th>
                      <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Archivo</th>
                      <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Estado</th>
                      <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Filas</th>
                      <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Fecha</th>
                      <th className="text-right py-2 px-3 text-etiqueta text-secundario font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((imp) => {
                      const tipoInfo = TIPOS.find(t => t.id === imp.tipo_importacion)
                      const Icono = tipoInfo?.icono || FileText
                      const resumen = imp.resumen_jsonb || {}
                      return (
                        <tr key={imp.id} className="border-b border-estilo hover:bg-fondo">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <Icono className="h-4 w-4 text-secundario" />
                              <span className="text-principal">{tipoInfo?.etiqueta || imp.tipo_importacion}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-principal text-xs max-w-[200px] truncate">
                            {imp.nombre_archivo_original || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COLORES_ESTADO[imp.estado] || 'bg-fondo text-secundario'}`}>
                              {ETIQUETAS_ESTADO[imp.estado] || imp.estado}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-principal text-xs">
                            {resumen.total ? `${resumen.validos || 0}/${resumen.total}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-secundario text-xs">
                            {formatearFecha(imp.created_at)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {imp.estado === 'completada_con_errores' && (
                              <Boton
                                variante="texto"
                                tamano="pequeno"
                                onClick={() => handleDownloadErrors(imp.id)}
                              >
                                Errores
                              </Boton>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  )
}
