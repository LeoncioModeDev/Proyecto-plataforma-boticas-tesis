import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Boxes,
  CalendarClock,
  ArrowLeftRight,
  ClipboardList,
  FileBarChart,
  BarChart3,
  Truck,
  Users,
  BrainCircuit,
  Bell,
  Lightbulb,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Building2,
  Activity,
  UserPlus,
  DollarSign,
  History,
  Tags,
} from "lucide-react";
import { cn } from "@/utilities/cn";
import useAutenticacion from "@/state/useAutenticacion";
import useBarraLateral from "@/state/useBarraLateral";
import { ROLES, ETIQUETAS_ROLES } from "@/constants/roles";
import { obtenerPortal } from "@/utilities/permisos";

const itemsAdminCentral = [
    {
      etiqueta: "Dashboard",
      ruta: "/central/dashboard",
      icono: LayoutDashboard,
    },
    {
      tipo: "modulo",
      etiqueta: "Inventario",
      icono: Package,
      ruta: "/central/inventario",
      subItems: [
        { etiqueta: "Productos", ruta: "/central/inventario/catalogo", icono: Package },
        { etiqueta: "Categorías terapéuticas", ruta: "/central/inventario/categorias-terapeuticas", icono: Tags },
        { etiqueta: "Stock actual", ruta: "/central/inventario/stock", icono: Boxes },
        { etiqueta: "Lotes", ruta: "/central/inventario/lotes", icono: CalendarClock },
        { etiqueta: "Movimientos", ruta: "/central/inventario/movimientos", icono: ArrowLeftRight },
        { etiqueta: "Ajustes", ruta: "/central/inventario/ajustes", icono: ClipboardList },
        { etiqueta: "Reportes", ruta: "/central/inventario/reportes", icono: FileBarChart },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Distribución",
      icono: Truck,
      ruta: "/central/distribucion/transferencias",
      subItems: [
        {
          etiqueta: "Transferencias",
          ruta: "/central/distribucion/transferencias",
          icono: ArrowLeftRight,
        },
        {
          etiqueta: "Redistribución",
          ruta: "/central/distribucion/redistribucion",
          icono: Truck,
        },
        {
          etiqueta: "Historial de Distribución",
          ruta: "/central/distribucion/historial",
          icono: FileBarChart,
        },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Proveedores",
      icono: Users,
      ruta: "/central/proveedores",
      subItems: [
        {
          etiqueta: "Proveedores",
          ruta: "/central/proveedores",
          icono: Users,
        },
        {
          etiqueta: "Órdenes de Compra",
          ruta: "/central/proveedores/ordenes",
          icono: ClipboardList,
        },
        {
          etiqueta: "Historial de Órdenes",
          ruta: "/central/proveedores/ordenes/historial",
          icono: FileBarChart,
        },
        {
          etiqueta: "Recepciones",
          ruta: "/central/proveedores/recepciones",
          icono: Package,
        },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Administración",
      icono: Settings,
      ruta: "/central/administracion/usuarios",
      subItems: [
        {
          etiqueta: "Usuarios",
          ruta: "/central/administracion/usuarios",
          icono: Users,
        },
        {
          etiqueta: "Boticas",
          ruta: "/central/administracion/boticas",
          icono: Building2,
        },
        {
          etiqueta: "Importar Datos",
          ruta: "/central/administracion/importacion-datos",
          icono: FileBarChart,
        },
        {
          etiqueta: "Precios importados",
          ruta: "/central/inventario/precios",
          icono: DollarSign,
        },
        {
          etiqueta: "Stock histórico importados",
          ruta: "/central/inventario/stock-historico",
          icono: History,
        },
        {
          etiqueta: "Ventas históricas",
          ruta: "/central/administracion/ventas-historicas",
          icono: BarChart3,
        },
        {
          etiqueta: "Auditoría",
          ruta: "/central/administracion/auditoria",
          icono: ClipboardList,
        },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Machine Learning",
      icono: BrainCircuit,
      ruta: "/ml/predicciones",
      subItems: [
        {
          etiqueta: "Predicciones",
          ruta: "/ml/predicciones",
          icono: BrainCircuit,
        },
        { etiqueta: "Alertas ML", ruta: "/ml/alertas", icono: Bell },
        {
          etiqueta: "Recomendaciones",
          ruta: "/ml/recomendaciones",
          icono: Lightbulb,
        },
        { etiqueta: "Monitoreo", ruta: "/ml/monitoreo", icono: Activity },
      ],
    },
]

const itemsNavegacion = {
  [ROLES.ADMIN_CENTRAL]: itemsAdminCentral,
  [ROLES.SUPER_ADMIN]: [
    { etiqueta: "Dashboard", ruta: "/admin-saas/dashboard", icono: LayoutDashboard },
    {
      tipo: "modulo",
      etiqueta: "Organizaciones",
      icono: Building2,
      ruta: "/admin-saas/organizaciones",
      subItems: [
        {
          etiqueta: "Lista",
          ruta: "/admin-saas/organizaciones",
          icono: Building2,
        },
        {
          etiqueta: "Crear Organización",
          ruta: "/admin-saas/organizaciones/crear",
          icono: UserPlus,
        },
      ],
    },
  ],
  [ROLES.OPERADOR_DROGUERIA]: [
    {
      etiqueta: "Dashboard",
      ruta: "/operaciones/dashboard",
      icono: LayoutDashboard,
    },
    {
      tipo: "modulo",
      etiqueta: "Inventario",
      icono: Package,
      ruta: "/operaciones/inventario/catalogo",
      subItems: [
        { etiqueta: "Productos", ruta: "/operaciones/inventario/catalogo", icono: Package },
        { etiqueta: "Stock actual", ruta: "/operaciones/inventario/stock", icono: Boxes },
        { etiqueta: "Lotes", ruta: "/operaciones/inventario/lotes", icono: CalendarClock },
        { etiqueta: "Movimientos", ruta: "/operaciones/inventario/movimientos", icono: ArrowLeftRight },
        { etiqueta: "Ajustes", ruta: "/operaciones/inventario/ajustes", icono: ClipboardList },
        { etiqueta: "Reportes", ruta: "/operaciones/inventario/reportes", icono: FileBarChart },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Distribución",
      icono: Truck,
      ruta: "/operaciones/distribucion/transferencias",
      subItems: [
        {
          etiqueta: "Transferencias",
          ruta: "/operaciones/distribucion/transferencias",
          icono: ArrowLeftRight,
        },
        {
          etiqueta: "Redistribución",
          ruta: "/operaciones/distribucion/redistribucion",
          icono: Truck,
        },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Proveedores",
      icono: Users,
      ruta: "/operaciones/proveedores",
      subItems: [
        {
          etiqueta: "Proveedores",
          ruta: "/operaciones/proveedores",
          icono: Users,
        },
        {
          etiqueta: "Órdenes de Compra",
          ruta: "/operaciones/ordenes-compra",
          icono: ClipboardList,
        },
        {
          etiqueta: "Recepciones",
          ruta: "/operaciones/recepciones",
          icono: Package,
        },
      ],
    },
    {
      tipo: "modulo",
      etiqueta: "Administración",
      icono: Settings,
      ruta: "/operaciones/administracion/ventas-historicas",
      subItems: [
        {
          etiqueta: "Precios importados",
          ruta: "/operaciones/inventario/precios",
          icono: DollarSign,
        },
        {
          etiqueta: "Stock histórico importados",
          ruta: "/operaciones/inventario/stock-historico",
          icono: History,
        },
        {
          etiqueta: "Ventas históricas",
          ruta: "/operaciones/administracion/ventas-historicas",
          icono: BarChart3,
        },
      ],
    },
    { etiqueta: "Alertas", ruta: "/operaciones/alertas", icono: Bell },
  ],
  [ROLES.VISOR_BOTICA]: [
    {
      etiqueta: "Dashboard",
      ruta: "/botica/dashboard",
      icono: LayoutDashboard,
    },
    { etiqueta: "Stock actual", ruta: "/botica/stock", icono: Boxes },
    { etiqueta: "Lotes", ruta: "/botica/lotes", icono: CalendarClock },
    {
      etiqueta: "Movimientos",
      ruta: "/botica/movimientos",
      icono: ArrowLeftRight,
    },
    {
      etiqueta: "Transferencias",
      ruta: "/botica/transferencias",
      icono: Truck,
    },
  ],
};

function ItemModulo({ item, colapsada }) {
  const tieneSubActivo = item.subItems?.some((sub) =>
    location.pathname.startsWith(sub.ruta),
  );
  const [expandido, setExpandido] = useState(() => tieneSubActivo);
  const estaActivo = location.pathname.startsWith(item.ruta);

  if (colapsada) {
    return (
      <NavLink
        to={item.ruta}
        className={() =>
          cn(
            "flex items-center justify-center p-2 rounded-md transition-all mb-0.5",
            tieneSubActivo || estaActivo
              ? "bg-marca-claro text-marca-principal font-medium"
              : "text-secundario hover:text-principal hover:bg-fondo",
          )
        }
        title={item.etiqueta}
      >
        <item.icono className="h-[18px] w-[18px]" />
      </NavLink>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpandido(!expandido)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-cuerpo transition-all",
          tieneSubActivo || estaActivo
            ? "bg-marca-claro text-marca-principal font-medium border-l-[3px] border-marca-principal"
            : "text-secundario hover:text-principal hover:bg-fondo",
        )}
      >
        <item.icono className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left truncate">{item.etiqueta}</span>
        {expandido ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
      </button>
      {expandido && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-estilo pl-3">
          {item.subItems.map((sub) => {
            const hayHermanoActivo = item.subItems.some(otro =>
              otro.ruta !== sub.ruta && location.pathname.startsWith(otro.ruta)
            )
            return (
              <NavLink
                key={sub.ruta}
                to={sub.ruta}
                end={hayHermanoActivo}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all",
                    isActive
                      ? "bg-marca-claro text-marca-principal font-medium"
                      : "text-secundario hover:text-principal hover:bg-fondo",
                  )
                }
              >
                <sub.icono className="h-4 w-4 shrink-0" />
                <span className="truncate">{sub.etiqueta}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  );
}

export default function BarraLateral() {
  const { usuario, cerrarSesion } = useAutenticacion();
  const { colapsada, setColapsada } = useBarraLateral();
  const navegar = useNavigate();

  if (!usuario) return null;

  const items = itemsNavegacion[usuario.rol] || [];
  const portal = obtenerPortal(usuario);
  const NOMBRES_PORTAL = {
    central: "Portal Central",
    operaciones: "Portal Operaciones",
    botica: "Portal Botica",
  };
  const nombrePortal = usuario.rol === ROLES.SUPER_ADMIN ? "Admin SaaS" : (NOMBRES_PORTAL[portal] || "Botica ML");

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navegar("/iniciar-sesion");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-fondo-secundario border-r border-estilo flex flex-col z-40 transition-all duration-200",
        colapsada ? "w-16" : "w-60",
      )}
    >
      <div className="flex items-center gap-3 px-4 h-14 border-b border-estilo shrink-0">
        <div className="w-8 h-8 bg-marca-principal rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">B</span>
        </div>
        {!colapsada && (
          <span className="font-semibold text-principal text-cuerpo truncate">
            {nombrePortal}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {items.map((item, i) => {
          if (item.tipo === "separador") {
            return !colapsada ? (
              <p
                key={i}
                className="px-3 pt-3 pb-1.5 text-etiqueta text-secundario uppercase tracking-wider font-semibold text-[11px]"
              >
                {item.etiqueta}
              </p>
            ) : (
              <div key={i} className="my-2 border-t border-estilo mx-2" />
            );
          }

          if (item.tipo === "modulo") {
            return (
              <ItemModulo key={item.ruta} item={item} colapsada={colapsada} />
            );
          }

          const Icono = item.icono;
          return (
            <NavLink
              key={item.ruta}
              to={item.ruta}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-cuerpo transition-all mb-0.5",
                  isActive
                    ? "bg-marca-claro text-marca-principal font-medium border-l-[3px] border-marca-principal"
                    : "text-secundario hover:text-principal hover:bg-fondo",
                )
              }
              title={colapsada ? item.etiqueta : undefined}
            >
              <Icono className="h-[18px] w-[18px] shrink-0" />
              {!colapsada && <span className="truncate">{item.etiqueta}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-estilo p-3">
        {!colapsada && (
          <div className="mb-2 px-1">
            <p className="text-cuerpo font-medium text-principal truncate">
              {usuario.nombre}
            </p>
            <p className="text-etiqueta text-secundario">
              {ETIQUETAS_ROLES[usuario.rol]}
            </p>
          </div>
        )}
        <button
          onClick={manejarCerrarSesion}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-cuerpo text-secundario hover:bg-fondo transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!colapsada && <span className="truncate">Cerrar sesión</span>}
        </button>
      </div>

      <button
        onClick={() => setColapsada(!colapsada)}
        className="absolute -right-3 top-14 w-6 h-6 bg-fondo-secundario border border-estilo rounded-full flex items-center justify-center shadow-md hover:bg-fondo z-50 transition-colors"
      >
        {colapsada ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
