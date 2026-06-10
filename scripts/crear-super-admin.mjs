/**
 * Crea el usuario super_admin en Supabase Auth + perfil en la tabla `usuarios`.
 * Uso: node scripts/crear-super-admin.mjs
 *
 * Requiere VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_ROLE en .env
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.loadEnvFile(resolve(__dirname, '../.env'))

const { createClient } = await import('@supabase/supabase-js')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE en .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// UUID v5 generator (same namespace as seeds)
const NS = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
function uuidv5(name) {
  const ns = hexToBytes(NS.replace(/-/g, ''))
  const nb = new TextEncoder().encode(name)
  const buf = new Uint8Array(ns.length + nb.length)
  buf.set(ns)
  buf.set(nb, ns.length)
  const h = createHash('sha1').update(buf).digest()
  const b = new Uint8Array(h.buffer, 0, 16)
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
function hexToBytes(hex) {
  const r = []
  for (let i = 0; i < hex.length; i += 2) r.push(parseInt(hex.slice(i, i + 2), 16))
  return new Uint8Array(r)
}

const ORG_PLATFORM_ID = uuidv5('org-000')

const ADMIN_EMAIL = 'super.admin@boticaml.pe'
const ADMIN_PASSWORD = 'SuperAdmin2026!'

async function asegurarOrganizacion() {
  const { data: existing } = await supabase
    .from('organizaciones')
    .select('id')
    .eq('id', ORG_PLATFORM_ID)
    .maybeSingle()

  if (existing) {
    console.log('✓ Organización plataforma ya existe')
    return
  }

  const { error } = await supabase.from('organizaciones').insert({
    id: ORG_PLATFORM_ID,
    nombre: 'Botica Demand ML Platform',
    tipo_identificacion: 'ruc',
    numero_identificacion: '20999999999',
    pais_origen: 'PE',
  })

  if (error) {
    if (error.code === '23505') {
      console.log('✓ Organización plataforma ya existe (conflicto ignorado)')
    } else {
      console.error('Error creando organización plataforma:', error.message)
      process.exit(1)
    }
  } else {
    console.log('✓ Organización plataforma creada')
  }
}

async function obtenerUserId(email) {
  const { data: users } = await supabase.auth.admin.listUsers()
  const found = users?.users?.find(u => u.email === email)
  return found?.id || null
}

async function main() {
  console.log('=== Creando super_admin ===\n')

  // 1. Asegurar que la organización plataforma existe (org-000)
  await asegurarOrganizacion()

  // 2. Crear usuario en auth.users.
  //    El trigger on_auth_user_after_insert copia user_metadata a la tabla usuarios,
  //    incluyendo org_id (FK NOT NULL).
  const { data: userData, error: userError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      nombre: 'Super Admin',
      rol: 'super_admin',
      org_id: ORG_PLATFORM_ID,
      botica_id: null,
    },
    app_metadata: {
      rol: 'super_admin',
      org_id: ORG_PLATFORM_ID,
      botica_id: null,
    },
  })

  let userId = userData?.user?.id

  if (userError) {
    if (userError.message?.includes('already exists')) {
      console.log('El usuario super_admin ya existe en auth.users — obteniendo ID...')
      userId = await obtenerUserId(ADMIN_EMAIL)
    } else {
      console.error('Error al crear usuario:', userError.message)
      process.exit(1)
    }
  } else {
    console.log(`✓ Usuario creado en auth.users: ${ADMIN_EMAIL} (ID: ${userId})`)
  }

  if (!userId) {
    console.error('No se pudo obtener el ID del usuario')
    process.exit(1)
  }

  // 3. Sincronizar perfil (upsert por si el trigger no corrió)
  const { error: profileError } = await supabase
    .from('usuarios')
    .upsert(
      {
        id: userId,
        org_id: ORG_PLATFORM_ID,
        email: ADMIN_EMAIL,
        nombre: 'Super Admin',
        rol: 'super_admin',
        activo: true,
      },
      { onConflict: 'id' }
    )

  if (profileError) {
    console.error('Error al crear perfil en usuarios:', profileError.message)
    process.exit(1)
  }

  console.log('✓ Perfil sincronizado en tabla usuarios')
  console.log('\n--- Credenciales ---')
  console.log(`Email:    ${ADMIN_EMAIL}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log('')
  console.log('Inicia sesión en la app con estas credenciales.')
}

main()
