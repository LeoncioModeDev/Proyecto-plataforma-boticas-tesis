import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { colores } from '@/estilos/tema'

/**
 * Gráfica de área para predicciones con intervalo de confianza.
 * La línea central es la predicción, el área sombreada es el rango.
 */
export default function GraficaArea({ datos, altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={datos} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
        <Area
          type="monotone"
          dataKey="intervaloSup"
          name="Límite superior"
          stroke="none"
          fill={colores.marca.claro}
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="intervaloInf"
          name="Límite inferior"
          stroke="none"
          fill={colores.neutro.blanco}
          fillOpacity={1}
        />
        <Line
          type="monotone"
          dataKey="real"
          name="Demanda real"
          stroke={colores.marca.principal}
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="predicho"
          name="Predicción"
          stroke={colores.marca.acento}
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
