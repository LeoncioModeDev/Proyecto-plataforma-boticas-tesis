import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  if (!jwt) {
    return json({ error: 'Token de autenticación requerido' }, 401)
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
  if (authError || !user) {
    return json({ error: 'Token inválido o expirado' }, 401)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return json({ error: 'Perfil de usuario no encontrado' }, 403)
  }

  if (profile.rol !== 'super_admin') {
    return json({ error: 'Se requiere rol super_admin' }, 403)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Cuerpo de solicitud inválido' }, 400)
  }

  const { org, admin } = body

  if (!org?.nombre || !org?.tipo_identificacion || !org?.numero_identificacion) {
    return json({ error: 'Faltan datos de la organización (nombre, tipo_identificacion, numero_identificacion)' }, 400)
  }

  if (!admin?.nombre || !admin?.email || !admin?.password) {
    return json({ error: 'Faltan datos del administrador (nombre, email, password)' }, 400)
  }

  const { data: orgData, error: orgError } = await supabaseAdmin
    .from('organizaciones')
    .insert({
      nombre: org.nombre,
      tipo_identificacion: org.tipo_identificacion,
      numero_identificacion: org.numero_identificacion,
      pais_origen: org.pais_origen || 'PE',
    })
    .select('id, nombre')
    .single()

  if (orgError) {
    if (orgError.code === '23505') {
      return json({ error: 'Ya existe una organización con ese tipo y número de identificación' }, 409)
    }
    return json({ error: orgError.message }, 400)
  }

  let drogueriaId = null
  if (org?.drogueria) {
    const { data: boticaData, error: boticaError } = await supabaseAdmin
      .from('boticas')
      .insert({
        org_id: orgData.id,
        nombre: org.drogueria.nombre || `Droguería Central - ${org.nombre}`,
        tipo: 'drogueria',
        ubigeo: org.drogueria.ubigeo || '150101',
        direccion: org.drogueria.direccion || null,
        telefono: org.drogueria.telefono || null,
      })
      .select('id')
      .single()

    if (boticaError) {
      return json({ error: boticaError.message }, 400)
    }
    drogueriaId = boticaData.id
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    email_confirm: true,
    user_metadata: {
      org_id: orgData.id,
      org_nombre: orgData.nombre,
      nombre: admin.nombre,
      rol: 'admin_central',
      botica_id: drogueriaId,
    },
    app_metadata: {
      rol: 'admin_central',
      org_id: orgData.id,
      botica_id: drogueriaId,
    },
  })

  if (userError) {
    return json({ error: userError.message }, 400)
  }

  return json({
    exito: true,
    organizacion: {
      id: orgData.id,
      nombre: orgData.nombre,
    },
    drogueria_id: drogueriaId,
    administrador: {
      id: userData.user.id,
      email: admin.email,
      nombre: admin.nombre,
    },
  })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
