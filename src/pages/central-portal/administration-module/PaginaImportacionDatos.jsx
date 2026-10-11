import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, FileText, Download, CheckCircle2,
  Building2, Package, Truck, Users,
  Handshake, PackageOpen, BarChart3, Eye, Tags, DollarSign, History,
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
  { id: 'categorias_terapeuticas', etiqueta: '1. Categorías terapéuticas', descripcion: 'Base requerida para productos', icono: Tags },
  { id: 'boticas', etiqueta: '2. Boticas', descripcion: 'Requeridas para stock, precios y ventas', icono: Building2 },
  { id: 'productos', etiqueta: '3. Productos', descripcion: 'Requieren categorías terapéuticas', icono: Package },
  { id: 'proveedores', etiqueta: '4. Proveedores', descripcion: 'Requeridos para relaciones proveedor-producto', icono: Truck },
  { id: 'proveedor_producto', etiqueta: '5. Proveedor-Producto', descripcion: 'Requiere proveedores y productos', icono: Handshake },
  { id: 'precios', etiqueta: '6. Precios', descripcion: 'Requiere productos y boticas', icono: DollarSign },
  { id: 'stock_inicial', etiqueta: '7. Stock Inicial', descripcion: 'Requiere productos, boticas y lotes', icono: PackageOpen },
  { id: 'stock_historico', etiqueta: '8. Stock Histórico', descripcion: 'Snapshots semanales oficiales para ML', icono: History },
  { id: 'ventas_historicas', etiqueta: '9. Ventas Históricas', descripcion: 'Requiere productos y boticas', icono: BarChart3 },

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

const TIPOS_HISTORICOS = new Set(['stock_historico', 'ventas_historicas'])

function extraerNumeroTramo(nombre) {
  const match = nombre.match(/_(\d+)\.csv$/i)
  return match ? parseInt(match[1], 10) : 0
}

