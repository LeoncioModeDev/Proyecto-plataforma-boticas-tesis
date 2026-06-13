/**
 * Crea el usuario super_admin en Supabase Auth + perfil en la tabla `usuarios`.
 * Uso: node supabase/seed/crear-super-admin.mjs
 *
 * Requiere VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_ROLE en .env
 *
 * Si falla con "Database error creating new user", ejecuta primero
 * supabase/migrations/00000000000000_migracion.sql en Supabase Dashboard > SQL Editor.
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

process.loadEnvFile(resolve(__dirname, '../../.env'))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE en .env')
  process.exit(1)
}

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
}

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

async function request(method, path, body, extraHeaders = {}) {
  const resp = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: { ...AUTH_HEADERS, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  const text = await resp.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  return { status: resp.status, ok: resp.ok, data }
}

async function crearUsuarioEnAuth() {
  const { status, ok, data } = await request(
    'POST',
    '/auth/v1/admin/users',
    {
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
    }
  )

  if (ok) return data.id

  if (status === 409 || data?.msg?.includes('already been registered')) {
    console.log('El usuario super_admin ya existe en auth.users — obteniendo ID...')
    const { data: listData } = await request('GET', '/auth/v1/admin/users')
    const found = listData?.users?.find(u => u.email === ADMIN_EMAIL)
    return found?.id || null
  }

  console.error('Error creando usuario en auth.users:', data.msg || data.error || 'desconocido')
  console.error('Si es "Database error creating new user", ejecuta supabase/migrations/00000000000000_migracion.sql')
  console.error('en Supabase Dashboard > SQL Editor y reintenta.')
  return null
}

async function asegurarOrganizacion() {
  const { status, data } = await request(
    'GET',
    `/rest/v1/organizaciones?id=eq.${ORG_PLATFORM_ID}&select=id`,
  )

  if (status === 200 && data?.length > 0) {
    console.log('✓ Organización plataforma ya existe')
    return
  }

  const { ok, data: insertData } = await request(
    'POST',
    '/rest/v1/organizaciones',
    {
      id: ORG_PLATFORM_ID,
      nombre: 'Botica Demand ML Platform',
      tipo_identificacion: 'ruc',
      numero_identificacion: '20999999999',
      pais_origen: 'PE',
    },
  )

  if (ok) {
    console.log('✓ Organización plataforma creada')
  } else {
    console.error('Error creando organización plataforma:', insertData?.message || 'desconocido')
    process.exit(1)
  }
}

async function upsertPerfil(userId) {
  const perfil = {
    id: userId,
    org_id: ORG_PLATFORM_ID,
    email: ADMIN_EMAIL,
    nombre: 'Super Admin',
    rol: 'super_admin',
    activo: true,
  }

  const { status } = await request(
    'POST',
    '/rest/v1/usuarios',
    perfil,
    { 'Prefer': 'resolution=merge-duplicates' },
  )

  const { data: verify } = await request(
    'GET',
    `/rest/v1/usuarios?id=eq.${userId}&select=id`,
  )

  if (verify?.length > 0) {
    console.log('✓ Perfil sincronizado en tabla usuarios')
  } else {
    console.error('Error al crear perfil en usuarios')
    process.exit(1)
  }
}

async function main() {
  console.log('=== Creando super_admin ===\n')

  await asegurarOrganizacion()

  const userId = await crearUsuarioEnAuth()

  if (!userId) {
    console.error('No se pudo obtener el ID del usuario')
    process.exit(1)
  }

  await upsertPerfil(userId)

  console.log('\n--- Credenciales ---')
  console.log(`Email:    ${ADMIN_EMAIL}`)
  console.log(`Password: ${ADMIN_PASSWORD}`)
  console.log('')
  console.log('Inicia sesión en la app con estas credenciales.')
}

main()
