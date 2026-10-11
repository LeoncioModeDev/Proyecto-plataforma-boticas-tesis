import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, AlertTriangle, XCircle, ClipboardList, Truck, Lock, Unlock } from "lucide-react";
import TarjetaMetrica from "@/components/charts/TarjetaMetrica";
import Tabla from "@/components/common/Tabla";
import CampoBusqueda from "@/components/common/CampoBusqueda";
import BarraFiltros from "@/components/common/BarraFiltros";
import SelectFiltro from "@/components/common/SelectFiltro";
import SelectBusquedaFiltro from "@/components/common/SelectBusquedaFiltro";

import Insignia from "@/components/common/Insignia";
import { obtenerStockPorUbicacion } from "@/services/supabase/stock";
import {
  clasificarAlerta,
  COLORES_ESTADO_STOCK,
  ETIQUETAS_ESTADO_STOCK,
} from "@/utilities/clasificarAlerta";
import { formatearFechaRelativa } from "@/utilities/formatearFecha";
import { formatearNumero } from "@/utilities/formatearMoneda";

export default function PaginaStock() {
  const navegar = useNavigate();
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroUbicacion, setFiltroUbicacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    setCargando(true);
    obtenerStockPorUbicacion()
      .then(data => {
        setDatos(data.map(s => ({ ...s, estadoAlerta: clasificarAlerta(s) })));
        setCargando(false);
      })
      .catch(err => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  const ubicacionesUnicas = [...new Map(datos.map(s => [s.ubicacionId || 'drogueria', { valor: s.ubicacionId || 'drogueria', etiqueta: s.nombreUbicacion }])).values()];
  const productosUnicos = [...new Map(datos.map(s => [s.productoId, { valor: s.productoId, etiqueta: s.nombreProducto }])).values()];

  let filtrados = [...datos];
  if (busqueda.trim()) {
    const termino = busqueda.trim().toLowerCase();
    filtrados = filtrados.filter((s) => [s.codigoProducto, s.nombreProducto, s.nombreUbicacion].some(valor => (valor || '').toLowerCase().includes(termino)));
  }
  if (filtroProducto) filtrados = filtrados.filter((s) => s.productoId === filtroProducto);
  if (filtroUbicacion)
    filtrados = filtrados.filter((s) => (s.ubicacionId || 'drogueria') === filtroUbicacion);
  if (filtroEstado)
    filtrados = filtrados.filter((s) => s.estadoAlerta === filtroEstado);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroProducto("");
    setFiltroUbicacion("");
    setFiltroEstado("");
  };

  const totalStockFisico = filtrados.reduce((a, s) => a + s.stockFisico, 0);
  const totalDisponible = filtrados.reduce((a, s) => a + s.stockDisponible, 0);
  const totalComprometido = filtrados.reduce((a, s) => a + (s.stockComprometido || 0), 0);
  const totalPorRecibir = filtrados.reduce((a, s) => a + (s.stockPorRecibir || 0), 0);
  const totalEnTransito = filtrados.reduce((a, s) => a + (s.stockEnTransito || 0), 0);
  const bajoStock = filtrados.filter((s) => s.estadoAlerta === "bajo").length;
  const sinStock = filtrados.filter(
    (s) => s.estadoAlerta === "sin_stock",
  ).length;
  const sobrestock = filtrados.filter(
    (s) => s.estadoAlerta === "sobrestock",
  ).length;

  const columnas = [
    { campo: "codigoProducto", encabezado: "Código", render: (r) => <span className="font-mono text-xs text-secundario">{r.codigoProducto || '-'}</span> },
    { campo: "nombreProducto", encabezado: "Producto" },
    { campo: "nombreUbicacion", encabezado: "Ubicación" },
    {
      campo: "stockFisico",
      encabezado: "Stock Físico",
    },
    {
      campo: "stockComprometido",
      encabezado: "Stock Comprometido",
      render: (r) => <span className={r.stockComprometido > 0 ? "text-estado-advertencia font-medium" : "text-secundario"}>{r.stockComprometido ?? 0}</span>,
    },
    {
      campo: "stockDisponible",
      encabezado: "Stock Disponible",
      render: (r) => (
        <span className="flex items-center gap-2">
          <span
            className={
              r.stockDisponible === 0
                ? "text-estado-critico font-semibold"
                : r.stockDisponible < r.stockMinimo
                  ? "text-estado-advertencia font-semibold"
                  : ""
            }
          >
            {r.stockDisponible}
          </span>
          {r.stockDisponible === 0 && (
            <XCircle className="h-4 w-4 text-estado-critico" />
          )}
          {r.stockDisponible > 0 && r.stockDisponible < r.stockMinimo && (
            <AlertTriangle className="h-4 w-4 text-estado-advertencia" />
          )}
        </span>
      ),
    },
    {
      campo: "stockPorRecibir",
      encabezado: "Stock por Recibir",
      render: (r) => (
        <span className={r.stockPorRecibir > 0 ? "text-marca-principal font-medium" : "text-secundario"}>{r.stockPorRecibir ?? 0}</span>
      ),
    },
    {
      campo: "stockEnTransito",
      encabezado: "Stock en Tránsito",
      render: (r) => (
        <span className={r.stockEnTransito > 0 ? "text-marca-principal font-medium" : "text-secundario"}>{r.stockEnTransito ?? 0}</span>
      ),
    },
    { campo: "stockMinimo", encabezado: "Stock Mínimo" },
    { campo: "stockMaximo", encabezado: "Stock Máximo", render: (r) => <span>{r.stockMaximo ?? '-'}</span> },
    {
      campo: "estadoAlerta",
      encabezado: "Estado",
      render: (r) => (
        <Insignia color={COLORES_ESTADO_STOCK[r.estadoAlerta]}>
          {ETIQUETAS_ESTADO_STOCK[r.estadoAlerta]}
        </Insignia>
      ),
    },
    {
      campo: "ultimaActualizacion",
      encabezado: "Últ. Actualización",
      render: (r) => (
        <span className="text-etiqueta text-secundario">
          {formatearFechaRelativa(r.ultimaActualizacion)}
        </span>
      ),
    },
  ];

  if (cargando) return <div className="flex items-center justify-center py-20"><p className="text-secundario">Cargando stock...</p></div>;
  if (error) return <div className="flex items-center justify-center h-64"><p className="text-estado-critico">Error: {error}</p></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Stock</h1>
        <p className="text-secundario mt-1">
          Inventario consolidado de toda la red de boticas
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica etiqueta="Stock Físico" valor={formatearNumero(totalStockFisico)} icono={Boxes} />
        <TarjetaMetrica etiqueta="Stock Disponible" valor={formatearNumero(totalDisponible)} icono={Unlock} />
        <TarjetaMetrica etiqueta="Stock Comprometido" valor={formatearNumero(totalComprometido)} icono={Lock} />
        <TarjetaMetrica etiqueta="Por Recibir" valor={formatearNumero(totalPorRecibir)} icono={ClipboardList} />
        <TarjetaMetrica etiqueta="En Tránsito" valor={formatearNumero(totalEnTransito)} icono={Truck} />
        <TarjetaMetrica etiqueta="Bajo Stock" valor={bajoStock} icono={AlertTriangle} />
        <TarjetaMetrica etiqueta="Sin Stock" valor={sinStock} icono={XCircle} />
        <TarjetaMetrica etiqueta="Sobrestock" valor={sobrestock} icono={Boxes} />
      </div>
      <BarraFiltros alLimpiar={limpiarFiltros}>
        <CampoBusqueda valor={busqueda} alCambiar={setBusqueda} placeholder="Buscar stock..." className="w-full sm:w-72" />
        <SelectBusquedaFiltro valor={filtroProducto} alCambiar={setFiltroProducto} opciones={productosUnicos} placeholder="Producto" />
        <SelectFiltro valor={filtroUbicacion} alCambiar={setFiltroUbicacion} opciones={ubicacionesUnicas} placeholder="Todas las ubicaciones" />
        <SelectFiltro valor={filtroEstado} alCambiar={setFiltroEstado} opciones={[{ valor: 'normal', etiqueta: 'Normal' }, { valor: 'bajo', etiqueta: 'Bajo Stock' }, { valor: 'sin_stock', etiqueta: 'Sin Stock' }, { valor: 'sobrestock', etiqueta: 'Sobrestock' }]} placeholder="Todos los estados" />
      </BarraFiltros>
      <Tabla columnas={columnas} datos={filtrados} busqueda={false} alClickFila={(r) => navegar(`/operaciones/inventario/stock/${r.id}`)} />
    </div>
  );
}
