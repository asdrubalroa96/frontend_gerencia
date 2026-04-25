import { Box, SimpleGrid, Text as ChakraText } from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MGMT_LABELS = {
  por_gestionar: 'Por gestionar',
  informativo: 'Informativo',
  concluido: 'Concluido',
};

const MGMT_COLORS = {
  por_gestionar: '#E53E3E',
  informativo: '#D69E2E',
  concluido: '#276749',
};

/** Claves que participan en el gráfico de anillo (excluye informativo). */
const RING_MANAGEMENT_KEYS = ['por_gestionar', 'concluido'];

const BAR_ORDER = ['por_gestionar', 'informativo', 'concluido'];

function ChartCard({ title, subtitle, children, minH = '260px' }) {
  return (
    <Box bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.100" p={4} minH={minH}>
      <ChakraText fontWeight="700" fontSize="md" color="gray.800">
        {title}
      </ChakraText>
      {subtitle ? (
        <ChakraText fontSize="xs" color="gray.500" mb={2}>
          {subtitle}
        </ChakraText>
      ) : (
        <Box mb={2} />
      )}
      {children}
    </Box>
  );
}

/**
 * @param {{ management: string, total: number }[]} stats
 * @param {{ title?: string, subtitle?: string }} [options]
 */
export default function CorrespondenceStatsCharts({ stats, title = 'Estadísticas', subtitle }) {
  const dataBar = useMemo(() => {
    const list = stats || [];
    const byKey = new Map(list.map((s) => [s.management, Number(s.total) || 0]));
    return BAR_ORDER.map((key) => ({
      key,
      name: MGMT_LABELS[key],
      total: byKey.get(key) ?? 0,
      fill: MGMT_COLORS[key],
    }));
  }, [stats]);

  const dataRing = useMemo(
    () => dataBar.filter((d) => RING_MANAGEMENT_KEYS.includes(d.key)),
    [dataBar]
  );

  const totalBar = useMemo(() => dataBar.reduce((acc, d) => acc + d.total, 0), [dataBar]);
  const totalRing = useMemo(() => dataRing.reduce((acc, d) => acc + d.total, 0), [dataRing]);

  if (!dataBar.length || totalBar === 0) {
    return (
      <Box bg="gray.50" borderRadius="md" p={6} borderWidth="1px" borderColor="gray.200" mb={4}>
        <ChakraText fontSize="sm" color="gray.600" textAlign="center">
          Sin datos de gestión para graficar. Aplique filtros o registre correspondencia.
        </ChakraText>
      </Box>
    );
  }

  return (
    <Box mb={4}>
      <ChakraText fontWeight="600" fontSize="md" mb={2} color="gray.800">
        {title}
      </ChakraText>
      {subtitle ? (
        <ChakraText fontSize="sm" color="gray.600" mb={3}>
          {subtitle}
        </ChakraText>
      ) : null}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <ChartCard
          title="Distribución (anillo)"
          subtitle="Solo «Por gestionar» y «Concluido»: proporción entre ambos (sin informativos)"
        >
          <Box h="280px" w="100%">
            {totalRing > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dataRing}
                    dataKey="total"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={92}
                    paddingAngle={2}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {dataRing.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} registro${value === 1 ? '' : 's'}`, 'Cantidad']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box display="flex" alignItems="center" justifyContent="center" h="100%">
                <ChakraText fontSize="sm" color="gray.500" textAlign="center" px={4}>
                  No hay registros «Por gestionar» ni «Concluido» en el listado visible; el anillo solo incluye esos
                  estados.
                </ChakraText>
              </Box>
            )}
          </Box>
        </ChartCard>

        <ChartCard title="Totales por estado" subtitle="Los tres estados de gestión (dinámico)">
          <Box h="280px" w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataBar} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                <Tooltip formatter={(value) => [`${value}`, 'Registros']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="total" name="Registros" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {dataBar.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </ChartCard>
      </SimpleGrid>
    </Box>
  );
}
