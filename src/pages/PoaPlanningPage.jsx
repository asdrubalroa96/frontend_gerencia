import {
  Badge,
  Box,
  Button,
  Divider,
  Checkbox,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text as ChakraText,
  Textarea,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';
import PoaStatsCharts from '../components/PoaStatsCharts.jsx';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function sum12(a) {
  if (!Array.isArray(a)) return 0;
  return a.reduce((s, n) => s + (Math.max(0, Math.floor(Number(n)) || 0)), 0);
}

function recomputeActivity(act) {
  const tp = sum12(act.planned_months);
  const te = sum12(act.executed_months);
  return {
    ...act,
    total_planned: tp,
    total_executed: te,
    compliance_pct: tp > 0 ? Math.round((te / tp) * 10000) / 100 : null,
  };
}

function filterMatrixByActivityId(matrix, activityId) {
  if (!activityId) return matrix || [];
  return (matrix || [])
    .map((obj) => ({
      ...obj,
      activities: (obj.activities || []).filter((a) => a.id === activityId),
    }))
    .filter((obj) => obj.activities.length > 0);
}

function computeStats(matrix, monthIdx) {
  let planned = 0;
  let executed = 0;
  let acts = 0;
  let actsOk = 0;
  for (const obj of matrix || []) {
    for (const a of obj.activities || []) {
      acts += 1;
      const p = monthIdx == null ? sum12(a.planned_months) : Number(a.planned_months?.[monthIdx] || 0);
      const e = monthIdx == null ? sum12(a.executed_months) : Number(a.executed_months?.[monthIdx] || 0);
      planned += p;
      executed += e;
      if (p > 0 && e >= p) actsOk += 1;
    }
  }
  const pct = planned > 0 ? Math.round((executed / planned) * 10000) / 100 : null;
  return { planned, executed, pct, acts, actsOk };
}

export default function PoaPlanningPage() {
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [catalogDivisions, setCatalogDivisions] = useState([]);
  const [divisionId, setDivisionId] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [activityStatsFilter, setActivityStatsFilter] = useState('');

  const [planForm, setPlanForm] = useState({ title: '', description: '' });
  const [plan, setPlan] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [addingObjective, setAddingObjective] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);

  const [newObjective, setNewObjective] = useState({ code: '', title: '' });
  const [newActivity, setNewActivity] = useState({
    objectiveId: '',
    activityCode: '',
    description: '',
    detail: '',
    bulkMode: false,
  });

  useEffect(() => {
    client
      .get('/api/public/divisions')
      .then((r) => setCatalogDivisions(r.data || []))
      .catch(() => setCatalogDivisions([]));
  }, []);

  const loadYear = useCallback(
    async (y) => {
      if (!divisionId) return;
      const { data } = await client.get(`/api/poa/plans/${y}`, { params: { divisionId } });
      setPlan(data.plan);
      setMatrix(data.matrix || []);
      if (data.plan) {
        setPlanForm({ title: data.plan.title, description: data.plan.description || '' });
      } else {
        setPlanForm({ title: `POA ${y}`, description: '' });
      }
      const m = data.matrix || [];
      if (m.length) {
        setNewActivity((a) => ({
          ...a,
          objectiveId: a.objectiveId && m.some((o) => o.id === a.objectiveId) ? a.objectiveId : m[0].id,
        }));
      } else {
        setNewActivity((a) => ({ ...a, objectiveId: '' }));
      }
    },
    [divisionId]
  );

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportMatrix = async (kind) => {
    try {
      if (!divisionId) return;
      const endpoint = kind === 'pdf' ? '/api/reports/poa-matrix.pdf' : '/api/reports/poa-matrix.xlsx';
      const filename = kind === 'pdf' ? `poa_matriz_${year}.pdf` : `poa_matriz_${year}.xlsx`;
      const res = await client.get(endpoint, { params: { divisionId, year }, responseType: 'blob' });
      downloadBlob(res.data, filename);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  useEffect(() => {
    if (!divisionId) return;
    loadYear(year).catch(() => {});
  }, [year, divisionId, loadYear]);

  const flatActivities = useMemo(() => {
    const out = [];
    for (const obj of matrix || []) {
      for (const a of obj.activities || []) {
        out.push({
          id: a.id,
          label: `${obj.code}${a.activity_code ? `-${a.activity_code}` : ''} — ${a.description}`,
        });
      }
    }
    return out;
  }, [matrix]);

  const matrixForStats = useMemo(
    () => filterMatrixByActivityId(matrix, activityStatsFilter),
    [matrix, activityStatsFilter]
  );

  const stats = useMemo(() => {
    const mi = monthFilter === '' ? null : Number(monthFilter);
    return computeStats(matrixForStats, Number.isFinite(mi) ? mi : null);
  }, [matrixForStats, monthFilter]);

  const statsChartsHint = useMemo(() => {
    const parts = [];
    parts.push(activityStatsFilter ? 'Actividad filtrada' : 'Todas las actividades');
    parts.push(
      monthFilter !== ''
        ? `Indicadores numéricos (arriba): ${MONTH_LABELS[Number(monthFilter)]}`
        : 'Indicadores numéricos (arriba): total anual'
    );
    parts.push('Gráficos: evolución por mes con el mismo filtro de actividad');
    return parts.join(' · ');
  }, [activityStatsFilter, monthFilter]);

  const savePlan = async () => {
    try {
      const { data } = await client.post(
        '/api/poa/plans',
        { year, title: planForm.title, description: planForm.description },
        { params: { divisionId } }
      );
      setPlan(data);
      toast({ title: 'Plan guardado', status: 'success' });
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  const updatePlanned = (oi, ai, mi, rawVal) => {
    const v = Math.max(0, Math.floor(Number(rawVal) || 0));
    setMatrix((m) => {
      const next = JSON.parse(JSON.stringify(m));
      const act = next[oi].activities[ai];
      act.planned_months[mi] = v;
      Object.assign(act, recomputeActivity(act));
      return next;
    });
  };

  const updateDetail = (oi, ai, detail) => {
    setMatrix((m) => {
      const next = JSON.parse(JSON.stringify(m));
      next[oi].activities[ai].detail = detail;
      return next;
    });
  };

  const addObjective = async () => {
    const code = newObjective.code.trim();
    const title = newObjective.title.trim();
    if (!code || !title) {
      toast({ title: 'Complete código y título del objetivo', status: 'warning' });
      return;
    }
    setAddingObjective(true);
    try {
      await client.post(`/api/poa/plans/${year}/objectives`, { code, title }, { params: { divisionId } });
      toast({ title: 'Objetivo creado', status: 'success' });
      setNewObjective({ code: '', title: '' });
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setAddingObjective(false);
    }
  };

  const addMatrixActivityRow = async () => {
    if (!newActivity.objectiveId) {
      toast({ title: 'Seleccione el objetivo', status: 'warning' });
      return;
    }
    const description = newActivity.description.trim();
    if (!description) {
      toast({ title: 'La descripción de la actividad es obligatoria', status: 'warning' });
      return;
    }
    setAddingActivity(true);
    try {
      await client.post(
        `/api/poa/objectives/${newActivity.objectiveId}/matrix-activities`,
        {
          activityCode: newActivity.activityCode.trim() || undefined,
          description,
          detail: newActivity.detail.trim() || undefined,
          bulkMode: Boolean(newActivity.bulkMode),
        },
        { params: { divisionId } }
      );
      toast({ title: 'Actividad agregada', status: 'success' });
      setNewActivity((a) => ({ ...a, activityCode: '', description: '', detail: '', bulkMode: false }));
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setAddingActivity(false);
    }
  };

  const removeObjective = async (obj) => {
    if (!window.confirm(`¿Eliminar el objetivo ${obj.code} y todas sus actividades?`)) return;
    try {
      await client.delete(`/api/poa/objectives/${obj.id}`);
      toast({ title: 'Objetivo eliminado', status: 'success' });
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  const removeMatrixActivity = async (act) => {
    if (!window.confirm('¿Eliminar esta actividad de la matriz?')) return;
    try {
      await client.delete(`/api/poa/matrix-activities/${act.id}`);
      toast({ title: 'Actividad eliminada', status: 'success' });
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  const saveMatrix = async () => {
    if (!plan || !matrix.length) return;
    setSavingMatrix(true);
    try {
      const tasks = [];
      for (const obj of matrix) {
        for (const act of obj.activities) {
          tasks.push(
            client.patch(`/api/poa/matrix-activities/${act.id}`, {
              planned_months: act.planned_months,
              detail: act.detail ?? '',
            })
          );
        }
      }
      await Promise.all(tasks);
      toast({ title: 'Matriz guardada', status: 'success' });
      await loadYear(year);
    } catch (err) {
      toast({ title: 'Error al guardar', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setSavingMatrix(false);
    }
  };

  return (
    <Box>
      <Heading size="md" mb={4}>
        POA — Planificación (Admin)
      </Heading>

      <HStack mb={4} spacing={4} align="flex-end" flexWrap="wrap">
        <FormControl maxW="360px" isRequired>
          <FormLabel>División</FormLabel>
          <Select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} placeholder="Seleccione división">
            {catalogDivisions.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl maxW="140px">
          <FormLabel>Año</FormLabel>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </FormControl>
        <Button onClick={() => loadYear(year)} isDisabled={!divisionId}>
          Cargar
        </Button>
        <Button variant="outline" onClick={() => exportMatrix('pdf')} isDisabled={!divisionId}>
          Exportar matriz (PDF)
        </Button>
        <Button variant="outline" onClick={() => exportMatrix('xlsx')} isDisabled={!divisionId}>
          Exportar matriz (Excel)
        </Button>
      </HStack>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <ChakraText fontWeight="600" mb={2}>
          Estadísticas de cumplimiento{' '}
          {activityStatsFilter ? '(actividad seleccionada) ' : ''}
          {monthFilter === '' ? '(total anual)' : `(${MONTH_LABELS[Number(monthFilter)]})`}
        </ChakraText>
        <HStack spacing={3} flexWrap="wrap" align="flex-start">
          <FormControl maxW="320px">
            <FormLabel>Actividad (estadísticas)</FormLabel>
            <Select value={activityStatsFilter} onChange={(e) => setActivityStatsFilter(e.target.value)}>
              <option value="">Todas las actividades</option>
              {flatActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl maxW="220px">
            <FormLabel>Filtrar por mes</FormLabel>
            <Select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
              <option value="">Total anual</option>
              {MONTH_LABELS.map((m, i) => (
                <option key={m} value={String(i)}>
                  {m}
                </option>
              ))}
            </Select>
          </FormControl>
          <Badge colorScheme="purple">Planificado: {stats.planned}</Badge>
          <Badge colorScheme="blue">Ejecutado: {stats.executed}</Badge>
          <Badge colorScheme={stats.pct != null && stats.pct >= 100 ? 'green' : 'yellow'}>
            Cumplimiento: {stats.pct != null ? `${stats.pct}%` : '—'}
          </Badge>
          <Badge colorScheme="gray">
            Actividades: {stats.acts} · Cumplidas: {stats.actsOk}
          </Badge>
        </HStack>
        {divisionId ? <PoaStatsCharts matrix={matrixForStats} stats={stats} filterHint={statsChartsHint} /> : null}
      </Box>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <ChakraText fontWeight="600" mb={2}>
          Datos del plan
        </ChakraText>
        <VStack align="stretch" spacing={3}>
          <FormControl isRequired>
            <FormLabel>Título</FormLabel>
            <Input value={planForm.title} onChange={(e) => setPlanForm((f) => ({ ...f, title: e.target.value }))} />
          </FormControl>
          <FormControl>
            <FormLabel>Descripción</FormLabel>
            <Textarea
              value={planForm.description}
              onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
            />
          </FormControl>
          <Button colorScheme="brand" alignSelf="flex-start" onClick={savePlan} isDisabled={!divisionId}>
            Guardar plan
          </Button>
        </VStack>
      </Box>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        {!plan && (
          <Box bg="orange.50" borderLeftWidth="4px" borderLeftColor="orange.400" py={3} px={4} borderRadius="md" mb={3}>
            <ChakraText fontWeight="700" fontSize="sm" color="gray.800">
              Primero cree el plan
            </ChakraText>
            <ChakraText fontSize="sm" color="gray.700" mt={2}>
              1. Seleccione la división y el año.
            </ChakraText>
            <ChakraText fontSize="sm" color="gray.700" mt={1}>
              2. Pulse <strong>Guardar plan</strong>.
            </ChakraText>
          </Box>
        )}

        {plan && (
          <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p={4} mb={4} bg="gray.50">
            <ChakraText fontWeight="700" fontSize="sm" mb={3}>
              Registrar planificación (objetivos y actividades)
            </ChakraText>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="flex-start">
              <Box>
                <ChakraText fontSize="sm" fontWeight="600" mb={2} color="gray.700">
                  Nuevo objetivo
                </ChakraText>
                <VStack align="stretch" spacing={2}>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Código del objetivo</FormLabel>
                    <Input
                      size="sm"
                      placeholder="Ej. 102201"
                      value={newObjective.code}
                      onChange={(e) => setNewObjective((o) => ({ ...o, code: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Título / descripción del objetivo</FormLabel>
                    <Textarea
                      size="sm"
                      rows={3}
                      placeholder="Texto del objetivo"
                      value={newObjective.title}
                      onChange={(e) => setNewObjective((o) => ({ ...o, title: e.target.value }))}
                    />
                  </FormControl>
                  <Button size="sm" colorScheme="brand" alignSelf="flex-start" onClick={addObjective} isLoading={addingObjective}>
                    Añadir objetivo
                  </Button>
                </VStack>
              </Box>
              <Box>
                <ChakraText fontSize="sm" fontWeight="600" mb={2} color="gray.700">
                  Nueva actividad
                </ChakraText>
                <VStack align="stretch" spacing={2}>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Objetivo padre</FormLabel>
                    <Select
                      size="sm"
                      placeholder={matrix.length ? 'Seleccione objetivo' : 'Primero añada un objetivo'}
                      value={newActivity.objectiveId}
                      isDisabled={!matrix.length}
                      onChange={(e) => setNewActivity((a) => ({ ...a, objectiveId: e.target.value }))}
                    >
                      {matrix.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} — {o.title.slice(0, 60)}
                          {o.title.length > 60 ? '…' : ''}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Código de actividad (opcional)</FormLabel>
                    <Input
                      size="sm"
                      placeholder="Ej. 01"
                      value={newActivity.activityCode}
                      onChange={(e) => setNewActivity((a) => ({ ...a, activityCode: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Descripción de la actividad</FormLabel>
                    <Textarea
                      size="sm"
                      rows={3}
                      placeholder="Qué se ejecuta o mide"
                      value={newActivity.description}
                      onChange={(e) => setNewActivity((a) => ({ ...a, description: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Detalle inicial (opcional)</FormLabel>
                    <Textarea
                      size="sm"
                      rows={2}
                      placeholder="Observaciones previas"
                      value={newActivity.detail}
                      onChange={(e) => setNewActivity((a) => ({ ...a, detail: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <Checkbox
                      isChecked={Boolean(newActivity.bulkMode)}
                      onChange={(e) => setNewActivity((a) => ({ ...a, bulkMode: e.target.checked }))}
                    >
                      Carga múltiple (operador sube 1 PDF con resumen y coloca cantidad)
                    </Checkbox>
                  </FormControl>
                  <Button
                    size="sm"
                    colorScheme="brand"
                    alignSelf="flex-start"
                    onClick={addMatrixActivityRow}
                    isLoading={addingActivity}
                    isDisabled={!matrix.length}
                  >
                    Añadir actividad
                  </Button>
                </VStack>
              </Box>
            </SimpleGrid>
          </Box>
        )}

        {plan && matrix.length > 0 ? (
          <>
            <Box overflowX="auto" borderWidth="1px" borderRadius="md" borderColor="gray.200">
              <Table size="sm" minW="1100px">
                <Thead>
                  <Tr>
                    <Th minW="240px" verticalAlign="bottom">
                      Objetivo / actividad
                    </Th>
                    {MONTH_LABELS.map((lab) => (
                      <Th key={lab} px={1} textAlign="center" fontSize="10px" whiteSpace="nowrap">
                        {lab}
                        <br />
                        <ChakraText as="span" fontWeight="400" color="gray.500">
                          P / E
                        </ChakraText>
                      </Th>
                    ))}
                    <Th isNumeric whiteSpace="nowrap">
                      Σ plan
                    </Th>
                    <Th isNumeric whiteSpace="nowrap">
                      Σ ejec
                    </Th>
                    <Th whiteSpace="nowrap">% cumpl.</Th>
                    <Th minW="180px">Detalle</Th>
                    <Th minW="100px">Acciones</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {matrix.map((obj, oi) => (
                    <Fragment key={obj.id}>
                      <Tr bg="gray.100">
                        <Td colSpan={18} py={2}>
                          <HStack justify="space-between" align="flex-start" spacing={3}>
                            <Box>
                              <ChakraText fontWeight="700" fontSize="sm">
                                {obj.code}
                              </ChakraText>
                              <ChakraText fontSize="sm" mt={1}>
                                {obj.title}
                              </ChakraText>
                            </Box>
                            <Button size="xs" colorScheme="red" variant="outline" onClick={() => removeObjective(obj)}>
                              Eliminar objetivo
                            </Button>
                          </HStack>
                        </Td>
                      </Tr>
                      {obj.activities.map((act, ai) => (
                        <Tr key={act.id}>
                          <Td verticalAlign="top" fontSize="xs">
                            {act.activity_code && (
                              <Badge mr={1} colorScheme="gray" fontSize="0.65em">
                                {act.activity_code}
                              </Badge>
                            )}
                            {act.description}
                          </Td>
                          {MONTH_LABELS.map((_, mi) => (
                            <Td key={mi} px={1} verticalAlign="top">
                              <VStack spacing={0} align="stretch">
                                <Input
                                  size="xs"
                                  type="number"
                                  min={0}
                                  textAlign="center"
                                  px={1}
                                  title="Planificado (meta mensual)"
                                  value={act.planned_months?.[mi] ?? 0}
                                  onChange={(e) => updatePlanned(oi, ai, mi, e.target.value)}
                                />
                                <Input
                                  size="xs"
                                  type="number"
                                  min={0}
                                  textAlign="center"
                                  px={1}
                                  mt={1}
                                  title="Ejecutado en el mes (automático)"
                                  value={act.executed_months?.[mi] ?? 0}
                                  isReadOnly
                                />
                              </VStack>
                            </Td>
                          ))}
                          <Td isNumeric fontWeight="600" verticalAlign="middle">
                            {act.total_planned}
                          </Td>
                          <Td isNumeric fontWeight="600" verticalAlign="middle">
                            {act.total_executed}
                          </Td>
                          <Td verticalAlign="middle">
                            {act.compliance_pct != null ? (
                              <Badge
                                colorScheme={act.compliance_pct >= 100 ? 'green' : act.compliance_pct >= 70 ? 'yellow' : 'red'}
                              >
                                {act.compliance_pct}%
                              </Badge>
                            ) : (
                              <ChakraText fontSize="xs" color="gray.500">
                                —
                              </ChakraText>
                            )}
                          </Td>
                          <Td verticalAlign="top">
                            <Textarea
                              size="xs"
                              rows={3}
                              value={act.detail ?? ''}
                              placeholder="Observaciones…"
                              onChange={(e) => updateDetail(oi, ai, e.target.value)}
                            />
                          </Td>
                          <Td verticalAlign="middle">
                            <Button size="xs" colorScheme="red" variant="ghost" onClick={() => removeMatrixActivity(act)}>
                              Eliminar
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Fragment>
                  ))}
                </Tbody>
              </Table>
            </Box>
            <Button mt={3} colorScheme="brand" onClick={saveMatrix} isLoading={savingMatrix} loadingText="Guardando">
              Guardar matriz (metas y detalles)
            </Button>
          </>
        ) : (
          plan && (
            <ChakraText fontSize="sm" color="gray.600">
              Plan guardado para {year}. Cree objetivos y actividades para comenzar.
            </ChakraText>
          )
        )}
      </Box>
    </Box>
  );
}

