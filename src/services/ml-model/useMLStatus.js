import { useEffect, useState } from 'react'
import { obtenerEstadoModelo, obtenerHealthML } from './modelosML'

export function useMLStatus() {
  const [estado, setEstado] = useState({ cargando: true, disponible: false, modo: null, modeloCargado: false, error: null })

  useEffect(() => {
    const controller = new AbortController()

    async function cargar() {
      setEstado(prev => ({ ...prev, cargando: true, error: null }))
      try {
        const health = await obtenerHealthML({ signal: controller.signal })
        const modelo = await obtenerEstadoModelo({ signal: controller.signal })
        setEstado({
          cargando: false,
          disponible: true,
          modo: modelo.modo,
          modeloCargado: !!health.model_loaded,
          version: health.model_version,
          error: null,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setEstado({ cargando: false, disponible: false, modo: null, modeloCargado: false, error: error.message })
      }
    }

    cargar()
    return () => controller.abort()
  }, [])

  return estado
}
