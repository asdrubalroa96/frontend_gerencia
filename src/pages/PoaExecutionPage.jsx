import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
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
import { useAuth } from '../context/AuthContext.jsx';
import PoaStatsCharts from '../components/PoaStatsCharts.jsx';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function sum12(a) {
  if (!Array.isArray(a)) return 0;
  return a.reduce((s, n) => s + (Math.max(0, Math.floor(Number(n)) || 0)), 0);
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

function formatDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function PoaExecutionPage() {
  const toast = useToast();
  const { user, isAdmin } = useAuth();

  const [year, setYear] = useState(new Date().getFullYear());
  const [catalogDivisions, setCatalogDivisions] = useState([]);
  const [divisionId, setDivisionId] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [activityStatsFilter, setActivityStatsFilter] = useState('');

  const [plan, setPlan] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal de ejecución (selecciona actividad, fecha, descripción, pdf)
  const [execOpen, setExecOpen] = useState(false);
  const [execSubmitting, setExecSubmitting] = useState(false);
  const [execForm, setExecForm] = useState({
    matrixActivityId: '',
    executedAt: formatDateInput(new Date()),
    description: '',
    tasksCount: '1',
    file: null,
  });

  // Historial al hacer clic en el número ejecutado (por mes)
  const [historyModal, setHistoryModal] = useState({
    open: false,
    activityId: null,
    monthIdx: null,
    activityLabel: '',
  });
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDeletingId, setHistoryDeletingId] = useState(null);

  // Previsualización del PDF
  const [pdfPreview, setPdfPreview] = useState({ open: false, path: '' });

  // En vista Despacho no hay divisionId "fija" (scope null), por eso debe poder seleccionar división.
  const isGlobal = Boolean(user?.role === 'admin' || user?.divisionGlobalScope || user?.divisionId == null);

  useEffect(() => {
    if (!user) return;
    if (!isGlobal) {
      setDivisionId(user?.divisionId != null ? String(user.divisionId) : '');
      return;
    }
    client
      .get('/api/public/divisions')
      .then((r) => setCatalogDivisions(r.data || []))
      .catch(() => setCatalogDivisions([]));
  }, [user, isGlobal]);

  const loadYear = useCallback(
    async (y) => {
      if (!divisionId) return;
      setLoading(true);
      try {
        const params = isGlobal ? { divisionId } : {};
        const { data } = await client.get(`/api/poa/plans/${y}`, { params });
        setPlan(data.plan);
        setMatrix(data.matrix || []);
      } catch (err) {
        setPlan(null);
        setMatrix([]);
        toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
      } finally {
        setLoading(false);
      }
    },
    [divisionId, isGlobal, toast]
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
      const params = isGlobal ? { divisionId, year } : { year };
      const res = await client.get(endpoint, { params, responseType: 'blob' });
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
          bulk_mode: Boolean(a.bulk_mode),
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

  const openExecutionModal = async () => {
    if (!plan) {
      toast({ title: 'No existe planificación para este año', status: 'warning' });
      return;
    }
    setExecForm((f) => ({
      ...f,
      matrixActivityId: f.matrixActivityId || flatActivities[0]?.id || '',
      executedAt: formatDateInput(new Date(year, new Date().getMonth(), new Date().getDate())),
      description: '',
      file: null,
    }));
    setExecOpen(true);
  };

  const closeExecutionModal = () => {
    setExecOpen(false);
    setExecSubmitting(false);
    setExecForm({ matrixActivityId: '', executedAt: formatDateInput(new Date()), description: '', file: null });
  };

  const openHistoryFromCell = async (act, obj, monthIdx) => {
    const label = `${obj.code}${act.activity_code ? `-${act.activity_code}` : ''} — ${act.description}`;
    setHistoryModal({ open: true, activityId: act.id, monthIdx, activityLabel: label });
    setHistoryLoading(true);
    setHistoryList([]);
    try {
      const params = isGlobal ? { divisionId } : {};
      const { data } = await client.get(`/api/poa/matrix-activities/${act.id}/executions`, { params });
      const raw = data || [];
      const filtered =
        monthIdx == null || !Number.isFinite(Number(monthIdx))
          ? raw
          : raw.filter((r) => new Date(r.executed_at || r.created_at).getMonth() === Number(monthIdx));
      setHistoryList(filtered);
    } catch (err) {
      setHistoryList([]);
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryModal({ open: false, activityId: null, monthIdx: null, activityLabel: '' });
    setHistoryList([]);
    setHistoryLoading(false);
    setHistoryDeletingId(null);
  };

  const deleteHistoryExecution = async (execId) => {
    if (!window.confirm('¿Eliminar este registro de ejecución? El contador del mes se reducirá en 1.')) return;
    setHistoryDeletingId(execId);
    try {
      const params = isGlobal ? { divisionId } : {};
      await client.delete(`/api/poa/activity-executions/${execId}`, { params });
      toast({ title: 'Ejecución eliminada', status: 'success' });
      await loadYear(year);
      const aid = historyModal.activityId;
      const mid = historyModal.monthIdx;
      if (aid) {
        setHistoryLoading(true);
        try {
          const params2 = isGlobal ? { divisionId } : {};
          const { data } = await client.get(`/api/poa/matrix-activities/${aid}/executions`, { params: params2 });
          const raw = data || [];
          const filtered =
            mid == null || !Number.isFinite(Number(mid))
              ? raw
              : raw.filter((r) => new Date(r.executed_at || r.created_at).getMonth() === Number(mid));
          setHistoryList(filtered);
        } finally {
          setHistoryLoading(false);
        }
      }
      setPdfPreview({ open: false, path: '' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setHistoryDeletingId(null);
    }
  };

  const submitExecution = async () => {
    if (!execForm.matrixActivityId) {
      toast({ title: 'Seleccione la actividad', status: 'warning' });
      return;
    }
    if (!execForm.executedAt) {
      toast({ title: 'Indique la fecha de ejecución', status: 'warning' });
      return;
    }
    const description = execForm.description.trim();
    if (!description) {
      toast({ title: 'Indique la acción / descripción', status: 'warning' });
      return;
    }
    const selectedAct = flatActivities.find((a) => a.id === execForm.matrixActivityId);
    const bulkMode = Boolean(selectedAct?.bulk_mode);
    const tasksCount = Math.max(1, Math.floor(Number(execForm.tasksCount) || 1));
    if (bulkMode && tasksCount < 1) {
      toast({ title: 'Indique la cantidad de tareas', status: 'warning' });
      return;
    }
    if (!execForm.file) {
      toast({ title: 'Adjunte un PDF', status: 'warning' });
      return;
    }
    setExecSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('description', description);
      fd.append('executedAt', execForm.executedAt);
      fd.append('tasksCount', String(tasksCount));
      fd.append('pdf', execForm.file);
      await client.post(`/api/poa/matrix-activities/${execForm.matrixActivityId}/executions`, fd, {
        params: isGlobal ? { divisionId } : {},
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: 'Ejecución registrada', status: 'success' });
      await loadYear(year); // refresca ejecutado por mes (sumado por fecha)
      setExecForm((f) => ({ ...f, description: '', tasksCount: '1', file: null }));
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setExecSubmitting(false);
    }
  };

  return (
    <Box>
      <Heading size="md" mb={4}>
        POA — Ejecución de actividades
      </Heading>

      <HStack mb={4} spacing={4} align="flex-end" flexWrap="wrap">
        {isGlobal ? (
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
        ) : (
          <Box>
            <ChakraText fontSize="sm" color="gray.600">
              División
            </ChakraText>
            <ChakraText fontWeight="600">{user?.divisionName || '—'}</ChakraText>
          </Box>
        )}

        <FormControl maxW="140px">
          <FormLabel>Año</FormLabel>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </FormControl>

        {isAdmin ? (
          <Button onClick={() => loadYear(year)} isDisabled={!divisionId} isLoading={loading}>
            Cargar
          </Button>
        ) : null}

        <Button colorScheme="brand" onClick={openExecutionModal} isDisabled={!plan || !matrix.length}>
          Registrar ejecución (PDF)
        </Button>

        <Button variant="outline" onClick={() => exportMatrix('pdf')} isDisabled={!divisionId}>
          Exportar matriz (PDF)
        </Button>
        <Button variant="outline" onClick={() => exportMatrix('xlsx')} isDisabled={!divisionId}>
          Exportar matriz (Excel)
        </Button>
      </HStack>

      {!plan ? (
        <Box bg="orange.50" borderLeftWidth="4px" borderLeftColor="orange.400" py={3} px={4} borderRadius="md" mb={4}>
          <ChakraText fontWeight="700" fontSize="sm" color="gray.800">
            No hay planificación para {year}
          </ChakraText>
          <ChakraText fontSize="sm" color="gray.700" mt={2}>
            La planificación anual del POA solo puede crearla/editarla el <strong>Admin</strong>.
          </ChakraText>
        </Box>
      ) : null}

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <ChakraText fontWeight="600" mb={2}>
          Estadísticas de cumplimiento
          {activityStatsFilter ? ' · actividad seleccionada' : ''}
          {monthFilter === '' ? ' · total anual' : ` · ${MONTH_LABELS[Number(monthFilter)]}`}
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

      {plan && matrix.length > 0 ? (
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm">
          <ChakraText fontWeight="600" mb={2}>
            Matriz POA (solo lectura)
          </ChakraText>
          <Divider mb={4} />
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
                </Tr>
              </Thead>
              <Tbody>
                {matrix.map((obj) => (
                  <Fragment key={obj.id}>
                    <Tr bg="gray.100">
                      <Td colSpan={18} py={2}>
                        <ChakraText fontWeight="700" fontSize="sm">
                          {obj.code}
                        </ChakraText>
                        <ChakraText fontSize="sm" mt={1}>
                          {obj.title}
                        </ChakraText>
                      </Td>
                    </Tr>
                    {obj.activities.map((act) => {
                      const tp = sum12(act.planned_months);
                      const te = sum12(act.executed_months);
                      const pct = tp > 0 ? Math.round((te / tp) * 10000) / 100 : null;
                      return (
                        <Tr key={act.id}>
                          <Td verticalAlign="top" fontSize="xs">
                            {act.activity_code ? (
                              <Badge mr={1} colorScheme="gray" fontSize="0.65em">
                                {act.activity_code}
                              </Badge>
                            ) : null}
                            {act.description}
                          </Td>
                          {MONTH_LABELS.map((_, mi) => {
                            const ev = Number(act.executed_months?.[mi] ?? 0);
                            return (
                              <Td key={mi} px={1} verticalAlign="top">
                                <VStack spacing={0} align="stretch">
                                  <Input size="xs" value={act.planned_months?.[mi] ?? 0} isReadOnly textAlign="center" />
                                  {ev > 0 ? (
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      h="24px"
                                      minH="24px"
                                      fontWeight="700"
                                      colorScheme="blue"
                                      onClick={() => openHistoryFromCell(act, obj, mi)}
                                      title="Ver historial de ejecuciones de este mes"
                                    >
                                      {ev}
                                    </Button>
                                  ) : (
                                    <ChakraText fontSize="xs" textAlign="center" mt={1} color="gray.600">
                                      {ev}
                                    </ChakraText>
                                  )}
                                </VStack>
                              </Td>
                            );
                          })}
                          <Td isNumeric fontWeight="600" verticalAlign="middle">
                            {tp}
                          </Td>
                          <Td isNumeric fontWeight="600" verticalAlign="middle">
                            {te}
                          </Td>
                          <Td verticalAlign="middle">
                            {pct != null ? (
                              <Badge colorScheme={pct >= 100 ? 'green' : pct >= 70 ? 'yellow' : 'red'}>{pct}%</Badge>
                            ) : (
                              <ChakraText fontSize="xs" color="gray.500">
                                —
                              </ChakraText>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </Fragment>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      ) : null}

      <Modal isOpen={execOpen} onClose={closeExecutionModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Registrar ejecución</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ChakraText fontSize="sm" color="gray.600" mb={3}>
              Seleccione la actividad, indique la fecha (el sistema valida el año del POA) y adjunte el PDF de soporte.
              La ejecución se suma automáticamente al mes correspondiente.
            </ChakraText>

            <FormControl isRequired mb={3}>
              <FormLabel fontSize="sm">Actividad</FormLabel>
              <Select
                value={execForm.matrixActivityId}
                onChange={(e) => setExecForm((f) => ({ ...f, matrixActivityId: e.target.value }))}
              >
                {flatActivities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            {(() => {
              const a = flatActivities.find((x) => x.id === execForm.matrixActivityId);
              if (!a?.bulk_mode) return null;
              return (
                <FormControl isRequired mb={3}>
                  <FormLabel fontSize="sm">Cantidad de tareas (resumen)</FormLabel>
                  <Input
                    type="number"
                    min={1}
                    value={execForm.tasksCount}
                    onChange={(e) => setExecForm((f) => ({ ...f, tasksCount: e.target.value }))}
                  />
                </FormControl>
              );
            })()}

            <FormControl isRequired mb={3}>
              <FormLabel fontSize="sm">Fecha de ejecución</FormLabel>
              <Input
                type="date"
                value={execForm.executedAt}
                onChange={(e) => setExecForm((f) => ({ ...f, executedAt: e.target.value }))}
              />
            </FormControl>

            <FormControl isRequired mb={3}>
              <FormLabel fontSize="sm">Acción / descripción</FormLabel>
              <Textarea
                value={execForm.description}
                onChange={(e) => setExecForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Qué se realizó, alcance, resultado..."
                rows={3}
              />
            </FormControl>

            <FormControl isRequired mb={4}>
              <FormLabel fontSize="sm">Soporte (PDF)</FormLabel>
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setExecForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button onClick={closeExecutionModal} variant="ghost" mr={2}>
              Cerrar
            </Button>
            <Button colorScheme="brand" onClick={submitExecution} isLoading={execSubmitting}>
              Guardar ejecución
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={historyModal.open} onClose={closeHistoryModal} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Historial de ejecuciones
            {historyModal.monthIdx != null && Number.isFinite(Number(historyModal.monthIdx))
              ? ` · ${MONTH_LABELS[historyModal.monthIdx]}`
              : ''}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ChakraText fontSize="sm" color="gray.600" mb={3}>
              {historyModal.activityLabel}
            </ChakraText>
            {historyLoading ? (
              <ChakraText fontSize="sm" color="gray.600">
                Cargando…
              </ChakraText>
            ) : historyList.length === 0 ? (
              <ChakraText fontSize="sm" color="gray.600">
                No hay ejecuciones registradas en este mes.
              </ChakraText>
            ) : (
              <VStack align="stretch" spacing={3}>
                {historyList.map((r) => (
                  <Box key={r.id} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
                    <ChakraText fontSize="sm" fontWeight="600">
                      {new Date(r.executed_at || r.created_at).toLocaleString()}
                    </ChakraText>
                    <ChakraText fontSize="sm" mt={1}>
                      {r.description}
                    </ChakraText>
                    <HStack mt={2} spacing={3} flexWrap="wrap">
                      <Button size="xs" variant="outline" onClick={() => setPdfPreview({ open: true, path: r.pdf_path })}>
                        Visualizar PDF
                      </Button>
                      <Link href={`/uploads/${r.pdf_path}`} isExternal fontSize="sm" color="blue.600">
                        Abrir en otra pestaña
                      </Link>
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="outline"
                        isLoading={historyDeletingId === r.id}
                        onClick={() => deleteHistoryExecution(r.id)}
                      >
                        Eliminar
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={closeHistoryModal} variant="ghost">
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={pdfPreview.open} onClose={() => setPdfPreview({ open: false, path: '' })} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>PDF de soporte</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {pdfPreview.path ? (
              <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" overflow="hidden" h="70vh">
                <Box
                  as="iframe"
                  title="PDF"
                  src={`/uploads/${pdfPreview.path}`}
                  w="100%"
                  h="70vh"
                  style={{ border: '0' }}
                />
              </Box>
            ) : (
              <ChakraText fontSize="sm" color="gray.600">
                Sin PDF.
              </ChakraText>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setPdfPreview({ open: false, path: '' })} variant="ghost">
              Cerrar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

