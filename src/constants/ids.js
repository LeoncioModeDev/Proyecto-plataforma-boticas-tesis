import { createHash } from 'crypto'

const NS = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const hexToBytes = (h) => { const r = []; for (let i = 0; i < h.length; i+=2) r.push(parseInt(h.slice(i,i+2),16)); return new Uint8Array(r) }
const id = (n) => {
  const ns = hexToBytes(NS.replace(/-/g, ''))
  const nb = new TextEncoder().encode(n)
  const buf = new Uint8Array(ns.length + nb.length); buf.set(ns); buf.set(nb, ns.length)
  const h = createHash('sha1').update(buf).digest()
  const b = new Uint8Array(h.buffer, 0, 16)
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

export const IDS = {
  // Auth user UUIDs (from Supabase Auth)
  USUARIO_ADMIN: 'dffc076b-9ea7-463a-b869-bd88d1658cca',
  USUARIO_OPERADOR: 'd7c88864-9104-437d-8f2b-361924ed91dd',
  USUARIO_VISOR: 'aa99fd73-a72b-4e37-87a3-92cdd6bf6b59',

  // Deterministic UUIDs (uuid v5 with namespace a0eebc99-...)
  ORG_PRINCIPAL: id('org-001'),
  DROGUERIA_CENTRAL: id('ub-001'),
  BOTICA_MIRAFLORES: id('ub-002'),
  BOTICA_SAN_BORJA: id('ub-003'),
  PARACETAMOL: id('prod-001'),
  AMOXICILINA: id('prod-002'),
  IBUPROFENO: id('prod-003'),
  OMEPRAZOL: id('prod-004'),
  LOSARTAN: id('prod-005'),
  METFORMINA: id('prod-006'),
}
