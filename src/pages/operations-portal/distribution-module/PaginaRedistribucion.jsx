import { useState } from 'react'
import { Truck, ArrowRight } from 'lucide-react'
import Boton from '@/components/common/Boton'
import Tarjeta from '@/components/common/Tarjeta'
import Insignia from '@/components/common/Insignia'
import { stock } from '@/mock-data/stock'
import { productos } from '@/mock-data/productos'
import { boticas } from '@/mock-data/boticas'
import { clasificarAlerta } from '@/utilities/clasificarAlerta'

export default function PaginaRedistribucion() {
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')

  const boticasOptions = boticas.map(b => ({ valor: b.id, etiqueta: b.nombre }))

  const productosRedistribuir = stock.filter(s => clasificarAlerta(s) === 'sobrestock').map(s => {
    const producto = productos.find(p => p.id === s.productoId)
    return {
      ...s,
      nombreProducto: producto?.nombreComercial || s.productoId,
      ubicacion: boticas.find(b => b.id === s.ubicacionId)?.nombre || s.ubicacionId,
      excedente: s.cantidadDisponible - s.stockMinimo,
    }
  })

  const boticasConBajoStock = boticas.map(b => {
    const stockB = stock.filter(s => s.ubicacionId === b.id)
    const bajoStock = stockB.filter(s => clasificarAlerta(s) === 'bajo' || clasificarAlerta(s) === 'sin_stock')
    return { ...b, productosFaltantes: bajoStock.length }
  }).filter(b => b.productosFaltantes > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Redistribución de Stock</h1>
        <p className="text-secundario mt-1">Optimización de inventario entre boticas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tarjeta titulo="Productos con Excedente (Sobrestock)" descripcion="Disponibles para redistribuir">
          <div className="space-y-3">
            {productosRedistribuir.length === 0 ? (
              <p className="text-secundario">No hay productos con excedente</p>
            ) : (
              productosRedistribuir.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-fondo rounded-md">
                  <div>
                    <p className="text-cuerpo font-medium text-principal">{p.nombreProducto}</p>
                    <p className="text-etiqueta text-secundario">{p.ubicacion}</p>
                  </div>
                  <span className="text-marca-principal font-semibold">+{p.excedente} uds</span>
                </div>
              ))
            )}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Boticas con Déficit" descripcion="Requieren reposición de stock">
          <div className="space-y-3">
            {boticasConBajoStock.length === 0 ? (
              <p className="text-secundario">Ninguna botica presenta déficit</p>
            ) : (
              boticasConBajoStock.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-fondo rounded-md">
                  <div>
                    <p className="text-cuerpo font-medium text-principal">{b.nombre}</p>
                    <p className="text-etiqueta text-secundario">{b.productosFaltantes} productos críticos</p>
                  </div>
                  <Insignia color="rojo">{b.productosFaltantes} faltantes</Insignia>
                </div>
              ))
            )}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Simulador de Redistribución" descripcion="Selecciona origen y destino para redistribuir stock">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Origen</label>
            <select value={origen} onChange={e => setOrigen(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              <option value="">Seleccionar origen</option>
              {boticasOptions.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-6 w-6 text-secundario" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-principal">Destino</label>
            <select value={destino} onChange={e => setDestino(e.target.value)} className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md">
              <option value="">Seleccionar destino</option>
              {boticasOptions.map(o => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Boton variante="primario" icono={Truck} disabled={!origen || !destino}>Generar propuesta de redistribución</Boton>
        </div>
      </Tarjeta>
    </div>
  )
}
