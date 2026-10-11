import PanelRedistribucion from '@/components/distribution/PanelRedistribucion'

export default function PaginaRedistribucion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Redistribución de Stock</h1>
        <p className="text-secundario mt-1">Optimización de inventario entre boticas — propuestas automáticas basadas en sobrestock y déficit</p>
      </div>
      <PanelRedistribucion />
    </div>
  )
}
