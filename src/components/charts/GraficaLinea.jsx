import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { colores } from '@/styles/tema'

/**
 * Gráfica de línea para tendencias temporales.
 */
export default function GraficaLinea({ datos, lineas = [], altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colores.neutro.grisBorde} />
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: colores.neutro.grisTexto }} />
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
        {lineas.map((linea, i) => (
          <Line
            key={linea.clave}
            type="monotone"
            dataKey={linea.clave}
            name={linea.etiqueta}
            stroke={linea.color || (i === 0 ? colores.marca.principal : colores.marca.acento)}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
