import {
  Box,
  Divider,
  Heading,
  SimpleGrid,
  Skeleton,
  Text as ChakraText,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import client from '../api/client.js';
import { isScopedDivisionUser } from '../utils/divisionUi.js';
import { useAuth } from '../context/AuthContext.jsx';

const BRAND = '#c53030';
const MUTED = '#e2e8f0';
const CHART_COLORS = ['#9B2C2C', '#C53030', '#E53E3E', '#FC8181', '#742A2A', '#4A5568', '#DD6B20'];

function managementLabel(code) {
  const map = {
    por_gestionar: 'Por gestionar',
    informativo: 'Informativo',
    concluido: 'Concluido',
  };
  return map[code] || String(code).replace(/_/g, ' ');
}

function KpiCard({ title, value, hint, accent = BRAND }) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      boxShadow="sm"
      borderWidth="1px"
      borderColor="gray.100"
      p={5}
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '4px',
        bg: accent,
      }}
    >
      <ChakraText fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="wider" mb={1}>
        {title}
      </ChakraText>
      <ChakraText fontSize="3xl" fontWeight="800" color="gray.800" lineHeight="1.1">
        {value}
      </ChakraText>
      {hint ? (
        <ChakraText fontSize="xs" color="gray.500" mt={2}>
          {hint}
        </ChakraText>
      ) : null}
    </Box>
  );
}

function ChartCard({ title, subtitle, children, minH = '280px' }) {
  return (
    <Box bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.100" p={4} minH={minH}>
      <ChakraText fontWeight="700" fontSize="md" color="gray.800">
        {title}
      </ChakraText>
      {subtitle ? (
        <ChakraText fontSize="xs" color="gray.500" mb={3}>
          {subtitle}
        </ChakraText>
      ) : (
        <Box mb={3} />
      )}
      {children}
    </Box>
  );
}

function PieTooltipContent({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="600">
        {name}
      </ChakraText>
      <ChakraText fontSize="sm" color="gray.600">
        {value} registro{value === 1 ? '' : 's'}
      </ChakraText>
    </Box>
  );
}

function BarTooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="600">
        {label}
      </ChakraText>
      <ChakraText fontSize="sm" color="gray.600">
        {payload[0].value} total
      </ChakraText>
    </Box>
  );
}

/**
 * Dashboard de inicio: KPIs, anillos de progreso, barras verticales y tortas (según permisos).
 */
