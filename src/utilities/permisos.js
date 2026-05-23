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

export function puedeEditar(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeGestionarProveedores(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeGestionarOrdenesCompra(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeVerMLOperativo(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL || usuario?.rol === ROLES.OPERADOR_DROGUERIA
}

export function puedeConfigurar(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL
}

export function puedeVerMLTecnico(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL
}

export function puedeVerMLCompleto(usuario) {
  return usuario?.rol === ROLES.ADMIN_CENTRAL
}

export function obtenerPortal(usuario) {
  if (!usuario) return null
  switch (usuario.rol) {
    case ROLES.ADMIN_CENTRAL: return 'central'
    case ROLES.OPERADOR_DROGUERIA: return 'operaciones'
    case ROLES.VISOR_BOTICA: return 'botica'
    default: return null
  }
}
