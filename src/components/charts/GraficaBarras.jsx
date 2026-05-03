import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { colores } from '@/styles/tema'

/**
 * Gráfica de barras vertical para comparativas.
 */
export default function GraficaBarras({ datos, barras = [], altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colores.neutro.grisBorde} />
        <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: colores.neutro.grisTexto }} />
        <YAxis tick={{ fontSize: 12, fill: colores.neutro.grisTexto }} />
        <Tooltip
          contentStyle={{
            backgroundColor: colores.neutro.blanco,
            border: `1px solid ${colores.neutro.grisBorde}`,
            borderRadius: '8px',
            fontSize: '13px',
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {barras.map((barra, i) => (
          <Bar
            key={barra.clave}
            dataKey={barra.clave}
            name={barra.etiqueta}
            fill={barra.color || (i === 0 ? colores.marca.principal : colores.marca.acento)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
