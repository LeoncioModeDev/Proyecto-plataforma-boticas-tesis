import { ROLES } from '@/constants/roles'

export function debeFiltrarPorBotica(usuario) {
  return usuario?.rol === ROLES.VISOR_BOTICA
}

export function obtenerFiltroBotica(usuario) {
  if (!debeFiltrarPorBotica(usuario)) return null
  return usuario?.boticaId || null
}

export function filtrarPorBotica(usuario, datos, campoUbicacion = 'ubicacionId') {
  const boticaId = obtenerFiltroBotica(usuario)
  if (!boticaId) return datos
  return datos.filter(d => d[campoUbicacion] === boticaId)
}

export function filtrarPorBoticaId(usuario, datos, campo = 'boticaId') {
  const boticaId = obtenerFiltroBotica(usuario)
  if (!boticaId) return datos
  return datos.filter(d => d[campo] === boticaId)
}

const ES_ADMIN = (r) => r === ROLES.SUPER_ADMIN || r === ROLES.ADMIN_CENTRAL

export function puedeEditar(usuario) {
  return ES_ADMIN(usuario?.rol) || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeGestionarProveedores(usuario) {
  return ES_ADMIN(usuario?.rol) || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeGestionarOrdenesCompra(usuario) {
  return ES_ADMIN(usuario?.rol) || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeVerMLOperativo(usuario) {
  return ES_ADMIN(usuario?.rol) || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeConfigurar(usuario) {
  return ES_ADMIN(usuario?.rol)
}

export function puedeVerMLTecnico(usuario) {
  return ES_ADMIN(usuario?.rol)
}

export function puedeVerMLCompleto(usuario) {
  return ES_ADMIN(usuario?.rol)
}

export function esSuperAdmin(usuario) {
  return usuario?.rol === ROLES.SUPER_ADMIN
}

export function obtenerPortal(usuario) {
  if (!usuario) return null
  switch (usuario.rol) {
    case ROLES.SUPER_ADMIN: return 'central'
    case ROLES.ADMIN_CENTRAL: return 'central'
    case ROLES.OPERADOR_DROGUERIA: return 'operaciones'
    case ROLES.VISOR_BOTICA: return 'botica'
    default: return null
  }
}
