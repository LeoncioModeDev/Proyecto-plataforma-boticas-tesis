export function crearTransporteSesion({ url, claveAnonima, obtenerAuth, enviar = (...args) => fetch(...args) }) {
  const base = new URL(url.endsWith('/') ? url : `${url}/`)
  const rutaRest = new URL('rest/v1/', base).pathname
  const rutaEdge = new URL('functions/v1/', base).pathname
  const recuperaciones = new Map()

  async function renovar(tokenRechazado) {
    try {
      const auth = obtenerAuth()
      const { data, error } = await auth.getSession()
      const sesion = data?.session
      // Si la sesion ya cambio, no podemos atribuir el token rechazado a la actual.
      const usuarioId = sesion?.user?.id
      if (error || sesion?.access_token !== tokenRechazado || !usuarioId) return null

      // El SDK elige la sesion bajo su lock; no se le pasa un refresh token capturado.
      const renovacion = await auth.refreshSession()
      const nueva = renovacion.data?.session
      if (renovacion.error || nueva?.user?.id !== usuarioId ||
          !nueva.access_token || nueva.access_token === tokenRechazado) return null

      const actual = await auth.getSession()
      return !actual.error && actual.data?.session?.access_token === nueva.access_token &&
        actual.data.session.user?.id === usuarioId ? nueva.access_token : null
    } catch {
      return null
    }
  }

  return async function fetchConSesion(entrada, opciones) {
    const respuesta = await enviar(entrada, opciones)
    if (respuesta.status !== 401 || respuesta.redirected) return respuesta

    const solicitud = entrada instanceof Request ? entrada : null
    let destino
    try {
      destino = new URL(solicitud?.url ?? entrada, globalThis.location?.href)
    } catch {
      return respuesta
    }
    // global.fetch tambien recibe Auth: no esperar al SDK desde su propio fetch.
    if (destino.origin !== base.origin ||
        !(destino.pathname.startsWith(rutaRest) || destino.pathname.startsWith(rutaEdge))) return respuesta

    const senal = opciones?.signal === undefined ? solicitud?.signal : opciones.signal
    const cabeceras = new Headers(opciones?.headers ?? solicitud?.headers)
    const token = /^Bearer\s+(\S+)$/i.exec(cabeceras.get('Authorization') ?? '')?.[1]
    if (!token || token === claveAnonima || senal?.aborted) return respuesta

    let recuperacion = recuperaciones.get(token)
    if (!recuperacion) {
      recuperacion = renovar(token).finally(() => recuperaciones.delete(token))
      recuperaciones.set(token, recuperacion)
    }
    const tokenNuevo = await recuperacion

    const metodo = (opciones?.method ?? solicitud?.method ?? 'GET').toUpperCase()
    if (!tokenNuevo || senal?.aborted || !['GET', 'HEAD'].includes(metodo) ||
        destino.pathname.startsWith(`${rutaRest}rpc/`)) return respuesta

    cabeceras.set('Authorization', `Bearer ${tokenNuevo}`)
    return enviar(entrada, { ...opciones, headers: cabeceras })
  }
}