export default function PaginaImportacionDatos() {
  const usuario = useAutenticacion(s => s.usuario)
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [archivosMultiples, setArchivosMultiples] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [importacionId, setImportacionId] = useState(null)
  const [validando, setValidando] = useState(false)
  const [validacion, setValidacion] = useState(null)
  const [validacionesMultiples, setValidacionesMultiples] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultadoImportacion, setResultadoImportacion] = useState(null)
  const [historial, setHistorial] = useState([])
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLineas, setPreviewLineas] = useState([])
  const [descargando, setDescargando] = useState(false)

  const [progresoMulti, setProgresoMulti] = useState(null)
  const [importacionSecuencial, setImportacionSecuencial] = useState(false)
  const [resultadosPorArchivo, setResultadosPorArchivo] = useState([])

  const esMulti = archivosMultiples.length > 0
  const tipoHistorico = tipoSeleccionado && TIPOS_HISTORICOS.has(tipoSeleccionado.id)

  const refrescarHistorial = () => {
    listarImportaciones({ limite: 20 })
      .then(data => setHistorial(data.datos || []))
      .catch(console.error)
  }

  useEffect(() => {
    refrescarHistorial()
  }, [])

  const limpiarEstado = () => {
    setArchivo(null)
    setArchivosMultiples([])
    setImportacionId(null)
    setValidacion(null)
    setValidacionesMultiples([])
    setResultadoImportacion(null)
    setError(null)
    setPreviewUrl(null)
    setPreviewLineas([])
    setProgresoMulti(null)
    setImportacionSecuencial(false)
    setResultadosPorArchivo([])
  }

  const handleTipoClick = (tipo) => {
    setTipoSeleccionado(tipo)
    limpiarEstado()
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    limpiarEstado()

    if (tipoHistorico && files.length > 1) {
      files.sort((a, b) => extraerNumeroTramo(a.name) - extraerNumeroTramo(b.name))
      setArchivosMultiples(files)

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(files[0])
      setPreviewUrl(url)

      if (files[0].name.endsWith('.csv')) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const text = ev.target.result
          const lineas = text.split('\n').filter(l => l.trim()).slice(0, 6)
          setPreviewLineas(lineas)
        }
        reader.readAsText(files[0])
      }
      return
    }

    const file = files[0]
    if (!file) return
    setArchivo(file)

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
      setPreviewLineas(['Formato no soportado temporalmente. Use archivos CSV UTF-8.'])
    }
  }

  const handleUploadAndValidate = async () => {
    if (!tipoSeleccionado) return
    setError(null)

    if (esMulti) {
      setSubiendo(true)
      setValidando(true)
      const resultados = []
      for (let i = 0; i < archivosMultiples.length; i++) {
        const arch = archivosMultiples[i]
        try {
          const tempId = crypto.randomUUID()
          const orgId = usuario?.orgId
          if (!orgId) throw new Error('No se pudo determinar la organización')

          const ruta = await subirArchivoStorage(arch, orgId, tempId)
          const resultado = await validarImportacion(
            tipoSeleccionado.id,
            ruta,
            arch.name,
            arch.type || 'text/csv',
            arch.size,
          )
          resultados.push({
            archivo: arch.name,
            exito: true,
            importacion_id: resultado.importacion_id,
            resumen: resultado.resumen,
            errores: resultado.errores || [],
          })
        } catch (e) {
          resultados.push({
            archivo: arch.name,
            exito: false,
            error: e.message,
          })
          break
        }
      }

      setValidacionesMultiples(resultados)
      setSubiendo(false)
      setValidando(false)
      return
    }

    if (!archivo) return
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
    if (!tipoSeleccionado) return
    setError(null)

    if (esMulti && validacionesMultiples.length > 0) {
      setImportacionSecuencial(true)
      setImportando(true)
      const total = validacionesMultiples.length
      let filasTotales = 0
      let filasProcesadas = 0
      const resultadosPorArchivo = []

      for (const v of validacionesMultiples) {
        filasTotales += v.resumen?.total_filas || v.resumen?.total || 0
      }

      for (let i = 0; i < total; i++) {
        const v = validacionesMultiples[i]
        if (!v.exito) {
          setError(`Error en ${v.archivo}: ${v.error}`)
          setImportacionSecuencial(false)
          setImportando(false)
          return
        }

        const filasArchivo = v.resumen?.filas_validas || v.resumen?.validos || 0
        setProgresoMulti({
          archivoActual: i + 1,
          totalArchivos: total,
          archivoNombre: v.archivo,
          filasProcesadas,
          filasTotales,
          filasArchivo,
          porcentaje: filasTotales > 0 ? Math.round((filasProcesadas / filasTotales) * 100) : 0,
        })

        try {
          const resultado = await ejecutarImportacion(tipoSeleccionado.id, v.importacion_id)
          filasProcesadas += filasArchivo
          resultadosPorArchivo.push({ archivo: v.archivo, resultado })

          if (resultado && resultado.exito === false) {
            setError(`Error crítico en ${v.archivo}: importación fallida`)
            setImportacionSecuencial(false)
            setImportando(false)
            return
          }
        } catch (e) {
          setError(`Error en ${v.archivo}: ${e.message}`)
          setImportacionSecuencial(false)
          setImportando(false)
          return
        }
      }

      setProgresoMulti({
        archivoActual: total,
        totalArchivos: total,
        archivoNombre: validacionesMultiples[total - 1]?.archivo,
        filasProcesadas,
        filasTotales,
        filasArchivo: 0,
        porcentaje: 100,
      })

      setResultadosPorArchivo(resultadosPorArchivo)
      const totalInsertados = resultadosPorArchivo.reduce((s, r) => s + (r.resultado?.insertados || 0), 0)
      const totalActualizados = resultadosPorArchivo.reduce((s, r) => s + (r.resultado?.actualizados || 0), 0)
      setResultadoImportacion({ exito: true, insertados: totalInsertados, actualizados: totalActualizados })
      setImportacionSecuencial(false)
      setImportando(false)
      refrescarHistorial()
      return
    }

    if (!importacionId) return
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

  const hayMultiValidos = validacionesMultiples.some(v => v.exito && (v.resumen?.filas_validas || v.resumen?.validos) > 0)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-h1 text-principal">Importación de Datos</h1>
        <p className="text-cuerpo text-secundario mt-1">
          Importe datos masivos mediante archivos CSV. Use el orden recomendado para resolver relaciones por códigos de negocio.
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

          <Tarjeta titulo="Archivo" descripcion={tipoHistorico ? 'Seleccione uno o varios archivos CSV (tramos) para importar secuencialmente' : 'Seleccione un archivo CSV UTF-8 para importar'}>
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
                {archivo || esMulti ? (
                  <div className="space-y-3">
                    <FileSpreadsheet className="h-10 w-10 text-marca-principal mx-auto" />
                    {esMulti ? (
                      <>
                        <p className="font-medium text-principal">{archivosMultiples.length} archivos seleccionados</p>
                        <div className="max-h-32 overflow-y-auto text-xs text-secundario space-y-1">
                          {archivosMultiples.map((f, i) => (
                            <p key={i}>{f.name} ({formatearTamano(f.size)})</p>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-principal">{archivo.name}</p>
                        <p className="text-etiqueta text-secundario">{formatearTamano(archivo.size)}</p>
                      </>
                    )}
                    <label className="inline-block cursor-pointer">
                      <span className="text-sm text-marca-principal hover:underline">Cambiar archivo(s)</span>
                      <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} multiple={tipoHistorico} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-10 w-10 text-secundario mx-auto mb-3" />
                    <p className="text-principal font-medium">Haga clic para seleccionar archivo(s)</p>
                    <p className="text-etiqueta text-secundario mt-1">
                      CSV UTF-8{tipoHistorico ? ' (puede seleccionar múltiples tramos)' : ' (máx. 50 MB)'}
                    </p>
                    <input type="file" accept=".csv,text/csv" onChange={handleFileSelect} multiple={tipoHistorico} className="hidden" />
                  </label>
                )}
              </div>

              {previewLineas.length > 0 && !esMulti && (
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
                  deshabilitado={(!archivo && !esMulti) || subiendo || validando}
                  cargando={subiendo || validando}
                >
                  {subiendo ? 'Subiendo...' : validando ? 'Validando...' : esMulti ? 'Validar Todos los Archivos' : 'Validar Archivo'}
                </Boton>
              </div>
            </div>
          </Tarjeta>

          {importacionSecuencial && progresoMulti && (
            <Tarjeta titulo="Progreso de Importación Secuencial">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-principal font-medium">
                    Archivo {progresoMulti.archivoActual} de {progresoMulti.totalArchivos}
                  </span>
                  <span className="text-secundario">{progresoMulti.archivoNombre}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secundario">
                    Filas procesadas: {progresoMulti.filasProcesadas.toLocaleString()} de {progresoMulti.filasTotales.toLocaleString()}
                  </span>
                  <span className="text-marca-principal font-medium">{progresoMulti.porcentaje}%</span>
                </div>
                <div className="w-full bg-fondo rounded-full h-2">
                  <div
                    className="bg-marca-principal h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progresoMulti.porcentaje}%` }}
                  />
                </div>
              </div>
            </Tarjeta>
          )}

          {validacionesMultiples.length > 0 && (
            <Tarjeta titulo="Validación de Tramos">
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-estilo">
                        <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Archivo</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Estado</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Filas</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Válidas</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validacionesMultiples.map((v, i) => (
                        <tr key={i} className="border-b border-estilo hover:bg-fondo">
                          <td className="py-2 px-3 text-principal text-xs">{v.archivo}</td>
                          <td className="py-2 px-3 text-center">
                            {v.exito ? (
                              <span className="text-estado-exito text-xs font-medium">OK</span>
                            ) : (
                              <span className="text-estado-critico text-xs font-medium" title={v.error}>Error</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-principal text-xs">
                            {v.resumen?.total_filas || v.resumen?.total || '—'}
                          </td>
                          <td className="py-2 px-3 text-center text-estado-exito text-xs font-medium">
                            {v.resumen?.filas_validas || v.resumen?.validos || 0}
                          </td>
                          <td className="py-2 px-3 text-center text-estado-critico text-xs">
                            {v.resumen?.total_errores ?? v.resumen?.invalidos ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-2">
                  <Boton
                    variante="primario"
                    icono={CheckCircle2}
                    onClick={handleImport}
                    deshabilitado={importando || !hayMultiValidos}
                    cargando={importando}
                  >
                    {importando ? 'Importando...' : 'Importar Todos Secuencialmente'}
                  </Boton>
                </div>
              </div>
            </Tarjeta>
          )}

          {validacion && !esMulti && (
            <Tarjeta titulo="Resultado de Validación">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-fondo rounded-lg text-center">
                    <p className="text-2xl font-bold text-principal">{validacion.resumen?.total_filas || validacion.resumen?.total || 0}</p>
                    <p className="text-xs text-secundario mt-1">Total Filas</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-exito">{validacion.resumen?.filas_validas || validacion.resumen?.validos || 0}</p>
                    <p className="text-xs text-secundario mt-1">Válidas</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-critico">{validacion.resumen?.filas_invalidas || validacion.resumen?.invalidos || 0}</p>
                    <p className="text-xs text-secundario mt-1">Filas inválidas</p>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-estado-advertencia">{validacion.resumen?.total_errores ?? validacion.resumen?.warnings ?? 0}</p>
                    <p className="text-xs text-secundario mt-1">Errores</p>
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

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                  <Boton
                    variante="primario"
                    icono={CheckCircle2}
                    onClick={handleImport}
                    deshabilitado={
                      importando ||
                      !(validacion.resumen?.filas_validas || validacion.resumen?.validos) ||
                      (validacion.resumen?.filas_validas || validacion.resumen?.validos) === 0
                    }
                    cargando={importando}
                  >
                    {importando ? 'Importando...' : 'Importar Datos Válidos'}
                  </Boton>
                </div>

                {resultadoImportacion && (
                  <div className="space-y-3">
                    <Alerta
                      tipo={resultadoImportacion.exito ? 'exito' : 'error'}
                      titulo={
                        resultadoImportacion.exito
                          ? `Importación completada: ${resultadoImportacion.insertados || 0} insertados, ${resultadoImportacion.actualizados || 0} actualizados`
                          : 'Error durante la importación'
                      }
                      mensaje={resultadoImportacion.exito ? 'Datos importados correctamente. Revise las vistas de validación antes de ejecutar el modelo.' : undefined}
                    />
                    {resultadoImportacion.exito && (
                      <div className="flex flex-wrap gap-2">
                        <Link to="/central/administracion/precios" className="px-3 py-2 text-sm rounded-md border border-estilo bg-fondo-secundario text-principal hover:bg-fondo">Ver precios importados</Link>
                        <Link to="/central/administracion/ventas-historicas" className="px-3 py-2 text-sm rounded-md border border-estilo bg-fondo-secundario text-principal hover:bg-fondo">Ver ventas historicas</Link>
                        <Link to="/central/administracion/stock-historico" className="px-3 py-2 text-sm rounded-md border border-estilo bg-fondo-secundario text-principal hover:bg-fondo">Ver stock historico</Link>
                        <Link to="/central/inventario/stock" className="px-3 py-2 text-sm rounded-md border border-estilo bg-fondo-secundario text-principal hover:bg-fondo">Ver stock actual</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Tarjeta>
          )}

          {resultadoImportacion && !esMulti && !validacion && (
            <div className="space-y-3">
              <Alerta
                tipo={resultadoImportacion.exito ? 'exito' : 'error'}
                titulo={
                  resultadoImportacion.exito
                    ? `Importación completada: ${resultadoImportacion.insertados || 0} insertados, ${resultadoImportacion.actualizados || 0} actualizados`
                    : 'Error durante la importación'
                }
              />
            </div>
          )}

          {resultadoImportacion && esMulti && (
            <Tarjeta titulo="Resultado de Importación por Tramos">
              <Alerta
                tipo={resultadoImportacion.exito ? 'exito' : 'error'}
                titulo={
                  resultadoImportacion.exito
                    ? `Importación completada: ${resultadoImportacion.insertados || 0} insertados, ${resultadoImportacion.actualizados || 0} actualizados en ${validacionesMultiples.length} archivos`
                    : 'Error durante la importación'
                }
              />
              {resultadoImportacion.exito && resultadosPorArchivo.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-estilo">
                        <th className="text-left py-2 px-3 text-etiqueta text-secundario font-medium">Archivo</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Insertados</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Actualizados</th>
                        <th className="text-center py-2 px-3 text-etiqueta text-secundario font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosPorArchivo.map((r, i) => (
                        <tr key={i} className="border-b border-estilo hover:bg-fondo">
                          <td className="py-2 px-3 text-principal text-xs">{r.archivo}</td>
                          <td className="py-2 px-3 text-center text-principal text-xs">{r.resultado?.insertados || 0}</td>
                          <td className="py-2 px-3 text-center text-principal text-xs">{r.resultado?.actualizados || 0}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-estado-exito bg-green-50 dark:bg-green-900/20">
                              Completada
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                            {resumen.total_filas ? `${resumen.filas_validas || 0}/${resumen.total_filas}` : resumen.total ? `${resumen.validos || 0}/${resumen.total}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-secundario text-xs">
                            {formatearFecha(imp.created_at)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {['listo_para_importar', 'completada_con_errores', 'fallida'].includes(imp.estado) && (
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
