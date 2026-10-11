import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIPOS_IDENTIFICACION = ["ruc", "nit", "tax_id", "vat", "otro"];
const ROLES_ADMIN = ["admin_central", "super_admin"];

interface CrearPayload {
  organizacion: {
    nombre: string;
    tipo_identificacion: string;
    numero_identificacion: string;
    pais_origen?: string;
    dominio_correo: string;
  };
  drogueria: {
    nombre: string;
    ubigeo: string;
    direccion?: string | null;
    telefono?: string | null;
  };
  administrador: {
    nombre: string;
    nombre_cuenta: string;
    contrasena?: string;
  };
}

function normalizarDominio(d: string): string {
  return d
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/\/$/, "")
    .replace(/\/.*$/, "")
    .replace(/\s/g, "")
    .trim();
}

function validarNombreCuenta(n: string): boolean {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(n);
}

function normalizarNombreCuenta(n: string): string {
  const PARTICULAS = new Set(["del", "de", "la", "las", "los", "y", "e", "el", "en", "un", "una"]);
  const partes = n
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const filtradas = partes.filter((p) => !PARTICULAS.has(p));
  const nombre = filtradas[0] || partes[0] || "";
  const apellido = filtradas.length > 1 ? filtradas[filtradas.length - 1] : "";
  return [nombre, apellido].filter(Boolean).join(".").replace(/\.+/g, ".");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Error de configuración del servidor" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    if (!jwt) return json({ error: "Token de autenticación requerido" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Token inválido o expirado" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("usuarios")
      .select("rol, activo")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) return json({ error: "Perfil de usuario no encontrado" }, 403);
    if (!profile.activo) return json({ error: "Usuario desactivado" }, 403);
    if (profile.rol !== "super_admin") return json({ error: "Se requiere rol super_admin" }, 403);

    let body: CrearPayload;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Cuerpo de solicitud inválido" }, 400);
    }

    const { organizacion: org, drogueria: drog, administrador: admin } = body;

    // Validar organización
    if (!org?.nombre?.trim()) return json({ error: "El nombre de la organización es obligatorio" }, 400);
    if (!org?.tipo_identificacion || !TIPOS_IDENTIFICACION.includes(org.tipo_identificacion)) {
      return json({ error: `Tipo de identificación inválido. Debe ser: ${TIPOS_IDENTIFICACION.join(", ")}` }, 400);
    }
    if (!org?.numero_identificacion?.trim()) return json({ error: "El número de identificación es obligatorio" }, 400);

    // Normalizar y validar dominio
    const dominio = normalizarDominio(org.dominio_correo || "");
    if (!dominio) return json({ error: "El dominio institucional es obligatorio" }, 400);
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(dominio)) {
      return json({ error: "El dominio institucional no tiene un formato válido. Ejemplo: boticasleonardo.com" }, 400);
    }

    // Validar droguería
    if (!drog?.nombre?.trim()) return json({ error: "El nombre de la droguería es obligatorio" }, 400);
    if (!drog?.ubigeo?.trim()) return json({ error: "El ubigeo de la droguería es obligatorio" }, 400);

    // Validar administrador
    if (!admin?.nombre?.trim()) return json({ error: "El nombre del administrador es obligatorio" }, 400);
    if (!admin?.nombre_cuenta?.trim()) return json({ error: "El nombre de cuenta del administrador es obligatorio" }, 400);
    if (!admin?.contrasena || admin.contrasena.length < 6) {
      return json({ error: "La contraseña del administrador debe tener al menos 6 caracteres" }, 400);
    }

    const nombreCuenta = admin.nombre_cuenta.trim().toLowerCase();
    if (!validarNombreCuenta(nombreCuenta)) {
      return json({ error: "El nombre de cuenta solo puede contener letras, números, punto, guion o guion bajo" }, 400);
    }

    // Construir email
    const email = `${nombreCuenta}@${dominio}`;

    // Verificar unicidad del dominio
    const { data: dominioExistente } = await supabase
      .from("configuracion_organizacion")
      .select("org_id")
      .eq("dominio_correo_organizacion", dominio)
      .maybeSingle();

    if (dominioExistente) {
      return json({ error: `El dominio ${dominio} ya está registrado por otra organización` }, 409);
    }

    // Verificar unicidad del email
    const { data: emailExistente } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailExistente) {
      return json({ error: `El correo ${email} ya está registrado` }, 409);
    }

    // ============================================================
    // Iniciar creación
    // ============================================================

    let orgCreada: { id: string; nombre: string } | null = null;
    let drogueriaCreada: { id: string; codigo_interno: string | null; nombre: string } | null = null;

    try {
      // 1. Crear organización
      const { data: orgData, error: orgError } = await supabase
        .from("organizaciones")
        .insert({
          nombre: org.nombre.trim(),
          tipo_identificacion: org.tipo_identificacion,
          numero_identificacion: org.numero_identificacion.trim(),
          pais_origen: org.pais_origen || "PE",
        })
        .select("id, nombre")
        .single();

      if (orgError) {
        if (orgError.code === "23505") {
          return json({ error: "Ya existe una organización con ese tipo y número de identificación" }, 409);
        }
        return json({ error: orgError.message }, 400);
      }

      orgCreada = orgData;

      // 2. Guardar dominio en configuracion_organizacion (trigger ya creó el registro)
      const { error: configError } = await supabase
        .from("configuracion_organizacion")
        .update({ dominio_correo_organizacion: dominio })
        .eq("org_id", orgData.id);

      if (configError) {
        console.error("Error al guardar dominio:", configError.message);
      }

      // 3. Crear droguería central
      const { data: drogueria, error: boticaError } = await supabase
        .from("boticas")
        .insert({
          org_id: orgData.id,
          nombre: drog.nombre.trim(),
          tipo: "drogueria",
          ubigeo: drog.ubigeo.trim(),
          direccion: drog.direccion?.trim() || null,
          telefono: drog.telefono?.trim() || null,
        })
        .select("id, codigo_interno, nombre")
        .single();

      if (boticaError) {
        throw new Error(`Error al crear droguería: ${boticaError.message}`);
      }

      drogueriaCreada = drogueria;

      // 4. Crear usuario administrador con contraseña
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email,
        password: admin.contrasena,
        email_confirm: true,
        user_metadata: {
          org_id: orgData.id,
          org_nombre: orgData.nombre,
          nombre: admin.nombre.trim(),
          rol: "admin_central",
          botica_id: drogueria.id,
        },
        app_metadata: {
          rol: "admin_central",
          org_id: orgData.id,
          botica_id: drogueria.id,
        },
      });

      if (userError || !userData?.user?.id) {
        throw new Error(`Error al crear administrador: ${userError?.message || "No se pudo crear el usuario"}`);
      }

      // 5. Crear perfil del administrador
      const { error: upsertError } = await supabase.from("usuarios").upsert(
        {
          id: userData.user.id,
          org_id: orgData.id,
          email,
          nombre: admin.nombre.trim(),
          rol: "admin_central",
          botica_id: drogueria.id,
          activo: true,
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        console.error("Error al crear perfil del admin:", upsertError.message);
      }

      // 6. Auditoría
      await supabase.from("auditoria").insert({
        org_id: orgData.id,
        usuario_id: user.id,
        accion: "CREAR_ORGANIZACION",
        entidad: "organizaciones",
        entidad_id: orgData.id,
        nivel: "info",
        detalle: `Se creó la organización "${orgData.nombre}" con admin "${admin.nombre}" (${email}) y droguería "${drogueria.nombre}"`,
      });

      return json({
        exito: true,
        organizacion: { id: orgData.id, nombre: orgData.nombre },
        drogueria: { id: drogueria.id, codigo_interno: drogueria.codigo_interno, nombre: drogueria.nombre },
        administrador: { id: userData.user.id, email, nombre: admin.nombre.trim() },
      });

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Error interno del servidor";
      console.error("Error en crear-cliente:", errorMsg);

      // Compensación: eliminar registros creados
      if (drogueriaCreada?.id) {
        await supabase.from("boticas").delete().eq("id", drogueriaCreada.id).catch(() => {});
      }
      if (orgCreada?.id) {
        // La config se elimina en cascada por FK
        await supabase.from("organizaciones").delete().eq("id", orgCreada.id).catch(() => {});
      }

      return json({ error: errorMsg }, 400);
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Error interno del servidor";
    console.error("Error no controlado en crear-cliente:", errorMsg);
    return json({ error: "Error interno del servidor" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
