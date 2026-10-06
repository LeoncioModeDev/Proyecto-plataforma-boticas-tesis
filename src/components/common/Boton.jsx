import { cn } from "@/utilities/cn";
import { Loader2 } from "lucide-react";

const estilosVariante = {
  primario:
    "bg-marca-principal !text-white hover:bg-marca-oscuro focus-visible:ring-marca-principal",
  secundario:
    "bg-fondo-secundario text-principal border border-estilo hover:bg-fondo",
  peligro:
    "bg-estado-critico !text-white hover:bg-red-700 focus-visible:ring-estado-critico",
  texto: "bg-transparent text-marca-principal hover:underline",
  icono: "bg-transparent text-secundario hover:bg-fondo p-2",
};

const estilosTamano = {
  pequeno: "px-3 py-1.5 text-etiqueta",
  mediano: "px-4 py-2 text-cuerpo",
  grande: "px-6 py-2.5 text-cuerpo font-semibold",
};

export default function Boton({
  variante = "primario",
  tamano = "mediano",
  icono: Icono = null,
  cargando = false,
  deshabilitado = false,
  onClick,
  tipo = "button",
  children,
  className,
  ...props
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={deshabilitado || cargando}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 min-w-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        estilosVariante[variante],
        estilosTamano[tamano],
        className,
      )}
      {...props}
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icono ? (
        <Icono className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
}
