import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

export function exportarCSV(filas, nombreArchivo = 'reporte') {
  if (filas.length === 0) return
  const cabeceras = Object.keys(filas[0])
  const lineas = [
    cabeceras.join(','),
    ...filas.map(f => cabeceras.map(c => {
      const val = f[c]
      if (val == null) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')),
  ]
  const bom = '\uFEFF'
  const blob = new Blob([bom + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' })
  descargar(blob, `${nombreArchivo}.csv`)
}

export function exportarExcel(filas, nombreArchivo = 'reporte', nombreHoja = 'Reporte') {
  if (filas.length === 0) return
  const libro = XLSX.utils.book_new()
  const hoja = XLSX.utils.json_to_sheet(filas)
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja)
  const buffer = XLSX.write(libro, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  descargar(blob, `${nombreArchivo}.xlsx`)
}

export function exportarPDF(titulo, columnas, filas, nombreArchivo = 'reporte') {
  if (filas.length === 0) return
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(titulo, 14, 20)
  doc.setFontSize(10)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-PE')}`, 14, 28)

  const cuerpo = filas.map(f => columnas.map(c => f[c.acceso] ?? ''))
  autoTable(doc, {
    startY: 34,
    head: [columnas.map(c => c.etiqueta)],
    body: cuerpo,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] },
  })

  descargar(doc.output('blob'), `${nombreArchivo}.pdf`)
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
