import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text as ChakraText,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import CorrespondenceStatsCharts from '../components/CorrespondenceStatsCharts.jsx';
import CorrespondenceDivisionBars from '../components/CorrespondenceDivisionBars.jsx';
import ExportMenuButton from '../components/ExportMenuButton.jsx';
import { managementBadgeProps, managementRowBg } from '../utils/managementVisuals.js';
import { isScopedDivisionUser } from '../utils/divisionUi.js';
import { uploadUrl } from '../utils/uploadUrl.js';

/** Filtros y listados: incluye todos los estados. */
const managementFilterOptions = [
  { value: 'informativo', label: 'Informativo' },
  { value: 'por_gestionar', label: 'Por gestionar' },
  { value: 'concluido', label: 'Concluido' },
];

/** Alta y edición: solo estos valores; “Concluido” se marca desde la tabla. */
const managementFormOptions = [
  { value: 'por_gestionar', label: 'Por gestionar' },
  { value: 'informativo', label: 'Informativo' },
];

function managementTableLabel(code) {
  const map = {
    por_gestionar: 'Por gestionar',
    informativo: 'Informativo',
    concluido: 'Concluido',
  };
  return map[code] || code;
}

/** Fila de catálogo «Despacho» (memo al nivel superior; suele tener division_id nulo). */
function isDespachoDestinationRow(d) {
  if (!d) return false;
  const n = String(d.name || '')
    .toLowerCase()
    .trim();
  return n === 'despacho';
}

/**
 * Registro y seguimiento de correspondencia enviada (memo consecutivo, PDF, gestión).
 */
