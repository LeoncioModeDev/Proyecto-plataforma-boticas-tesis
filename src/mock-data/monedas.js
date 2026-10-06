export const monedas = [
  { id: 'mon-001', codigo: 'PEN', nombre: 'Sol Peruano', simbolo: 'S/' },
  { id: 'mon-002', codigo: 'USD', nombre: 'Dólar Americano', simbolo: '$' },
  { id: 'mon-003', codigo: 'EUR', nombre: 'Euro', simbolo: '€' },
]

export const OPCIONES_MONEDAS = monedas.map(m => ({
  valor: m.id,
  etiqueta: `${m.simbolo} ${m.codigo} — ${m.nombre}`,
}))
