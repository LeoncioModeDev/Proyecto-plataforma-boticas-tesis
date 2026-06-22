import { supabase } from './cliente'

export async function obtenerModelosML() {
  const { data, error } = await supabase
    .from('modelos_ml')
    .select('*')
    .order('fecha_entrenamiento', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function obtenerModeloActivo() {
  const { data, error } = await supabase
    .from('modelos_ml')
    .select('*')
    .eq('status', 'production')
    .order('fecha_entrenamiento', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}
