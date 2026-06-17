import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import GraficaBarras from '@/components/charts/GraficaBarras'
import { obtenerMovimientos } from '@/services/supabase/movimientos'
import { ETIQUETAS_MOVIMIENTO } from '@/constants/tiposMovimiento'
import { exportarCSV, exportarExcel, exportarPDF } from '@/utilities/exportarArchivo'

export default function ReporteMovimientos() {
  const [movimientos, setMovimientos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    obtenerMovimientos()
      .then(setMovimientos)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const resumen = {}
  movimientos.forEach(m => { resumen[m.tipo] = (resumen[m.tipo] || 0) + 1 })
  const datosGrafica = Object.entries(resumen).map(([tipo, total]) => ({ nombre: ETIQUETAS_MOVIMIENTO[tipo] || tipo, total }))

  function handleExportar(tipo) {
    const filas = datosGrafica.map(d => ({ Tipo: d.nombre, Total: d.total }))
    filas.push({ Tipo: 'Total', Total: movimientos.length })
    if (tipo === 'csv') exportarCSV(filas, 'movimientos')
    else if (tipo === 'xlsx') exportarExcel(filas, 'movimientos')
    else exportarPDF('Reporte de Movimientos', [{ acceso: 'Tipo', etiqueta: 'Tipo' }, { acceso: 'Total', etiqueta: 'Total' }], filas, 'movimientos')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-h1 text-principal">Reporte de Movimientos</h1>
        <div className="flex gap-2">
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('csv')}>CSV</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('xlsx')}>Excel</Boton>
          <Boton variante="secundario" icono={Download} onClick={() => handleExportar('pdf')}>PDF</Boton>
        </div>
      </div>
      {cargando ? (
        <p className="text-secundario text-sm text-center py-8">Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Tarjeta titulo="Movimientos por Tipo"><GraficaBarras datos={datosGrafica} barras={[{ clave: 'total', etiqueta: 'Total' }]} altura={280} /></Tarjeta>
          <Tarjeta titulo="Resumen">
            <div className="space-y-3">
              {datosGrafica.map(d => (
                <div key={d.nombre} className="flex items-center justify-between py-2 border-b border-estilo last:border-0">
                  <span className="text-cuerpo">{d.nombre}</span>
                  <span className="text-h3 text-marca-principal">{d.total}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 border-t-2 border-principal">
                <span className="text-cuerpo font-semibold">Total</span>
                <span className="text-h3 text-principal">{movimientos.length}</span>
              </div>
            </div>
          </Tarjeta>
        </div>
      )}
    </div>
  )
}
