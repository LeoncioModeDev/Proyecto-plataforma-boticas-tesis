import { supabase } from './cliente'

export async function obtenerOpcionesFormasFarmaceuticas() {
  const { data, error } = await supabase
    .from('formas_farmaceuticas')
    .select('id, nombre')
    .order('nombre')

  if (error) throw new Error('Error al cargar formas farmacéuticas: ' + error.message)
  return (data || []).map(ff => ({
    valor: ff.id,
    etiqueta: ff.nombre.charAt(0).toUpperCase() + ff.nombre.slice(1),
  }))
}

export async function obtenerOpcionesPrincipiosActivos() {
  const { data, error } = await supabase
    .from('principios_activos')
    .select('id, nombre')
    .order('nombre')

  if (error) throw new Error('Error al cargar principios activos: ' + error.message)
  return (data || []).map(pa => ({
    valor: pa.id,
    etiqueta: pa.nombre,
  }))
}

export async function obtenerOpcionesUnidadesMedida() {
  const { data, error } = await supabase
    .from('unidades_medida')
    .select('id, simbolo')
    .order('simbolo')

  if (error) throw new Error('Error al cargar unidades de medida: ' + error.message)
  return (data || []).map(um => ({
    valor: um.id,
    etiqueta: um.simbolo,
  }))
}

export async function obtenerOpcionesPaises() {
  const { data, error } = await supabase
    .from('paises')
    .select('codigo, nombre')
    .order('nombre')

  if (error) throw new Error('Error al cargar países: ' + error.message)
  return (data || []).map(p => ({
    valor: p.codigo,
    etiqueta: p.nombre,
  }))
}

export async function obtenerOpcionesUbigeos() {
  const { data, error } = await supabase
    .from('ubigeos')
    .select('*')
    .order('departamento')
    .order('provincia')
    .order('distrito')

  if (error) throw new Error('Error al cargar ubigeos: ' + error.message)
  return (data || []).map(u => ({
    valor: u.codigo,
    etiqueta: `${u.distrito}, ${u.provincia}, ${u.departamento}`,
  }))
}
