import { Box, SimpleGrid, Text as ChakraText } from '@chakra-ui/react';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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

function buildMonthlyMachines(rows) {
  const base = MONTH_LABELS.map((m) => ({ mes: m, en_tramite: 0, desincorporadas: 0 }));
  for (const r of rows || []) {
    const d = r?.created_at ? new Date(r.created_at) : null;
    const mi = d && !Number.isNaN(d.getTime()) ? d.getMonth() : null;
    if (mi == null) continue;
    const isDisc = Boolean(r.item_disincorporated_at || r.batch_disincorporated_at);
    if (isDisc) base[mi].desincorporadas += 1;
    else base[mi].en_tramite += 1;
  }
  return base;
}

function buildReenajPie(stats) {
  // Anillo por MÁQUINAS (no por lotes)
  const marked = Number(stats?.marked_machines ?? 0) || 0;
  const total = Number(stats?.machines ?? 0) || 0;
  const notMarked = Math.max(0, total - marked);
  const out = [];
  if (marked > 0) out.push({ name: 'Marcadas', value: marked, fill: '#6B46C1' });
  if (notMarked > 0) out.push({ name: 'No marcadas', value: notMarked, fill: '#CBD5E0' });
  if (!out.length) out.push({ name: 'Sin datos', value: 1, fill: '#E2E8F0' });
  return out;
}

export default function FiscalDisincorporationCharts({ rows, stats, hint }) {
  const monthly = useMemo(() => buildMonthlyMachines(rows), [rows]);
  const pie = useMemo(() => buildReenajPie(stats), [stats]);
  const subtitle = hint || 'Según filtros aplicados';

  if (!rows?.length) {
    return (
      <Box bg="gray.50" borderRadius="md" p={6} borderWidth="1px" borderColor="gray.200" mt={4}>
        <ChakraText fontSize="sm" color="gray.600" textAlign="center">
          Sin registros para graficar con los filtros actuales.
        </ChakraText>
      </Box>
    );
  }

  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4} mt={4}>
      <ChartCard title="Desincorporaciones por Mes" subtitle={subtitle}>
        <Box h="280px" w="100%">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 4, bottom: 8 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Legend />
              <Bar dataKey="en_tramite" name="En trámite" fill="#D69E2E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="desincorporadas" name="Desincorporadas" fill="#38A169" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>

      <ChartCard title="Para Reenajenación">
        <Box h="280px" w="100%">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <Tooltip />
              <Legend />
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </ChartCard>
    </SimpleGrid>
  );
}

