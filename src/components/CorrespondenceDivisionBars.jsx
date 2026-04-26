import { Box, Text as ChakraText } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import client from '../api/client.js';

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="700">
        {row.fullName || label}
      </ChakraText>
      <ChakraText fontSize="sm" color="gray.600">
        Enviada: <strong>{row.sent}</strong> · Recibida: <strong>{row.received}</strong>
      </ChakraText>
    </Box>
  );
}

export default function CorrespondenceDivisionBars({
  title = 'Enviada vs recibida por división',
  subtitle = 'Totales institucionales (Admin): Despacho + divisiones',
}) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    client
      .get('/api/correspondence/stats/by-division')
      .then((r) => {
        if (!cancelled) setRows(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo(() => {
    return (rows || [])
      .map((r) => {
        const full = String(r.division_name || '');
        return {
          fullName: full,
          name: full.length > 18 ? `${full.slice(0, 18)}…` : full,
          sent: Number(r.sent_total) || 0,
          received: Number(r.received_total) || 0,
        };
      })
      .filter((r) => r.fullName)
      .filter((r) => r.sent > 0 || r.received > 0);
  }, [rows]);

  if (!data.length) return null;

  return (
    <Box mb={4} bg="white" borderRadius="lg" boxShadow="sm" borderWidth="1px" borderColor="gray.100" p={4}>
      <ChakraText fontWeight="700" fontSize="md" color="gray.800">
        {title}
      </ChakraText>
      {subtitle ? (
        <ChakraText fontSize="xs" color="gray.500" mb={3}>
          {subtitle}
        </ChakraText>
      ) : null}
      <Box h="280px">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 8 }} barGap={6}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={70} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip content={<TooltipContent />} />
            <Bar dataKey="sent" name="Enviada" fill="#C53030" radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Bar dataKey="received" name="Recibida" fill="#2B6CB0" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