export default function CorrespondenceSentPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isDivisionOnly = isScopedDivisionUser(user);
  const { isOpen, onOpen, onClose: closeModal } = useDisclosure();
  const handleCloseModal = () => {
    setSendToDespacho(false);
    setManualDestination(false);
    setCustomDestinationName('');
    setSendToAllDivisions(false);
    closeModal();
  };
  const {
    isOpen: pdfOpen,
    onOpen: onPdfOpen,
    onClose: onPdfClose,
  } = useDisclosure();
  const [pdfPreviewSrc, setPdfPreviewSrc] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState([]);
  const [catalog, setCatalog] = useState({ destinations: [], assignees: [], divisions: [] });
  /** Destinos permitidos según remitente (Despacho → divisiones; división → Despacho y otras divisiones). */
  const [routingDestinations, setRoutingDestinations] = useState([]);
  /** Solo división: envío al Despacho sin usar el desplegable de divisiones. */
  const [sendToDespacho, setSendToDespacho] = useState(false);
  /** Despacho: destino manual (externo / no listado). */
  const [manualDestination, setManualDestination] = useState(false);
  const [customDestinationName, setCustomDestinationName] = useState('');
  /** Despacho: enviar el memo a las 4 divisiones operativas. */
  const [sendToAllDivisions, setSendToAllDivisions] = useState(false);

  const [filters, setFilters] = useState({
    management: '',
    destinationId: '',
    from: '',
    to: '',
  });
  const [form, setForm] = useState({
    sentDate: '',
    destinationId: '',
    subject: '',
    management: 'por_gestionar',
    assignedUserId: '',
    pdf: null,
  });
  const [editing, setEditing] = useState(null);
  /** { nextMemoNumber, memoYear, memoLabel } desde API (numeración anual por remitente) */
  const [nextMemoPreview, setNextMemoPreview] = useState(null);

  const sentDestinationOptions = useMemo(() => {
    const base = routingDestinations.length ? routingDestinations : catalog.destinations || [];
    const list = [...base];
    const ids = new Set(list.map((d) => d.id));
    const cur = editing && form.destinationId ? Number(form.destinationId) : null;
    if (cur != null && !ids.has(cur)) {
      const extra = (catalog.destinations || []).find((d) => d.id === cur);
      if (extra) list.push(extra);
    }
    return list;
  }, [routingDestinations, catalog.destinations, editing, form.destinationId]);

  const despachoDestinationId = useMemo(() => {
    const pool = [...(routingDestinations || []), ...(catalog.destinations || [])];
    const row = pool.find((d) => isDespachoDestinationRow(d));
    return row?.id != null ? String(row.id) : null;
  }, [routingDestinations, catalog.destinations]);

  /** Opciones del desplegable: divisiones destino (sin la fila memo «Despacho»). */
  const memoDivisionSelectList = useMemo(() => {
    const raw = routingDestinations.length ? routingDestinations : catalog.destinations || [];
    const list = raw.filter((d) => !isDespachoDestinationRow(d));
    const ids = new Set(list.map((d) => Number(d.id)));
    const cur =
      editing && form.destinationId && !sendToDespacho ? Number(form.destinationId) : null;
    if (cur != null && Number.isFinite(cur) && !ids.has(cur)) {
      const extra = raw.find((d) => Number(d.id) === cur);
      if (extra && !isDespachoDestinationRow(extra)) list.push(extra);
    }
    return list;
  }, [routingDestinations, catalog.destinations, editing, form.destinationId, sendToDespacho]);

  const modalDestinationSelectOptions = isDivisionOnly ? memoDivisionSelectList : sentDestinationOptions;

  const chartStats = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const m = r.management || 'por_gestionar';
      map.set(m, (map.get(m) || 0) + 1);
    }
    return Array.from(map.entries()).map(([management, total]) => ({ management, total }));
  }, [rows]);

  const load = async (overrideFilters) => {
    const f = overrideFilters ?? filters;
    const params = {};
    if (f.management) params.management = f.management;
    if (f.destinationId) params.destinationId = f.destinationId;
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    const [listRes, statsRes, catRes] = await Promise.all([
      client.get('/api/correspondence/sent', { params }),
      client.get('/api/correspondence/sent/stats'),
      client.get('/api/catalogs'),
    ]);
    const routeRes = await client.get('/api/correspondence/destinations-for-sent').catch((err) => {
      toast({
        title: 'No se pudieron cargar los destinos',
        description: err.response?.data?.error || err.message,
        status: 'warning',
      });
      return { data: [] };
    });
    setRows(listRes.data);
    setStats(statsRes.data);
    setCatalog(catRes.data);
    setRoutingDestinations(routeRes.data || []);
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let cancelled = false;
    client
      .get('/api/correspondence/destinations-for-sent')
      .then((res) => {
        if (!cancelled) setRoutingDestinations(res.data || []);
      })
      .catch((err) => {
        if (!cancelled) {
          setRoutingDestinations([]);
          toast({
            title: 'Destinos no disponibles',
            description: err.response?.data?.error || err.message,
            status: 'error',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, toast]);

  useEffect(() => {
    if (!isOpen || editing) {
      return undefined;
    }
    let cancelled = false;
    const params = {};
    if (form.sentDate) params.asOfDate = form.sentDate;
    client
      .get('/api/correspondence/sent/next-memo-number', { params })
      .then((res) => {
        if (!cancelled) setNextMemoPreview(res.data);
      })
      .catch(() => {
        if (!cancelled) setNextMemoPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, editing, form.sentDate]);

  const pdfUrl = (path) => uploadUrl(path);

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

  const exportSentPdf = async () => {
    try {
      const params = {};
      if (filters.management) params.management = filters.management;
      if (filters.destinationId) params.destinationId = filters.destinationId;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const res = await client.get('/api/reports/correspondence-sent.pdf', { params, responseType: 'blob' });
      downloadBlob(res.data, 'correspondencia_enviada.pdf');
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const openPdfPreview = (path) => {
    const u = pdfUrl(path);
    if (!u) return;
    setPdfPreviewSrc(u);
    onPdfOpen();
  };

  const openCreate = () => {
    setEditing(null);
    setSendToDespacho(false);
    setManualDestination(false);
    setCustomDestinationName('');
    setForm({
      sentDate: '',
      destinationId: '',
      subject: '',
      management: 'por_gestionar',
      assignedUserId: '',
      pdf: null,
    });
    onOpen();
  };

  const openEdit = (row) => {
    setEditing(row);
    const toDesp =
      String(row.destination_name || '')
        .toLowerCase()
        .trim() === 'despacho';
    setSendToDespacho(toDesp);
    const destId = Number(row.destination_id);
    const pool = [...(routingDestinations || []), ...(catalog.destinations || [])];
    const known = pool.some((d) => Number(d.id) === destId);
    if (!isDivisionOnly) {
      if (!known) {
        setManualDestination(true);
        setCustomDestinationName(String(row.destination_name || '').trim());
      } else {
        setManualDestination(false);
        setCustomDestinationName('');
      }
    } else {
      setManualDestination(false);
      setCustomDestinationName('');
    }
    setForm({
      sentDate: row.sent_date?.slice(0, 10),
      destinationId: String(row.destination_id),
      subject: row.subject,
      management: row.management,
      assignedUserId: row.assigned_user_id || '',
      pdf: null,
    });
    onOpen();
  };

  const submit = async () => {
    try {
      const useManual = !isDivisionOnly && manualDestination;
      const multi = !isDivisionOnly && sendToAllDivisions;
      if (useManual) {
        const t = customDestinationName.trim();
        if (t.length < 2) {
          toast({
            title: 'Indique el destino',
            description: 'Escriba al menos 2 caracteres (destino externo o no listado).',
            status: 'warning',
          });
          return;
        }
      } else if (!multi && !form.destinationId) {
        toast({ title: 'Indique el destino del memo', status: 'warning' });
        return;
      }

      if (!editing && !form.pdf) {
        toast({
          title: 'PDF obligatorio',
          description: 'Debe adjuntar el memo en PDF para poder guardarlo.',
          status: 'warning',
        });
        return;
      }
      if (editing && !editing.pdf_path && !form.pdf) {
        toast({
          title: 'PDF obligatorio',
          description: 'Este memo no tiene PDF. Suba el archivo para poder guardar los cambios.',
          status: 'warning',
        });
        return;
      }

      const fd = new FormData();
      fd.append('sentDate', form.sentDate);
      if (multi) {
        fd.append('sendToAllDivisions', 'true');
      } else if (useManual) {
        fd.append('customDestinationName', customDestinationName.trim());
      } else {
        fd.append('destinationId', form.destinationId);
      }
      fd.append('subject', form.subject);
      fd.append('management', form.management);
      if (form.assignedUserId) fd.append('assignedUserId', form.assignedUserId);
      if (form.pdf) fd.append('pdf', form.pdf);

      if (!editing) {
        await client.post('/api/correspondence/sent', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({ title: 'Memo registrado', status: 'success' });
      } else {
        if (form.pdf) {
          await client.patch(`/api/correspondence/sent/${editing.id}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          const body = {
            sentDate: form.sentDate,
            subject: form.subject,
            assignedUserId: form.assignedUserId || null,
          };
          if (useManual) {
            body.customDestinationName = customDestinationName.trim();
          } else {
            body.destinationId = Number(form.destinationId);
          }
          if (editing.management !== 'concluido') {
            body.management = form.management;
          }
          await client.patch(`/api/correspondence/sent/${editing.id}`, body);
        }
        toast({ title: 'Registro actualizado', status: 'success' });
      }
      handleCloseModal();
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const markConcluded = async (row) => {
    try {
      await client.patch(`/api/correspondence/sent/${row.id}`, { management: 'concluido' });
      toast({ title: 'Marcado como concluido', status: 'success' });
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  return (
    <Box w="full" maxW="100%">
      <Flex
        direction={{ base: 'column', sm: 'row' }}
        align={{ base: 'stretch', sm: 'center' }}
        justify="space-between"
        gap={3}
        mb={4}
      >
        <Heading size="md">Correspondencia enviada</Heading>
        <Button colorScheme="brand" onClick={openCreate} alignSelf={{ base: 'stretch', sm: 'center' }}>
          Nuevo memo
        </Button>
      </Flex>

      {isDivisionOnly ? (
        <Box mb={4} p={3} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.100">
          <ChakraText fontSize="sm" color="gray.700">
            <strong>División:</strong> {user?.divisionName || 'Su división'}. El destino del memo define a quién se envía
            (Despacho u otra división). Los memos que envía su división quedan registrados con su adscripción.
          </ChakraText>
        </Box>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={4}>
        {stats.map((s) => (
          <Box key={s.management} p={3} bg="white" borderRadius="md" boxShadow="sm">
            <ChakraText fontSize="sm" color="gray.500">
              {s.management}
            </ChakraText>
            <ChakraText fontSize="2xl" fontWeight="700">
              {s.total}
            </ChakraText>
          </Box>
        ))}
      </SimpleGrid>

      <CorrespondenceStatsCharts
        stats={chartStats}
        title="Gráficos — correspondencia enviada"
        subtitle="Basados en el listado visible (filtros de gestión, destino y fechas). Alta y edición requieren PDF."
      />

      {!isDivisionOnly && user?.role === 'admin' ? <CorrespondenceDivisionBars /> : null}

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <ChakraText fontWeight="600" mb={2}>
          Filtros
        </ChakraText>
        <HStack spacing={3} flexWrap="wrap">
          <Select
            placeholder="Gestión"
            maxW="220px"
            value={filters.management}
            onChange={(e) => setFilters((f) => ({ ...f, management: e.target.value }))}
          >
            {managementFilterOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            placeholder="Destino"
            maxW="240px"
            value={filters.destinationId}
            onChange={(e) => setFilters((f) => ({ ...f, destinationId: e.target.value }))}
          >
            {sentDestinationOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <Button onClick={() => load()}>Aplicar</Button>
          <ExportMenuButton
            label="Exportaciones"
            options={[
              { id: 'sent_pdf', label: 'PDF', onClick: exportSentPdf },
            ]}
          />
          <Button
            variant="outline"
            onClick={async () => {
              const cleared = { management: '', destinationId: '', from: '', to: '' };
              setFilters(cleared);
              await load(cleared);
            }}
          >
            Limpiar
          </Button>
        </HStack>
      </Box>

      {rows.length === 0 ? (
        <Box bg="white" borderRadius="md" boxShadow="sm" p={6} textAlign="center" w="full">
          <ChakraText color="gray.600">No hay memos que coincidan con los filtros.</ChakraText>
        </Box>
      ) : (
        <TableContainer
          bg="white"
          borderRadius="md"
          boxShadow="sm"
          w="full"
          maxW="100%"
          overflowX="auto"
          sx={{ WebkitOverflowScrolling: 'touch' }}
        >
          <Table
            size="sm"
            variant="simple"
            w="100%"
            minW={{ base: '720px', md: '100%' }}
            sx={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <Thead>
              <Tr>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Memo
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Fecha
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Gestión
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Destino
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Asunto
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  Asignado
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                >
                  PDF
                </Th>
                <Th
                  fontSize="xs"
                  fontWeight="700"
                  color="gray.700"
                  textTransform="none"
                  letterSpacing="normal"
                  whiteSpace="nowrap"
                  py={2}
                  px={2}
                  lineHeight="1.1"
                  textAlign="right"
                >
                  Acciones
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r.id} bg={managementRowBg(r.management)}>
                  <Td whiteSpace="nowrap" verticalAlign="middle" fontSize="xs" py={2} px={2}>
                    {r.memo_display ?? r.memo_number}
                  </Td>
                  <Td whiteSpace="nowrap" verticalAlign="middle" fontSize="xs" py={2} px={2}>
                    {r.sent_date?.slice(0, 10)}
                  </Td>
                  <Td verticalAlign="middle" py={2} px={2} title={managementTableLabel(r.management)}>
                    <Badge
                      fontSize="0.7em"
                      px={1.5}
                      py={0.5}
                      borderRadius="sm"
                      maxW="100%"
                      display="inline-block"
                      whiteSpace="nowrap"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      {...managementBadgeProps(r.management)}
                    >
                      {managementTableLabel(r.management)}
                    </Badge>
                  </Td>
                  <Td maxW={0} verticalAlign="middle" py={2} px={2} title={r.destination_name}>
                    <ChakraText noOfLines={1} fontSize="xs" lineHeight="short">
                      {r.destination_name}
                    </ChakraText>
                  </Td>
                  <Td maxW={0} verticalAlign="middle" py={2} px={2} title={r.subject}>
                    <ChakraText noOfLines={1} fontSize="xs" lineHeight="short">
                      {r.subject}
                    </ChakraText>
                  </Td>
                  <Td maxW={0} verticalAlign="middle" py={2} px={2} title={r.assigned_name || ''}>
                    <ChakraText noOfLines={1} fontSize="xs" lineHeight="short">
                      {r.assigned_name || '—'}
                    </ChakraText>
                  </Td>
                  <Td whiteSpace="nowrap" verticalAlign="middle" py={2} px={2}>
                    {r.pdf_path ? (
                      <HStack spacing={1}>
                        <Button
                          as="a"
                          href={pdfUrl(r.pdf_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          variant="link"
                          fontSize="xs"
                          h="auto"
                          minH={0}
                          py={0}
                          px={0}
                        >
                          Abrir
                        </Button>
                        <Button size="xs" variant="outline" fontSize="xs" onClick={() => openPdfPreview(r.pdf_path)}>
                          Aquí
                        </Button>
                      </HStack>
                    ) : (
                      <ChakraText fontSize="xs" color="gray.400">
                        —
                      </ChakraText>
                    )}
                  </Td>
                  <Td verticalAlign="middle" py={2} px={2}>
                    <VStack spacing={1} align="stretch" minW="92px">
                      {r.management === 'por_gestionar' && (
                        <Button
                          size="xs"
                          colorScheme="blue"
                          variant="outline"
                          title={
                            r.pdf_path
                              ? 'Marcar como concluido'
                              : 'Adjunte un PDF al memo antes de poder concluirlo'
                          }
                          fontSize="xs"
                          h="28px"
                          px={2}
                          isDisabled={!r.pdf_path}
                          onClick={() => markConcluded(r)}
                        >
                          Concluir
                        </Button>
                      )}
                      <Button size="xs" fontSize="xs" h="28px" px={2} onClick={() => openEdit(r)}>
                        Editar
                      </Button>
                    </VStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={isOpen} onClose={handleCloseModal} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader pr={14}>
            <Flex align="center" gap={3} flexWrap="wrap">
              <ChakraText as="span" fontSize="xl" fontWeight="600">
                {editing ? 'Editar memo' : 'Nuevo memo'}
              </ChakraText>
              {editing ? (
                <Badge colorScheme="gray" fontSize="sm" px={2} py={0.5} borderRadius="md">
                  Memo {editing.memo_display ?? editing.memo_number}
                </Badge>
              ) : (
                nextMemoPreview?.memoLabel != null && (
                  <Badge colorScheme="brand" fontSize="sm" px={2} py={0.5} borderRadius="md">
                    Siguiente memo {nextMemoPreview.memoLabel}
                  </Badge>
                )
              )}
            </Flex>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <FormControl isRequired>
                <FormLabel>Fecha de envío</FormLabel>
                <Input type="date" value={form.sentDate} onChange={(e) => setForm((f) => ({ ...f, sentDate: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Destino</FormLabel>
                <FormHelperText mb={2}>
                  {isDivisionOnly
                    ? 'Use la casilla para enviar al Despacho (superior jerárquico) o elija otra división en la lista. No aparece su propia división.'
                    : 'Elija un destino del listado o use «destino manual» para organismos externos o no catalogados.'}
                </FormHelperText>
                {isDivisionOnly && despachoDestinationId ? (
                  <Checkbox
                    mb={3}
                    isChecked={sendToDespacho}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setSendToDespacho(v);
                      if (v) {
                        setForm((f) => ({ ...f, destinationId: despachoDestinationId }));
                      } else {
                        setForm((f) => ({ ...f, destinationId: '' }));
                      }
                    }}
                  >
                    Enviar al Despacho (nivel superior jerárquico)
                  </Checkbox>
                ) : null}
                {isDivisionOnly && sendToDespacho ? (
                  <ChakraText fontSize="sm" color="gray.700" borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
                    Destino fijado al <strong>Despacho</strong> (registro institucional del memo).
                  </ChakraText>
                ) : isDivisionOnly ? (
                  <Select
                    placeholder="Seleccione división destino"
                    value={form.destinationId}
                    onChange={(e) => setForm((f) => ({ ...f, destinationId: e.target.value }))}
                  >
                    {modalDestinationSelectOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <>
                    {!editing ? (
                      <Checkbox
                        mb={3}
                        isChecked={sendToAllDivisions}
                        isDisabled={manualDestination}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setSendToAllDivisions(v);
                          if (v) {
                            setManualDestination(false);
                            setCustomDestinationName('');
                            setForm((f) => ({ ...f, destinationId: '' }));
                          }
                        }}
                      >
                        Enviar a las 4 divisiones operativas
                      </Checkbox>
                    ) : null}
                    <Checkbox
                      mb={3}
                      isChecked={manualDestination}
                      isDisabled={sendToAllDivisions}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setManualDestination(v);
                        if (v) {
                          setSendToAllDivisions(false);
                          setForm((f) => ({ ...f, destinationId: '' }));
                        } else {
                          setCustomDestinationName('');
                        }
                      }}
                    >
                      Destino externo o no listado (escribir manualmente)
                    </Checkbox>
                    {manualDestination ? (
                      <Textarea
                        placeholder="Ej.: organismo externo, institución, destino no catalogado"
                        value={customDestinationName}
                        onChange={(e) => setCustomDestinationName(e.target.value)}
                        rows={2}
                      />
                    ) : sendToAllDivisions ? (
                      <ChakraText fontSize="sm" color="gray.700" borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
                        Se enviará el mismo memo a las <strong>4 divisiones operativas</strong>. No seleccione un destino individual.
                      </ChakraText>
                    ) : (
                      <Select
                        placeholder="Seleccione destino"
                        value={form.destinationId}
                        onChange={(e) => setForm((f) => ({ ...f, destinationId: e.target.value }))}
                      >
                        {modalDestinationSelectOptions.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </>
                )}
                {(isDivisionOnly && !despachoDestinationId) ||
                (!isDivisionOnly && !manualDestination && sentDestinationOptions.length === 0) ||
                (isDivisionOnly && !sendToDespacho && memoDivisionSelectList.length === 0) ? (
                  <ChakraText fontSize="sm" color="orange.600" mt={2}>
                    No se obtuvieron destinos. El servidor intenta crear el catálogo automáticamente: reinicie la API con
                    el código actual y revise la consola del backend. Si persiste, ejecute{' '}
                    <strong>npm run db:migrate:canonical-destinos</strong> y compruebe permisos de escritura en la base de
                    datos.
                  </ChakraText>
                ) : null}
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Asunto</FormLabel>
                <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Gestión</FormLabel>
                {editing?.management === 'concluido' ? (
                  <ChakraText fontSize="sm" color="gray.600">
                    Este memo está <strong>concluido</strong>. Puede actualizar fecha, destino, asunto, asignación o PDF; el
                    estado seguirá siendo concluido.
                  </ChakraText>
                ) : (
                  <>
                    <ChakraText fontSize="sm" color="gray.600" mb={2}>
                      Los memos <strong>por gestionar</strong> pueden cerrarse desde el listado con &quot;Marcar
                      concluido&quot;.
                    </ChakraText>
                    <Select
                      value={form.management}
                      onChange={(e) => setForm((f) => ({ ...f, management: e.target.value }))}
                    >
                      {managementFormOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
              </FormControl>
              <FormControl>
                <FormLabel>Asignado</FormLabel>
                <Select
                  placeholder="Sin asignar"
                  value={form.assignedUserId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                >
                  {catalog.assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Adjunto PDF</FormLabel>
                <FormHelperText mb={1}>Obligatorio en nuevo memo y al corregir registros sin archivo.</FormHelperText>
                <Input type="file" accept="application/pdf" onChange={(e) => setForm((f) => ({ ...f, pdf: e.target.files?.[0] || null }))} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={submit}>
              Guardar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={pdfOpen} onClose={onPdfClose} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Vista del PDF</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {pdfPreviewSrc ? (
              <Box borderWidth="1px" borderRadius="md" overflow="hidden" h="75vh">
                <iframe title="Vista PDF" src={pdfPreviewSrc} width="100%" height="100%" style={{ border: 'none' }} />
              </Box>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
