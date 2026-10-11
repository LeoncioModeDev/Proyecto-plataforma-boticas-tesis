import { supabase } from "./cliente";

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-cliente`
  : null;

export async function crearOrganizacion(datos) {
  if (!EDGE_FUNCTION_URL) {
    return { error: "VITE_SUPABASE_URL no está configurado" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return { error: "No hay sesión activa. Inicia sesión nuevamente." };
  }

  try {
    const respuesta = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(datos),
    });

    const datosRespuesta = await respuesta.json();

    if (!respuesta.ok) {
      return {
        error:
          datosRespuesta.error || `Error del servidor (${respuesta.status})`,
      };
    }

    return { datos: datosRespuesta, error: null };
  } catch (err) {
    return { error: err.message || "Error de conexión con el servidor" };
  }
}
