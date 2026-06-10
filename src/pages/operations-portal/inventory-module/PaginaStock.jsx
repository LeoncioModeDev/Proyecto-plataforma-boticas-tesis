import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, AlertTriangle, XCircle, Edit, Truck } from "lucide-react";
import TarjetaMetrica from "@/components/charts/TarjetaMetrica";
import Tabla from "@/components/common/Tabla";
import Insignia from "@/components/common/Insignia";
import Boton from "@/components/common/Boton";
import Modal from "@/components/common/Modal";
import { stock } from "@/mock-data/stock";
import { productos } from "@/mock-data/productos";
import { boticas } from "@/mock-data/boticas";
import { proveedores as provMock } from "@/mock-data/proveedores";
import { proveedorProducto as ppMock } from "@/mock-data/proveedor-producto";
import {
  clasificarAlerta,
  COLORES_ESTADO_STOCK,
  ETIQUETAS_ESTADO_STOCK,
} from "@/utilities/clasificarAlerta";
import { formatearFechaRelativa } from "@/utilities/formatearFecha";
import { formatearNumero } from "@/utilities/formatearMoneda";

export default function PaginaStock() {
  const navegar = useNavigate();
  const [filtroUbicacion, setFiltroUbicacion] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modalProducto, setModalProducto] = useState(null);
  const [proveedoresProducto, setProveedoresProducto] = useState([]);
  const [nuevoProvProd, setNuevoProvProd] = useState({ proveedorId: "", leadTimeEspecifico: "", precioReferencial: "" });

  const datosEnriquecidos = stock.map((s) => {
    const producto = productos.find((p) => p.id === s.productoId);
    const ubicacion = boticas.find((b) => b.id === s.ubicacionId);
    const estadoAlerta = clasificarAlerta(s);
    return {
      ...s,
      stockDisponible: s.cantidadDisponible,
      ultimaActualizacion: s.updatedAt,
      nombreProducto: producto?.nombreComercial || s.productoId,
      productoId: s.productoId,
      nombreUbicacion: ubicacion?.nombre || s.ubicacionId,
      estadoAlerta,
    };
  });

  let filtrados = [...datosEnriquecidos];
  if (filtroUbicacion)
    filtrados = filtrados.filter((s) => s.ubicacionId === filtroUbicacion);
  if (filtroEstado)
    filtrados = filtrados.filter((s) => s.estadoAlerta === filtroEstado);

  const totalStock = filtrados.reduce((a, s) => a + s.stockDisponible, 0);
  const bajoStock = filtrados.filter((s) => s.estadoAlerta === "bajo").length;
  const sinStock = filtrados.filter(
    (s) => s.estadoAlerta === "sin_stock",
  ).length;
  const sobrestock = filtrados.filter(
    (s) => s.estadoAlerta === "sobrestock",
  ).length;

  const abrirLeadTimes = (productoId, nombreProducto) => {
    const existentes = ppMock.filter((r) => r.productoId === productoId);
    setProveedoresProducto(existentes);
    setModalProducto({ id: productoId, nombre: nombreProducto });
  };

  const agregarProveedorProducto = () => {
    if (!nuevoProvProd.proveedorId || !nuevoProvProd.leadTimeEspecifico || !nuevoProvProd.precioReferencial) return;
    const nuevo = {
      id: crypto.randomUUID(),
      proveedorId: nuevoProvProd.proveedorId,
      productoId: modalProducto.id,
      leadTimeEspecifico: Number(nuevoProvProd.leadTimeEspecifico),
      precioReferencial: Number(nuevoProvProd.precioReferencial),
    };
    setProveedoresProducto([...proveedoresProducto, nuevo]);
    setNuevoProvProd({ proveedorId: "", leadTimeEspecifico: "", precioReferencial: "" });
  };

  const eliminarProveedorProducto = (id) => {
    setProveedoresProducto(proveedoresProducto.filter((r) => r.id !== id));
  };

  const guardarLeadTimes = () => {
    setModalProducto(null);
  };

  const proveedoresDisponibles = provMock.filter((p) => p.activo);

  const columnas = [
    { campo: "id", encabezado: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { campo: "nombreProducto", encabezado: "Producto" },
    { campo: "nombreUbicacion", encabezado: "Ubicación" },
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
    { campo: "stockMinimo", encabezado: "Stock Mínimo" },
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
    {
      campo: "acciones",
      encabezado: "Acciones",
      render: (r) => (
        <div className="flex gap-1">
          <Boton variante="icono" icono={Edit} onClick={() => navegar(`/operaciones/inventario/catalogo/${r.productoId}`)} title="Ver detalle" className="text-marca-principal hover:bg-marca-claro" />
          <Boton variante="icono" icono={Truck} onClick={() => abrirLeadTimes(r.productoId, r.nombreProducto)} title="Configurar Lead Times" className="text-marca-principal hover:bg-marca-claro" />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-principal">Stock</h1>
        <p className="text-secundario mt-1">
          Inventario consolidado de toda la red de boticas
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica
          etiqueta="Stock Total"
          valor={formatearNumero(totalStock)}
          icono={Boxes}
        />
        <TarjetaMetrica
          etiqueta="Bajo Stock"
          valor={bajoStock}
          icono={AlertTriangle}
        />
        <TarjetaMetrica etiqueta="Sin Stock" valor={sinStock} icono={XCircle} />
        <TarjetaMetrica
          etiqueta="Sobrestock"
          valor={sobrestock}
          icono={Boxes}
        />
      </div>
      <div className="flex gap-4">
        <select
          value={filtroUbicacion}
          onChange={(e) => setFiltroUbicacion(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
        >
          <option value="">Todas las ubicaciones</option>
          {boticas.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="px-3 py-2 text-cuerpo bg-fondo border border-estilo rounded-md"
        >
          <option value="">Todos los estados</option>
          <option value="bajo">Bajo Stock</option>
          <option value="sin_stock">Sin Stock</option>
          <option value="sobrestock">Sobrestock</option>
        </select>
      </div>
      <Tabla columnas={columnas} datos={filtrados} />

      <Modal abierto={!!modalProducto} alCerrar={() => setModalProducto(null)} titulo={`Configurar Lead Times — ${modalProducto?.nombre || ""}`}>
        <div className="space-y-4">
          {proveedoresProducto.length === 0 ? (
            <p className="text-secundario">Sin proveedores asociados</p>
          ) : (
            <div className="divide-y divide-estilo max-h-60 overflow-y-auto">
              {proveedoresProducto.map((r) => {
                const prov = provMock.find((p) => p.id === r.proveedorId);
                return (
                  <div key={r.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{prov?.razonSocial || r.proveedorId}</p>
                      <p className="text-xs text-secundario">Lead time: {r.leadTimeEspecifico} días | S/ {r.precioReferencial}</p>
                    </div>
                    <Boton variante="texto" onClick={() => eliminarProveedorProducto(r.id)} className="text-estado-critico text-sm">Eliminar</Boton>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-estilo pt-4 space-y-3">
            <p className="text-sm font-medium">Agregar proveedor</p>
            <select
              value={nuevoProvProd.proveedorId}
              onChange={(e) => setNuevoProvProd({ ...nuevoProvProd, proveedorId: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md"
            >
              <option value="">Seleccionar proveedor...</option>
              {proveedoresDisponibles.map((p) => (
                <option key={p.id} value={p.id}>{p.razonSocial}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-secundario">Lead time (días)</label>
                <input type="number" value={nuevoProvProd.leadTimeEspecifico} onChange={(e) => setNuevoProvProd({ ...nuevoProvProd, leadTimeEspecifico: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
              <div>
                <label className="text-xs text-secundario">Precio referencial (S/)</label>
                <input type="number" step="0.01" value={nuevoProvProd.precioReferencial} onChange={(e) => setNuevoProvProd({ ...nuevoProvProd, precioReferencial: e.target.value })} className="w-full px-3 py-2 text-sm bg-fondo border border-estilo rounded-md" />
              </div>
            </div>
            <Boton variante="secundario" onClick={agregarProveedorProducto} className="w-full">Agregar</Boton>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-estilo">
            <Boton variante="secundario" onClick={() => setModalProducto(null)}>Cancelar</Boton>
            <Boton variante="primario" onClick={guardarLeadTimes}>Guardar configuración</Boton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
