import {
  Badge,
  Box,
  Button,
  FormControl,
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
  Tbody,
  Td,
  Text as ChakraText,
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

const managementOptions = [
  { value: 'informativo', label: 'Informativo' },
  { value: 'por_gestionar', label: 'Por gestionar' },
  { value: 'concluido', label: 'Concluido' },
];

/**
 * Bandeja de correspondencia recibida: externos (solo Despacho registra) + memos internos cuyo destino es esta unidad.
 */
export default function CorrespondenceReceivedPage() {
  const toast = useToast();
  const { user, can, loading: authLoading } = useAuth();
  const canWriteRecv = can('corr_recv.write');
  const isDivisionOnly = isScopedDivisionUser(user);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: routeOpen,
    onOpen: onRouteOpen,
    onClose: onRouteClose,
  } = useDisclosure();
  const {
    isOpen: pdfOpen,
    onOpen: onPdfOpen,
    onClose: onPdfClose,
  } = useDisclosure();
  const [pdfPreviewSrc, setPdfPreviewSrc] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState([]);
  const [catalog, setCatalog] = useState({ assignees: [], destinations: [], divisions: [] });
  /** Usuarios asignables solo de la división receptora (independiente del catálogo global de `load`). */
  const [recvModalAssignees, setRecvModalAssignees] = useState([]);
  const [routeTargetRow, setRouteTargetRow] = useState(null);
  const [routeDivisionId, setRouteDivisionId] = useState('');
  const [destinations, setDestinations] = useState([]);
  const [filters, setFilters] = useState({
    management: '',
    from: '',
    to: '',
    sender: '',
  });
  /** all | pending | received — bandeja temporal (por recibir) hasta confirmar; luego recibidos. */
  const [receiptTab, setReceiptTab] = useState('pending');
  const [form, setForm] = useState({
    receivedDate: '',
    sender: '',
    subject: '',
    management: 'por_gestionar',
    assignedUserId: '',
    pdf: null,
  });
  const [routedForm, setRoutedForm] = useState({
    sentDate: '',
    destinationId: '',
    subject: '',
    management: 'por_gestionar',
    assignedUserId: '',
    pdf: null,
  });
  const [editing, setEditing] = useState(null);

  /** Incluye el destino actual del memo aunque no salga en el catálogo de “envío” (p. ej. Despacho). */
  const routedDestinationOptions = useMemo(() => {
    const list = [...(destinations || [])];
    const ids = new Set(list.map((d) => Number(d.id)));
    const cur = editing?.entry_type === 'routed_memo' ? Number(editing.destination_id) : null;
    if (cur != null && Number.isFinite(cur) && !ids.has(cur)) {
      const extra = (catalog.destinations || []).find((d) => Number(d.id) === cur);
      if (extra) list.push(extra);
    }
    return list;
  }, [destinations, catalog.destinations, editing]);

  const operationalDivisions = useMemo(() => {
    const list = catalog?.divisions || [];
    return list.filter((d) => String(d.name || '').toLowerCase().trim() !== 'despacho');
  }, [catalog?.divisions]);

  const despachoDivisionId = useMemo(() => {
    const d = (catalog?.divisions || []).find(
      (x) => String(x.name || '').toLowerCase().trim() === 'despacho'
    );
    return d ? Number(d.id) : null;
  }, [catalog?.divisions]);

  /** División Despacho en catálogo o, si falta, la división del usuario (p. ej. carga aún sin catálogo). */
  const despachoDivisionResolved = useMemo(() => {
    if (despachoDivisionId != null && Number.isFinite(despachoDivisionId)) return despachoDivisionId;
    const uid = user?.divisionId;
    if (uid != null && Number.isFinite(Number(uid))) return Number(uid);
    return null;
  }, [despachoDivisionId, user?.divisionId]);

  /**
   * División donde está la correspondencia (bandeja actual): ahí solo pueden asignarse usuarios de esa unidad.
   * Prioriza siempre la fila recibida (derivada o memo), no el destino catálogo del memo.
   */
  const assigneesDivisionIdResolved = useMemo(() => {
    if (editing) {
      if (editing.division_id != null && Number.isFinite(Number(editing.division_id))) {
        return Number(editing.division_id);
      }
      return despachoDivisionResolved;
    }
    return despachoDivisionResolved;
  }, [editing, despachoDivisionResolved]);

  /** Asignar solo en bandeja principal (recepción ya validada). */
  const editingAllowsAssignee = useMemo(() => {
    if (!editing) return false;
    if (editing.requires_receipt === true && !editing.acknowledged_at) return false;
    return true;
  }, [editing]);

  const assigneesForSelect = useMemo(() => {
    const list = [...recvModalAssignees];
    const rawId =
      editing?.entry_type === 'routed_memo' ? routedForm.assignedUserId : form.assignedUserId;
    const sid = rawId != null && String(rawId).trim() !== '' ? String(rawId) : '';
    if (sid && !list.some((u) => String(u.id) === sid)) {
      list.unshift({
        id: sid,
        name: editing?.assigned_name ? `${editing.assigned_name} (actual)` : 'Asignado actual',
      });
    }
    return list;
  }, [recvModalAssignees, editing, form.assignedUserId, routedForm.assignedUserId]);

  useEffect(() => {
    if (!isOpen) {
      setRecvModalAssignees([]);
      return;
    }
    if (authLoading) return;
    const id = assigneesDivisionIdResolved;
    if (id == null || !Number.isFinite(id)) {
      setRecvModalAssignees([]);
      return;
    }
    let cancelled = false;
    client
      .get('/api/catalogs', { params: { assigneesDivisionId: id } })
      .then((res) => {
        if (!cancelled) setRecvModalAssignees(res.data.assignees || []);
      })
      .catch(() => {
        if (!cancelled) setRecvModalAssignees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, authLoading, assigneesDivisionIdResolved]);

  const chartStats = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const m = r.management || 'por_gestionar';
      map.set(m, (map.get(m) || 0) + 1);
    }
    return Array.from(map.entries()).map(([management, total]) => ({ management, total }));
  }, [rows]);

  const load = async (overrideFilters, tabOverride) => {
    const f = overrideFilters ?? filters;
    const tab = tabOverride ?? receiptTab;
    const params = {};
    if (f.management) params.management = f.management;
    if (f.from) params.from = f.from;
    if (f.to) params.to = f.to;
    if (f.sender) params.sender = f.sender;
    if (tab && tab !== 'all') params.receiptStatus = tab;
    const [listRes, statsRes, catRes, destRes] = await Promise.all([
      client.get('/api/correspondence/received', { params }),
      client.get('/api/correspondence/received/stats', { params }),
      client.get('/api/catalogs'),
      client.get('/api/correspondence/destinations-for-sent').catch(() => ({ data: [] })),
    ]);
    setRows(listRes.data);
    setStats(statsRes.data);
    setCatalog(catRes.data);
    setDestinations(destRes.data || []);
  };

  useEffect(() => {
    if (authLoading) return;
    setReceiptTab('pending');
    load(undefined, 'pending').catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isDivisionOnly]);

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

  const exportReceivedPdf = async () => {
    try {
      const params = {};
      if (filters.management) params.management = filters.management;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.sender) params.sender = filters.sender;
      if (receiptTab && receiptTab !== 'all') params.receiptStatus = receiptTab;
      const res = await client.get('/api/reports/correspondence-received.pdf', { params, responseType: 'blob' });
      downloadBlob(res.data, 'correspondencia_recibida.pdf');
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
    setForm({
      receivedDate: '',
      sender: '',
      subject: '',
      management: 'por_gestionar',
      assignedUserId: '',
      pdf: null,
    });
    onOpen();
  };

  const openEdit = (row) => {
    setEditing(row);
    if (row.entry_type === 'routed_memo') {
      setRoutedForm({
        sentDate: row.received_date?.slice(0, 10) || '',
        destinationId: row.destination_id != null ? String(row.destination_id) : '',
        subject: row.subject || '',
        management: row.management || 'por_gestionar',
        assignedUserId: row.assigned_user_id || '',
        pdf: null,
      });
    } else {
      setForm({
        receivedDate: row.received_date?.slice(0, 10),
        sender: row.sender,
        subject: row.subject,
        management: row.management,
        assignedUserId: row.assigned_user_id || '',
        pdf: null,
      });
    }
    onOpen();
  };

  const submit = async () => {
    try {
      if (editing?.entry_type === 'routed_memo') {
        if (!editing.pdf_path && !routedForm.pdf) {
          toast({
            title: 'PDF obligatorio',
            description: 'Debe adjuntar el PDF del memo para guardar los cambios.',
            status: 'warning',
          });
          return;
        }
        const fd = new FormData();
        fd.append('sentDate', routedForm.sentDate);
        fd.append('destinationId', routedForm.destinationId);
        fd.append('subject', routedForm.subject);
        fd.append('management', routedForm.management);
        if (editingAllowsAssignee && routedForm.assignedUserId)
          fd.append('assignedUserId', routedForm.assignedUserId);
        if (routedForm.pdf) fd.append('pdf', routedForm.pdf);
        if (routedForm.pdf) {
          await client.patch(`/api/correspondence/sent/${editing.sent_id}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          await client.patch(`/api/correspondence/sent/${editing.sent_id}`, {
            sentDate: routedForm.sentDate,
            destinationId: Number(routedForm.destinationId),
            subject: routedForm.subject,
            management: routedForm.management,
            ...(editingAllowsAssignee ? { assignedUserId: routedForm.assignedUserId || null } : {}),
          });
        }
        toast({ title: 'Memo actualizado', status: 'success' });
      } else {
        if (!editing && !form.pdf) {
          toast({
            title: 'PDF obligatorio',
            description: 'Debe adjuntar el PDF de la correspondencia recibida para guardarla.',
            status: 'warning',
          });
          return;
        }
        if (editing && !editing.pdf_path && !form.pdf) {
          toast({
            title: 'PDF obligatorio',
            description: 'Este registro no tiene PDF. Suba el archivo para poder guardar los cambios.',
            status: 'warning',
          });
          return;
        }
        const fd = new FormData();
        fd.append('receivedDate', form.receivedDate);
        fd.append('sender', form.sender);
        fd.append('subject', form.subject);
        fd.append('management', form.management);
        if (editing && editingAllowsAssignee && form.assignedUserId)
          fd.append('assignedUserId', form.assignedUserId);
        if (form.pdf) fd.append('pdf', form.pdf);

        if (!editing) {
          await client.post('/api/correspondence/received', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          toast({ title: 'Registro creado', status: 'success' });
        } else if (form.pdf) {
          await client.patch(`/api/correspondence/received/${editing.received_id}`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          toast({ title: 'Registro actualizado', status: 'success' });
        } else {
          await client.patch(`/api/correspondence/received/${editing.received_id}`, {
            receivedDate: form.receivedDate,
            sender: form.sender,
            subject: form.subject,
            management: form.management,
            ...(editingAllowsAssignee ? { assignedUserId: form.assignedUserId || null } : {}),
          });
          toast({ title: 'Registro actualizado', status: 'success' });
        }
      }
      onClose();
      await load(undefined, receiptTab);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const markExternalReceived = async (row) => {
    if (row.entry_type !== 'external' || !row.received_id) return;
    try {
      const body = { receivedId: row.received_id };
      if (user?.role === 'admin') {
        body.inboxDivisionId =
          row.division_id === null || row.division_id === undefined || row.division_id === ''
            ? null
            : Number(row.division_id);
      }
      const { data } = await client.post('/api/correspondence/received/acknowledge-external', body);
      toast({
        title: data.already ? 'Ya estaba recibida' : 'Recepción validada',
        status: 'success',
      });
      await load(undefined, receiptTab);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const markMemoReceived = async (row) => {
    if (row.entry_type !== 'routed_memo' || !row.sent_id) return;
    try {
      const body = { sentId: row.sent_id };
      if (user?.role === 'admin') {
        body.inboxDivisionId =
          row.division_id === null || row.division_id === undefined || row.division_id === ''
            ? null
            : Number(row.division_id);
      }
      const { data } = await client.post('/api/correspondence/received/acknowledge-memo', body);
      toast({
        title: data.already ? 'Ya estaba recibida' : 'Marcada como recibida',
        status: 'success',
      });
      await load(undefined, receiptTab);
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
      if (row.entry_type === 'routed_memo') {
        await client.patch(`/api/correspondence/sent/${row.sent_id}`, { management: 'concluido' });
      } else {
        await client.patch(`/api/correspondence/received/${row.received_id}`, { management: 'concluido' });
      }
      toast({ title: 'Marcado como concluido', status: 'success' });
      await load(undefined, receiptTab);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const openRouteToDivision = (row) => {
    if (!operationalDivisions.length) {
      toast({
        title: 'Sin divisiones operativas',
        description: 'No hay divisiones disponibles en el catálogo para derivar.',
        status: 'warning',
      });
      return;
    }
    setRouteTargetRow(row);
    setRouteDivisionId(operationalDivisions[0]?.id != null ? String(operationalDivisions[0].id) : '');
    onRouteOpen();
  };

  const submitRouteToDivision = async () => {
    if (!routeTargetRow?.received_id || !routeDivisionId) {
      toast({ title: 'Seleccione una división', status: 'warning' });
      return;
    }
    try {
      await client.patch(`/api/correspondence/received/${routeTargetRow.received_id}`, {
        divisionId: Number(routeDivisionId),
      });
      toast({ title: 'Correspondencia enviada a la división', status: 'success' });
      onRouteClose();
      setRouteTargetRow(null);
      setRouteDivisionId('');
      await load(undefined, receiptTab);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const reverseRoute = async (row) => {
    if (!row?.received_id) return;
    if (!window.confirm('¿Reversar la derivación? La correspondencia quedará nuevamente sin división asignada.')) return;
    try {
      await client.patch(`/api/correspondence/received/${row.received_id}`, { divisionId: null });
      toast({ title: 'Derivación reversada', status: 'success' });
      await load(undefined, receiptTab);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const optionsForForm =
    editing?.management === 'informativo'
      ? managementOptions.filter((o) => o.value !== 'concluido')
      : managementOptions;

  const rowKey = (r) => `${r.entry_type || 'external'}-${r.received_id || r.sent_id}`;

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Correspondencia recibida</Heading>
        {!isDivisionOnly ? (
          <Button colorScheme="brand" onClick={openCreate}>
            Nuevo registro (exterior)
          </Button>
        ) : null}
      </HStack>

      {isDivisionOnly ? (
        <Box mb={4} p={3} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.100">
          <ChakraText fontSize="sm" color="gray.700">
            <strong>Su división:</strong> {user?.divisionName || '—'}. Los <strong>memos internos</strong> y el <strong>exterior</strong>{' '}
            asociado a su unidad entran primero en la <strong>bandeja temporal</strong> hasta que pulse <strong>Validar recepción</strong>.
            Luego pasan a la <strong>bandeja principal</strong>, donde podrá asignar solo a usuarios de {user?.divisionName || 'esta división'}.
            El listado muestra <strong>primero la última recepción</strong>; el <strong>N°</strong> más alto corresponde a
            esa última fila (arriba). No puede dar de alta memos salientes aquí; use{' '}
            <strong>Correspondencia enviada</strong>.
          </ChakraText>
        </Box>
      ) : (
        <Box mb={4} p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
          <ChakraText fontSize="sm" color="gray.700">
            Solo el <strong>Despacho</strong> registra aquí correspondencia del exterior (siempre con <strong>PDF
            obligatorio</strong>). Para reenviarla a una división operativa sin duplicar el registro como memo enviado,
            use <strong>Derivar a división</strong> en la columna Asignado (una sola vez por registro); el ítem{' '}
            <strong>sigue visible aquí</strong> además de en la división. Los <strong>memos internos</strong> siguen
            gestionándose desde <strong>Correspondencia enviada</strong>. Los memos dirigidos al Despacho entran primero en la{' '}
            <strong>bandeja temporal</strong> hasta validar la recepción; luego el ítem pasa a la{' '}
            <strong>bandeja principal</strong>, donde podrá asignarlo solo a usuarios del Despacho.
          </ChakraText>
        </Box>
      )}

      <HStack spacing={2} mb={4} flexWrap="wrap">
        <ChakraText fontSize="sm" fontWeight="600" w="100%">
          Bandeja temporal (validar recepción) y bandeja principal
        </ChakraText>
        <Button
          size="sm"
          variant={receiptTab === 'pending' ? 'solid' : 'outline'}
          colorScheme="orange"
          onClick={() => {
            setReceiptTab('pending');
            load(undefined, 'pending').catch(() => {});
          }}
        >
          Bandeja temporal
        </Button>
        <Button
          size="sm"
          variant={receiptTab === 'received' ? 'solid' : 'outline'}
          colorScheme="green"
          onClick={() => {
            setReceiptTab('received');
            load(undefined, 'received').catch(() => {});
          }}
        >
          Bandeja principal
        </Button>
        <Button
          size="sm"
          variant={receiptTab === 'all' ? 'solid' : 'outline'}
          onClick={() => {
            setReceiptTab('all');
            load(undefined, 'all').catch(() => {});
          }}
        >
          Todos
        </Button>
      </HStack>

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
        title="Gráficos — correspondencia recibida"
        subtitle="Última recepción arriba con el N° más alto. Alta de exterior requiere PDF."
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
            {managementOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Remitente contiene…"
            maxW="240px"
            value={filters.sender}
            onChange={(e) => setFilters((f) => ({ ...f, sender: e.target.value }))}
          />
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <Button
            onClick={() => {
              load(undefined, receiptTab).catch(() => {});
            }}
          >
            Aplicar
          </Button>
          <ExportMenuButton
            label="Exportaciones"
            options={[{ id: 'recv_pdf', label: 'Listado (PDF)', onClick: exportReceivedPdf }]}
          />
          <Button
            variant="outline"
            onClick={async () => {
              const cleared = { management: '', from: '', to: '', sender: '' };
              setFilters(cleared);
              await load(cleared, receiptTab);
            }}
          >
            Limpiar
          </Button>
        </HStack>
      </Box>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto" sx={{ WebkitOverflowScrolling: 'touch' }}>
        <Table size="sm" sx={{ tableLayout: 'fixed', minWidth: '980px' }}>
          <Thead>
            <Tr>
              <Th title="La fila superior es la última recepción y lleva el número más alto del listado">N°</Th>
              <Th>Origen</Th>
              <Th>Fecha</Th>
              <Th>Remitente</Th>
              <Th>Asunto</Th>
              <Th>Destino / Unidad</Th>
              <Th>Gestión</Th>
              <Th>Asignado</Th>
              <Th>PDF</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r, i) => (
              <Tr key={rowKey(r)} bg={managementRowBg(r.management)}>
                <Td>{rows.length - i}</Td>
                <Td>
                  <Badge colorScheme={r.entry_type === 'routed_memo' ? 'purple' : 'gray'} fontSize="0.65em">
                    {r.entry_type === 'routed_memo' ? 'Memo interno' : 'Exterior'}
                  </Badge>
                </Td>
                <Td>{r.received_date?.slice(0, 10)}</Td>
                <Td maxW={0} title={r.sender || ''}>
                  <ChakraText noOfLines={1} fontSize="sm">
                    {r.sender}
                  </ChakraText>
                </Td>
                <Td maxW={0} title={r.subject || ''}>
                  <ChakraText noOfLines={1} fontSize="sm">
                    {r.subject}
                  </ChakraText>
                </Td>
                <Td fontSize="xs" maxW={0} title={r.division_name || ''}>
                  <ChakraText noOfLines={1} fontSize="xs">
                    {r.division_name || '—'}
                  </ChakraText>
                </Td>
                <Td>
                  <Badge {...managementBadgeProps(r.management)}>{r.management}</Badge>
                </Td>
                <Td verticalAlign="top">
                  <VStack align="stretch" spacing={1}>
                    <ChakraText fontSize="sm">{r.assigned_name || '—'}</ChakraText>
                    {!isDivisionOnly &&
                    r.entry_type === 'external' &&
                    (r.division_id == null || r.division_id === '') ? (
                      <Button
                        size="xs"
                        colorScheme="teal"
                        variant="outline"
                        onClick={() => openRouteToDivision(r)}
                      >
                        Derivar a división…
                      </Button>
                    ) : null}
                    {!isDivisionOnly &&
                    r.entry_type === 'external' &&
                    r.division_id != null &&
                    r.division_name ? (
                      <Button size="xs" colorScheme="orange" variant="outline" onClick={() => reverseRoute(r)}>
                        Reversar derivación
                      </Button>
                    ) : null}
                  </VStack>
                </Td>
                <Td>
                  {r.pdf_path ? (
                    <HStack spacing={1}>
                      <Button as="a" href={pdfUrl(r.pdf_path)} target="_blank" rel="noopener noreferrer" size="xs" variant="link">
                        Abrir
                      </Button>
                      <Button size="xs" variant="outline" onClick={() => openPdfPreview(r.pdf_path)}>
                        Ver aquí
                      </Button>
                    </HStack>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {isDivisionOnly && r.entry_type === 'external' && (r.read_only === true || r.division_id == null || r.division_id === '') ? (
                    <ChakraText fontSize="xs" color="gray.500">
                      Solo lectura (exterior sin gestión para su división)
                    </ChakraText>
                  ) : (
                    <HStack spacing={1} flexWrap="wrap">
                      {canWriteRecv &&
                        r.entry_type === 'routed_memo' &&
                        r.requires_receipt === true &&
                        !r.acknowledged_at && (
                          <Button size="xs" colorScheme="teal" variant="solid" onClick={() => markMemoReceived(r)}>
                            Validar recepción
                          </Button>
                        )}
                      {canWriteRecv &&
                        r.entry_type === 'external' &&
                        r.requires_receipt === true &&
                        !r.acknowledged_at && (
                          <Button size="xs" colorScheme="teal" variant="solid" onClick={() => markExternalReceived(r)}>
                            Validar recepción
                          </Button>
                        )}
                      {canWriteRecv && r.management === 'por_gestionar' && (
                        <Button
                          size="xs"
                          colorScheme="blue"
                          variant="outline"
                          title={
                            r.pdf_path
                              ? 'Marcar como concluido'
                              : 'Adjunte un PDF al expediente antes de poder concluirlo'
                          }
                          isDisabled={!r.pdf_path}
                          onClick={() => markConcluded(r)}
                        >
                          Concluir
                        </Button>
                      )}
                      {canWriteRecv ? (
                        <Button size="xs" onClick={() => openEdit(r)}>
                          Editar
                        </Button>
                      ) : null}
                    </HStack>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editing
              ? editing.entry_type === 'routed_memo'
                ? 'Editar memo interno recibido'
                : 'Editar registro'
              : 'Nuevo registro (exterior)'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editing?.entry_type === 'routed_memo' ? (
              <VStack spacing={3} align="stretch">
                <ChakraText fontSize="sm" color="gray.600">
                  Este ítem es un memo interno; el destino indica hacia qué unidad se envió.
                </ChakraText>
                <FormControl isRequired>
                  <FormLabel>Fecha del memo</FormLabel>
                  <Input
                    type="date"
                    value={routedForm.sentDate}
                    onChange={(e) => setRoutedForm((f) => ({ ...f, sentDate: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Destino</FormLabel>
                  <Select
                    placeholder="Seleccione"
                    value={routedForm.destinationId}
                    onChange={(e) => setRoutedForm((f) => ({ ...f, destinationId: e.target.value }))}
                  >
                    {routedDestinationOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Asunto</FormLabel>
                  <Input value={routedForm.subject} onChange={(e) => setRoutedForm((f) => ({ ...f, subject: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel>Gestión</FormLabel>
                  {editing?.management === 'informativo' ? (
                    <ChakraText fontSize="sm" color="gray.600">
                      Registro informativo: no puede marcarse como concluido.
                    </ChakraText>
                  ) : null}
                  <Select
                    value={routedForm.management}
                    onChange={(e) => setRoutedForm((f) => ({ ...f, management: e.target.value }))}
                  >
                    {optionsForForm.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                {editingAllowsAssignee ? (
                  <FormControl>
                    <FormLabel>Asignado</FormLabel>
                    <Select
                      placeholder="Sin asignar"
                      value={routedForm.assignedUserId}
                      onChange={(e) => setRoutedForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                    >
                      {assigneesForSelect.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <ChakraText fontSize="sm" color="gray.600">
                    Use <strong>Validar recepción</strong> en la bandeja temporal. En la bandeja principal podrá asignar
                    solo a usuarios de la unidad receptora.
                  </ChakraText>
                )}
                <FormControl isRequired>
                  <FormLabel>Adjunto PDF</FormLabel>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setRoutedForm((f) => ({ ...f, pdf: e.target.files?.[0] || null }))}
                  />
                </FormControl>
              </VStack>
            ) : (
              <VStack spacing={3} align="stretch">
                <FormControl isRequired>
                  <FormLabel>Fecha de recepción</FormLabel>
                  <Input type="date" value={form.receivedDate} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Remitente (exterior)</FormLabel>
                  <Input value={form.sender} onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Asunto</FormLabel>
                  <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel>Gestión</FormLabel>
                  {editing?.management === 'informativo' ? (
                    <ChakraText fontSize="sm" color="gray.600">
                      Registro informativo: no puede marcarse como concluido.
                    </ChakraText>
                  ) : null}
                  <Select value={form.management} onChange={(e) => setForm((f) => ({ ...f, management: e.target.value }))}>
                    {optionsForForm.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                {!editing ? (
                  <ChakraText fontSize="sm" color="gray.600">
                    El registro quedará en la <strong>bandeja temporal</strong>. Cuando valide la recepción pasará a la{' '}
                    <strong>bandeja principal</strong> y allí podrá asignarlo solo a usuarios del Despacho.
                  </ChakraText>
                ) : editingAllowsAssignee ? (
                  <FormControl>
                    <FormLabel>Asignado</FormLabel>
                    <Select
                      placeholder="Sin asignar"
                      value={form.assignedUserId}
                      onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                    >
                      {assigneesForSelect.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <ChakraText fontSize="sm" color="gray.600">
                    Valide la recepción con <strong>Validar recepción</strong> en la bandeja temporal. Luego, en la bandeja
                    principal, podrá asignar solo a usuarios de la unidad receptora.
                  </ChakraText>
                )}
                <FormControl isRequired>
                  <FormLabel>Adjunto PDF</FormLabel>
                  <Input type="file" accept="application/pdf" onChange={(e) => setForm((f) => ({ ...f, pdf: e.target.files?.[0] || null }))} />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={onClose}>
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

      <Modal
        isOpen={routeOpen}
        onClose={() => {
          onRouteClose();
          setRouteTargetRow(null);
          setRouteDivisionId('');
        }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Derivar correspondencia del exterior</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ChakraText fontSize="sm" mb={3} color="gray.600">
              Solo puede hacerse una vez por registro. La división elegida recibe una copia en su bandeja; el registro
              permanece también en la lista del Despacho. No hace falta crear un memo enviado duplicado.
            </ChakraText>
            {routeTargetRow ? (
              <VStack align="stretch" spacing={3}>
                <ChakraText fontSize="sm">
                  <strong>Asunto:</strong> {routeTargetRow.subject}
                </ChakraText>
                {operationalDivisions.length ? (
                  <FormControl isRequired>
                    <FormLabel>División operativa</FormLabel>
                    <Select value={routeDivisionId} onChange={(e) => setRouteDivisionId(e.target.value)}>
                      {operationalDivisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <ChakraText fontSize="sm" color="orange.600">
                    No hay divisiones operativas en el catálogo (excluye Despacho). Revise el catálogo de divisiones.
                  </ChakraText>
                )}
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              variant="ghost"
              onClick={() => {
                onRouteClose();
                setRouteTargetRow(null);
                setRouteDivisionId('');
              }}
            >
              Cancelar
            </Button>
            <Button
              colorScheme="teal"
              onClick={submitRouteToDivision}
              isDisabled={!routeTargetRow || !operationalDivisions.length || !routeDivisionId}
            >
              Confirmar derivación
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
