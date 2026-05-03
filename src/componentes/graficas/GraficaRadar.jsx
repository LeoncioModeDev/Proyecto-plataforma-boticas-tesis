import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { colores } from '@/estilos/tema'

/**
 * Gráfica de radar para comparar familias ATC en distintas dimensiones.
 */
export default function GraficaRadar({ datos, clave = 'valor', altura = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <RadarChart data={datos}>
        <PolarGrid stroke={colores.neutro.grisBorde} />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: colores.neutro.grisTexto }} />
        <PolarRadiusAxis tick={{ fontSize: 10, fill: colores.neutro.grisTexto }} />
        <Tooltip />
        <Radar
          name="Valor"
          dataKey={clave}
          stroke={colores.marca.principal}
          fill={colores.marca.claro}
          fillOpacity={0.6}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
