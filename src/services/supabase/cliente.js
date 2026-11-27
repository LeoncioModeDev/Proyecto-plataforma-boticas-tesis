import { createClient } from '@supabase/supabase-js'
import { crearTransporteSesion } from './transporteSesion.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const fetchConSesion = crearTransporteSesion({
  url: supabaseUrl,
  claveAnonima: supabaseAnonKey,
  obtenerAuth: () => supabase.auth,
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConSesion },
})
