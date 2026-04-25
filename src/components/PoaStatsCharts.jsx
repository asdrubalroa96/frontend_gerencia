import { Box, SimpleGrid, Text as ChakraText } from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function buildMonthlySeries(matrix) {
  return MONTH_LABELS.map((label, i) => {
    let planificado = 0;
    let ejecutado = 0;
    for (const obj of matrix || []) {
      for (const a of obj.activities || []) {
        planificado += Math.max(0, Math.floor(Number(a.planned_months?.[i]) || 0));
        ejecutado += Math.max(0, Math.floor(Number(a.executed_months?.[i]) || 0));
      }
    }
    const cumplimiento =
      planificado > 0 ? Math.round((ejecutado / planificado) * 10000) / 100 : null;
    return { mes: label, planificado, ejecutado, cumplimiento };
  });
}

function buildPieData(stats) {
  const { planned, executed } = stats;
  if (planned <= 0 && executed <= 0) {
    return [{ name: 'Sin meta', value: 1, fill: '#E2E8F0' }];
  }
  if (planned <= 0) {
    return [{ name: 'Ejecutado', value: executed, fill: '#3182CE' }];
  }
  const pendiente = Math.max(0, planned - executed);
  const out = [];
  if (executed > 0) out.push({ name: 'Ejecutado', value: executed, fill: '#3182CE' });
  if (pendiente > 0) out.push({ name: 'Pendiente (meta)', value: pendiente, fill: '#E9D8FD' });
  if (out.length === 0) out.push({ name: 'Meta cumplida', value: planned, fill: '#38A169' });
  return out;
}

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

function PoaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="600">
        {label}
      </ChakraText>
      {payload.map((p) => (
        <ChakraText key={p.dataKey} fontSize="sm" color="gray.700">
          {p.name}: {p.value}
          {p.dataKey === 'cumplimiento' && p.value != null ? '%' : ''}
        </ChakraText>
      ))}
    </Box>
  );
}

/**
 * Gráficos dinámicos de estadísticas POA (responden a la matriz ya filtrada por actividad/mes en el padre).
 */
export default function PoaStatsCharts({ matrix, stats, filterHint }) {
  const monthly = useMemo(() => buildMonthlySeries(matrix), [matrix]);
  const pieData = useMemo(() => buildPieData(stats), [stats]);
  const hasActivities = useMemo(
    () => (matrix || []).some((o) => (o.activities || []).length > 0),
    [matrix]
  );

  if (!hasActivities) {
    return (
      <Box bg="gray.50" borderRadius="md" p={6} borderWidth="1px" borderColor="gray.200">
        <ChakraText fontSize="sm" color="gray.600" textAlign="center">
          Sin actividades en el alcance seleccionado para graficar.
        </ChakraText>
      </Box>
    );
  }

  const subtitle = filterHint || 'Según filtros de actividad y mes';

  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} mt={4}>
      <ChartCard title="Planificado vs ejecutado por mes" subtitle={subtitle}>
        <Box h="280px" w="100%">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 4, bottom: 8 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip content={<PoaTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="planificado" name="Planificado" fill="#805AD5" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="ejecutado" name="Ejecutado" fill="#3182CE" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>

      <ChartCard title="% cumplimiento mensual" subtitle="Ejecutado ÷ planificado (por mes)">
        <Box h="280px" w="100%">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 'auto']}
                tick={{ fontSize: 11 }}
                width={44}
                tickFormatter={(v) => (v == null ? '' : `${v}%`)}
              />
              <Tooltip content={<PoaTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="cumplimiento"
                name="Cumplimiento %"
                stroke="#2B6CB0"
                strokeWidth={2}
                dot={{ r: 4, fill: '#2B6CB0' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>

      <ChartCard title="Distribución del alcance (total filtrado)" subtitle="Ejecutado frente a meta pendiente">
        <Box h="260px" w="100%">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={88}
                paddingAngle={2}
                label={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}`, name]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>

      <ChartCard title="Resumen numérico" subtitle="Totales del mismo alcance que los gráficos">
        <SimpleGrid columns={2} spacing={3}>
          <Box bg="purple.50" borderRadius="md" p={3} borderWidth="1px" borderColor="purple.100">
            <ChakraText fontSize="xs" color="purple.800" fontWeight="600">
              Planificado
            </ChakraText>
            <ChakraText fontSize="2xl" fontWeight="800" color="purple.700">
              {stats.planned}
            </ChakraText>
          </Box>
          <Box bg="blue.50" borderRadius="md" p={3} borderWidth="1px" borderColor="blue.100">
            <ChakraText fontSize="xs" color="blue.800" fontWeight="600">
              Ejecutado
            </ChakraText>
            <ChakraText fontSize="2xl" fontWeight="800" color="blue.700">
              {stats.executed}
            </ChakraText>
          </Box>
          <Box bg="green.50" borderRadius="md" p={3} borderWidth="1px" borderColor="green.100">
            <ChakraText fontSize="xs" color="green.800" fontWeight="600">
              Cumplimiento
            </ChakraText>
            <ChakraText fontSize="2xl" fontWeight="800" color="green.700">
              {stats.pct != null ? `${stats.pct}%` : '—'}
            </ChakraText>
          </Box>
          <Box bg="gray.50" borderRadius="md" p={3} borderWidth="1px" borderColor="gray.200">
            <ChakraText fontSize="xs" color="gray.700" fontWeight="600">
              Actividades / cumplidas
            </ChakraText>
            <ChakraText fontSize="xl" fontWeight="800" color="gray.800">
              {stats.acts} · {stats.actsOk}
            </ChakraText>
          </Box>
        </SimpleGrid>
      </ChartCard>
    </SimpleGrid>
  );
}
