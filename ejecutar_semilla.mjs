import { createHash } from 'crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://TU_SUPABASE_URL.supabase.co'
const SERVICE_ROLE = process.env.VITE_SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE || 'TU_SERVICE_ROLE_KEY'

if (SUPABASE_URL.includes('TU_SUPABASE_URL') || SERVICE_ROLE.includes('TU_SERVICE_ROLE')) {
  console.error('ERROR: Debes configurar VITE_SUPABASE_URL y VITE_SUPABASE_SERVICE_ROLE en .env')
  console.error('  O exportar las variables de entorno directamente.')
  process.exit(1)
}

const SUPABASE_AUTH = `${SUPABASE_URL}/auth/v1`
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`
const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE,
  'Authorization': `Bearer ${SERVICE_ROLE}`,
}

const NS = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

function uuidV5(name) {
  const ns = hexToBytes(NS.replace(/-/g, ''))
  const nb = new TextEncoder().encode(name)
  const buf = new Uint8Array(ns.length + nb.length); buf.set(ns); buf.set(nb, ns.length)
  const h = createHash('sha1').update(buf).digest()
  const b = new Uint8Array(h.buffer, 0, 16)
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}
function hexToBytes(hex) { const r = []; for (let i = 0; i < hex.length; i+=2) r.push(parseInt(hex.slice(i,i+2),16)); return new Uint8Array(r) }

const ORG_001 = uuidV5('org-001')
const BOTICA_SB = uuidV5('ub-003')

const USRS = [
  { id: 'dffc076b-9ea7-463a-b869-bd88d1658cca', email: 'carlos@boticaml.pe',     nombre: 'Carlos Mendoza', rol: 'admin_central',       botica_id: null },
  { id: 'd7c88864-9104-437d-8f2b-361924ed91dd', email: 'ana@boticaml.pe',         nombre: 'Ana Torres',     rol: 'operador_drogueria', botica_id: null },
  { id: 'aa99fd73-a72b-4e37-87a3-92cdd6bf6b59', email: 'luis@boticaml.pe',        nombre: 'Luis Garcia',    rol: 'visor_botica',       botica_id: BOTICA_SB },
]

async function crearUsuario(email, password, userMetadata, appMetadata) {
  const resp = await fetch(`${SUPABASE_AUTH}/admin/users`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata, app_metadata: appMetadata }),
  })
  const body = await resp.json()
  if (!resp.ok) {
    if (resp.status === 409) {
      console.log(`  ~ ${email} ya existe (actualizando metadata)`)
      const { id } = body
      const upd = await fetch(`${SUPABASE_AUTH}/admin/users/${id}`, {
        method: 'PUT',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: userMetadata, app_metadata: appMetadata }),
      })
      if (!upd.ok) {
        const txt = await upd.text()
        throw new Error(`Error actualizando ${email}: ${upd.status} ${txt.slice(0, 200)}`)
      }
      return id
    }
    throw new Error(`Error creando ${email}: ${resp.status} ${JSON.stringify(body).slice(0, 200)}`)
  }
  console.log(`  ✓ ${email}`)
  return body.id
}

async function upsertPerfil(user) {
  const resp = await fetch(`${SUPABASE_REST}/usuarios?id=eq.${user.id}`, {
    headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` },
  })
  const existing = await resp.json()
  const payload = { id: user.id, org_id: ORG_001, email: user.email, nombre: user.nombre, rol: user.rol, botica_id: user.botica_id }

  if (existing.length > 0) {
    await fetch(`${SUPABASE_REST}/usuarios?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    })
  } else {
    await fetch(`${SUPABASE_REST}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(payload),
    })
  }
  console.log(`  ✓ perfil ${user.email}`)
}

async function main() {
  console.log('=== Creando usuarios en auth.users (Auth Admin API) ===\n')

  for (const u of USRS) {
    const userId = await crearUsuario(
      u.email,
      'BoticaML2024!',
      { org_id: ORG_001, nombre: u.nombre, rol: u.rol, botica_id: u.botica_id },
      { rol: u.rol, org_id: ORG_001, botica_id: u.botica_id },
    )
    if (userId !== u.id) {
      console.log(`  ! ${u.email} ID ${userId} (esperado ${u.id}) — se usa el ID real`)
    }
  }

  console.log('\n=== Sincronizando perfiles en public.usuarios ===\n')
  for (const u of USRS) {
    await upsertPerfil(u)
  }

  console.log('\n✓ Usuarios listos. Ahora ejecuta semilla.sql en el SQL Editor.')
}

main().catch(err => { console.error(err); process.exit(1) })