export default function HomePage() {
  const { user, can } = useAuth();
  /** Usuario adscrito a una división: el backend ya filtra KPIs y gráficos a esa división. */
  const isDivisionStats = isScopedDivisionUser(user);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [assetsSummary, setAssetsSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const requests = [];
      if (can('corr_sent.read')) {
        requests.push(
          client.get('/api/correspondence/sent/stats').then((r) => ({ key: 'sent', data: r.data }))
        );
      }
      if (can('corr_recv.read')) {
        requests.push(
          client.get('/api/correspondence/received/stats').then((r) => ({ key: 'received', data: r.data }))
        );
      }
      if (can('assets.read')) {
        requests.push(
          client.get('/api/national-assets/stats/summary').then((r) => ({ key: 'assets', data: r.data }))
        );
      }
      const results = await Promise.allSettled(requests);
      if (cancelled) return;
      for (const res of results) {
        if (res.status !== 'fulfilled') continue;
        const { key, data } = res.value;
        if (key === 'sent') setSent(data);
        if (key === 'received') setReceived(data);
        if (key === 'assets') setAssetsSummary(data);
      }
      setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [can, user?.permissions, user?.divisionId, user?.divisionGlobalScope]);

  const sentTotal = useMemo(() => sent.reduce((a, r) => a + (Number(r.total) || 0), 0), [sent]);
  const receivedTotal = useMemo(() => received.reduce((a, r) => a + (Number(r.total) || 0), 0), [received]);
  const sentConcluido = useMemo(
    () => Number(sent.find((r) => r.management === 'concluido')?.total) || 0,
    [sent]
  );
  const sentPorGestionar = useMemo(
    () => Number(sent.find((r) => r.management === 'por_gestionar')?.total) || 0,
    [sent]
  );

  const conclusionPct = useMemo(() => {
    if (!sentTotal) return 0;
    return Math.round((sentConcluido / sentTotal) * 100);
  }, [sentTotal, sentConcluido]);

  const assignmentPct = useMemo(() => {
    const t = assetsSummary?.summary?.total;
    const a = assetsSummary?.summary?.assigned;
    if (!t) return 0;
    return Math.round(((Number(a) || 0) / Number(t)) * 100);
  }, [assetsSummary]);

  const ringConclusionData = useMemo(() => {
    const rest = Math.max(0, 100 - conclusionPct);
    return [
      { name: 'Concluidos', value: conclusionPct, fill: BRAND },
      { name: 'Pendientes / otros', value: rest, fill: MUTED },
    ];
  }, [conclusionPct]);

  const ringAssignmentData = useMemo(() => {
    const rest = Math.max(0, 100 - assignmentPct);
    return [
      { name: 'Asignados', value: assignmentPct, fill: BRAND },
      { name: 'Por asignar', value: rest, fill: MUTED },
    ];
  }, [assignmentPct]);

  const sentBarData = useMemo(
    () =>
      sent.map((r) => ({
        name: managementLabel(r.management),
        total: Number(r.total) || 0,
      })),
    [sent]
  );

  const receivedBarData = useMemo(
    () =>
      received.map((r) => ({
        name: managementLabel(r.management),
        total: Number(r.total) || 0,
      })),
    [received]
  );

  const assetsByTypeData = useMemo(
    () =>
      (assetsSummary?.byType || []).map((r) => ({
        name: r.type,
        total: Number(r.total) || 0,
      })),
    [assetsSummary]
  );

  const today = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <VStack align="stretch" spacing={4} w="full">
        <Skeleton height="32px" borderRadius="md" />
        <Skeleton height="20px" borderRadius="md" maxW="md" />
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="120px" borderRadius="lg" />
          ))}
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
          <Skeleton height="300px" borderRadius="lg" />
          <Skeleton height="300px" borderRadius="lg" />
        </SimpleGrid>
      </VStack>
    );
  }

  return (
    <Box w="full" maxW="100%">
      <VStack align="stretch" spacing={1} mb={8}>
        <Heading size="lg" color="gray.800">
          Dashboard
        </Heading>
        <ChakraText color="gray.600" fontSize="sm">
          Resumen operativo ·{' '}
          <Box as="span" sx={{ textTransform: 'capitalize' }}>
            {today}
          </Box>
        </ChakraText>
        {isDivisionStats ? (
          <ChakraText fontSize="sm" color="blue.800" bg="blue.50" px={3} py={2} borderRadius="md" borderWidth="1px" borderColor="blue.100">
            Las estadísticas de correspondencia y bienes corresponden <strong>solo a su división</strong>
            {user?.divisionName ? `: ${user.divisionName}` : ''}.
          </ChakraText>
        ) : null}
        {user?.fullName ? (
          <ChakraText fontSize="sm" color="gray.700">
            Bienvenido, <strong>{user.fullName}</strong>
          </ChakraText>
        ) : null}
      </VStack>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4} mb={8}>
        {can('corr_sent.read') ? (
          <KpiCard
            title="Memos enviados"
            value={sentTotal}
            hint={`${sentConcluido} concluido${sentConcluido === 1 ? '' : 's'} · ${sentPorGestionar} por gestionar${
              isDivisionStats ? ' · solo su división' : ''
            }`}
          />
        ) : null}
        {can('corr_recv.read') ? (
          <KpiCard
            title="Correspondencia recibida"
            value={receivedTotal}
            hint={isDivisionStats ? 'Total de su división (canalizada desde el Despacho)' : 'Total en el sistema (vista Despacho)'}
            accent="#9B2C2C"
          />
        ) : null}
        {can('assets.read') && assetsSummary?.summary ? (
          <>
            <KpiCard
              title="Bienes nacionales"
              value={assetsSummary.summary.total}
              hint={`${assetsSummary.summary.assigned} asignados · ${assetsSummary.summary.unassigned} sin asignar${
                isDivisionStats ? ' · solo su división' : ''
              }`}
            />
            <KpiCard
              title="Tasa de asignación"
              value={`${assignmentPct}%`}
              hint={isDivisionStats ? 'Bienes de su división con persona asignada' : 'Bienes con persona asignada'}
              accent="#822727"
            />
          </>
        ) : null}
        {!can('corr_sent.read') && !can('corr_recv.read') && !can('assets.read') ? (
          <KpiCard title="Métricas" value="—" hint="Sin permisos de consulta para indicadores del panel." />
        ) : null}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6} mb={6}>
        {can('corr_sent.read') && sentTotal > 0 ? (
          <ChartCard
            title="Progreso de conclusión (enviada)"
            subtitle={`Anillo: porcentaje de memos concluidos sobre el total enviado${isDivisionStats ? ' (solo su división)' : ''}`}
            minH="300px"
          >
            <Box position="relative" h="240px">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ringConclusionData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius="68%"
                    outerRadius="88%"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={0}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {ringConclusionData.map((_, i) => (
                      <Cell key={i} fill={ringConclusionData[i].fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
              <VStack
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                spacing={0}
                pointerEvents="none"
              >
                <ChakraText fontSize="3xl" fontWeight="800" color={BRAND} lineHeight="1">
                  {conclusionPct}%
                </ChakraText>
                <ChakraText fontSize="xs" color="gray.500">
                  concluidos
                </ChakraText>
              </VStack>
            </Box>
          </ChartCard>
        ) : can('corr_sent.read') ? (
          <ChartCard title="Progreso de conclusión (enviada)" subtitle="Sin memos enviados aún">
            <ChakraText color="gray.500" fontSize="sm">
              Los gráficos de anillo aparecerán cuando existan registros.
            </ChakraText>
          </ChartCard>
        ) : null}

        {can('assets.read') && assetsSummary?.summary && Number(assetsSummary.summary.total) > 0 ? (
          <ChartCard
            title="Asignación de bienes"
            subtitle={`Anillo: bienes con persona asignada vs inventario total${isDivisionStats ? ' (solo su división)' : ''}`}
            minH="300px"
          >
            <Box position="relative" h="240px">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ringAssignmentData}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius="68%"
                    outerRadius="88%"
                    startAngle={90}
                    endAngle={-270}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {ringAssignmentData.map((_, i) => (
                      <Cell key={i} fill={ringAssignmentData[i].fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
              <VStack
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                spacing={0}
                pointerEvents="none"
              >
                <ChakraText fontSize="3xl" fontWeight="800" color={BRAND} lineHeight="1">
                  {assignmentPct}%
                </ChakraText>
                <ChakraText fontSize="xs" color="gray.500">
                  asignados
                </ChakraText>
              </VStack>
            </Box>
          </ChartCard>
        ) : can('assets.read') ? (
          <ChartCard title="Asignación de bienes" subtitle="Sin bienes registrados">
            <ChakraText color="gray.500" fontSize="sm">
              Agregue bienes en el módulo correspondiente para ver el anillo de asignación.
            </ChakraText>
          </ChartCard>
        ) : null}
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={6}>
        {can('corr_sent.read') && sentBarData.length > 0 ? (
          <ChartCard
            title="Correspondencia enviada"
            subtitle={`Barras por estado de gestión${isDivisionStats ? ' (solo su división)' : ''}`}
            minH="320px"
          >
            <Box h="260px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentBarData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'rgba(197, 48, 48, 0.06)' }} />
                  <Bar dataKey="total" name="Cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {sentBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        ) : null}

        {can('corr_recv.read') && receivedBarData.length > 0 ? (
          <ChartCard
            title="Correspondencia recibida"
            subtitle={`Barras por estado de gestión${isDivisionStats ? ' (solo su división)' : ''}`}
            minH="320px"
          >
            <Box h="260px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={receivedBarData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'rgba(197, 48, 48, 0.06)' }} />
                  <Bar dataKey="total" name="Cantidad" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {receivedBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        ) : null}

        {can('assets.read') && assetsByTypeData.length > 0 ? (
          <ChartCard
            title="Bienes por tipo"
            subtitle={`Distribución por tipo de bien${isDivisionStats ? ' (solo su división)' : ''}`}
            minH="320px"
          >
            <Box h="260px">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={assetsByTypeData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<BarTooltipContent />} cursor={{ fill: 'rgba(197, 48, 48, 0.06)' }} />
                  <Bar dataKey="total" name="Cantidad" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {assetsByTypeData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        ) : null}
      </SimpleGrid>

      {(can('corr_sent.read') || can('assets.read')) && (
        <>
          <Divider my={10} borderColor="gray.200" />
          <ChartCard title="Leyenda rápida" subtitle="Cómo leer el tablero" minH="auto">
            <VStack align="stretch" spacing={2} fontSize="sm" color="gray.600">
              <ChakraText>
                • <strong>Anillos:</strong> muestran un porcentaje sobre el total (conclusión de memos enviados y grado de
                asignación de bienes).
              </ChakraText>
              <ChakraText>
                • <strong>Barras:</strong> comparan totales por categoría (gestión o tipo de bien).
              </ChakraText>
              <ChakraText>
                • Los datos dependen de sus permisos; si falta un gráfico, es normal en su perfil.
                {isDivisionStats ? ' Con división asignada, los totales no incluyen otras dependencias.' : ''}
              </ChakraText>
            </VStack>
          </ChartCard>
        </>
      )}
    </Box>
  );
}
