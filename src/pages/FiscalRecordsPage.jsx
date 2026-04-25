import {
  Badge,
  Box,
  Button,
  Checkbox,
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
  Spinner,
  Table,
  TableContainer,
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
import { useParams } from 'react-router-dom';
import client from '../api/client.js';
import ReenajenacionFormBlock from '../components/ReenajenacionFormBlock.jsx';
import FiscalDisincorporationCharts from '../components/FiscalDisincorporationCharts.jsx';

function emptyItem() {
  return { contactName: '', contactRif: '', fiscalSerial: '', deviceMacImei: '', observations: '' };
}

function emptyForm(eventType) {
  return {
    eventType,
    supplierId: '',
    supplierName: '',
    supplierRif: '',
    markedForReenajenacion: false,
    items: [emptyItem()],
  };
}

/**
 * Lotes de desincorporación / reenajenación: proveedor + tabla de máquinas.
 * Genera 2 Word: externo + interno.
 */
export default function FiscalRecordsPage() {
  const { modo } = useParams();
  const eventType = modo === 'reenajenacion' ? 'reenajenacion' : 'desincorporacion';
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const supplierModal = useDisclosure();
  const detailModal = useDisclosure();
  const [batchRows, setBatchRows] = useState([]);
  const [rows, setRows] = useState([]); // machines (vista principal)
  const [stats, setStats] = useState({ batches: 0, machines: 0, marked_for_reenajenacion: 0 });
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(() => emptyForm(eventType));
  const [saving, setSaving] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', rif: '' });
  const [detailBatch, setDetailBatch] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const pageTitle = eventType === 'reenajenacion' ? 'Reenajenación' : 'Desincorporación';

  const [filters, setFilters] = useState({ supplier: '', memoNumber: '', from: '', to: '', markedForReenajenacion: '' });

  const load = async () => {
    const params = { eventType };
    if (filters.supplier) params.supplier = filters.supplier;
    if (filters.memoNumber) params.memoNumber = filters.memoNumber;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.markedForReenajenacion) params.markedForReenajenacion = filters.markedForReenajenacion;
    try {
      const [machinesRes, listRes, statsRes] = await Promise.all([
        client.get('/api/fiscal-batches', { params: { ...params, view: 'machines' } }),
        client.get('/api/fiscal-batches', { params }),
        client.get('/api/fiscal-batches/stats', { params }),
      ]);
      setRows(machinesRes.data);
      setBatchRows(listRes.data);
      setStats(statsRes.data || { batches: 0, machines: 0, marked_for_reenajenacion: 0 });
    } catch (err) {
      // No dejar el módulo en blanco si falla stats (o un endpoint)
      setRows([]);
      setBatchRows([]);
      setStats({ batches: 0, machines: 0, marked_for_reenajenacion: 0 });
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  useEffect(() => {
    if (eventType === 'reenajenacion') return;
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

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

  const exportPdf = async () => {
    try {
      const params = { eventType };
      if (filters.supplier) params.supplier = filters.supplier;
      if (filters.memoNumber) params.memoNumber = filters.memoNumber;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.markedForReenajenacion) params.markedForReenajenacion = filters.markedForReenajenacion;
      const res = await client.get('/api/reports/fiscal-batches.pdf', { params, responseType: 'blob' });
      downloadBlob(res.data, 'desincorporaciones_maquinas_fiscales.pdf');
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
    }
  };

  const loadSuppliers = async () => {
    try {
      const { data } = await client.get('/api/fiscal-suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
    } catch {
      setSuppliers([]);
    }
  };

  const openCreate = () => {
    setForm(emptyForm(eventType));
    loadSuppliers();
    onOpen();
  };

  /** Cantidad = filas de máquinas en el formulario (cada «Agregar máquina» suma una). */
  const quantity = useMemo(() => form.items.length, [form.items]);

  const onSupplierChange = (supplierId) => {
    if (!supplierId) {
      setForm((f) => ({ ...f, supplierId: '', supplierName: '', supplierRif: '' }));
      return;
    }
    const s = suppliers.find((x) => String(x.id) === String(supplierId));
    if (!s) return;
    setForm((f) => ({
      ...f,
      supplierId: String(s.id),
      supplierName: s.name,
      supplierRif: s.rif,
    }));
  };

  const submitNewSupplier = async () => {
    const name = String(newSupplier.name || '').trim();
    const rif = String(newSupplier.rif || '').trim();
    if (!name || !rif) {
      toast({ title: 'Indique nombre y RIF del proveedor', status: 'warning' });
      return;
    }
    try {
      setSavingSupplier(true);
      const { data } = await client.post('/api/fiscal-suppliers', { name, rif });
      toast({ title: 'Proveedor registrado', status: 'success' });
      await loadSuppliers();
      setForm((f) => ({
        ...f,
        supplierId: String(data.id),
        supplierName: data.name,
        supplierRif: data.rif,
      }));
      setNewSupplier({ name: '', rif: '' });
      supplierModal.onClose();
    } catch (err) {
      toast({
        title: 'No se pudo registrar',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setSavingSupplier(false);
    }
  };

  const addRow = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeRow = (idx) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx).length ? f.items.filter((_, i) => i !== idx) : [emptyItem()] }));

  const updateItem = (idx, patch) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));

  const submit = async () => {
    if (!form.supplierId || !String(form.supplierName || '').trim() || !String(form.supplierRif || '').trim()) {
      toast({
        title: 'Seleccione un proveedor',
        description: 'Elija uno de la lista o regístrelo con «Registrar proveedor».',
        status: 'warning',
      });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        eventType,
        supplierName: form.supplierName,
        supplierRif: form.supplierRif,
        markedForReenajenacion: eventType === 'desincorporacion' ? form.markedForReenajenacion : false,
        items: form.items,
      };
      await client.post('/api/fiscal-batches', payload);
      toast({ title: 'Lote registrado', status: 'success' });
      onClose();
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateDocs = async (id) => {
    try {
      const { data } = await client.post(`/api/fiscal-batches/${id}/generate-docs`);
      toast({
        title: 'Documentos generados',
        description:
          'Se abrirán dos descargas (externo e interno). Si solo ve una, permita ventanas emergentes o use los enlaces de la tabla.',
        status: 'success',
        duration: 7000,
        isClosable: true,
      });
      const triggerGet = (url) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      triggerGet(data.downloadMainUrl);
      setTimeout(() => triggerGet(data.downloadInternalUrl), 500);
      await load();
    } catch (err) {
      const d = err.response?.data?.details;
      const extra =
        d?.docxtemplater?.[0]?.properties?.explanation ||
        (Array.isArray(d?.docxtemplater) ? JSON.stringify(d.docxtemplater).slice(0, 400) : '');
      toast({
        title: 'No se pudo generar',
        description: [err.response?.data?.error || err.message, extra].filter(Boolean).join('\n'),
        status: 'error',
        duration: 12000,
        isClosable: true,
      });
    }
  };

  const openDetail = async (id) => {
    setDetailBatch(null);
    detailModal.onOpen();
    setDetailLoading(true);
    try {
      const { data } = await client.get(`/api/fiscal-batches/${id}`);
      setDetailBatch(data);
    } catch (err) {
      toast({
        title: 'No se pudo cargar el lote',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
      detailModal.onClose();
    } finally {
      setDetailLoading(false);
    }
  };

  if (eventType === 'reenajenacion') {
    return (
      <Box w="full" maxW="100%">
        <Heading size="md" mb={4}>
          Máquinas fiscales · {pageTitle}
        </Heading>
        <ReenajenacionFormBlock />
      </Box>
    );
  }

  return (
    <Box w="full" maxW="100%">
      <HStack justify="space-between" mb={4} flexWrap="wrap" gap={3}>
        <Heading size="md">Máquinas fiscales · {pageTitle}</Heading>
        <HStack spacing={2} flexWrap="wrap">
          <Button variant="outline" onClick={exportPdf}>
            Exportar PDF
          </Button>
          <Button colorScheme="brand" onClick={openCreate}>
            Nuevo lote
          </Button>
        </HStack>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3} mb={4}>
        <Box p={3} bg="white" borderRadius="md" boxShadow="sm">
          <ChakraText fontSize="sm" color="gray.500">
            Lotes
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="700">
            {stats.batches ?? 0}
          </ChakraText>
        </Box>
        <Box p={3} bg="white" borderRadius="md" boxShadow="sm">
          <ChakraText fontSize="sm" color="gray.500">
            Máquinas
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="700">
            {stats.machines ?? 0}
          </ChakraText>
        </Box>
        <Box p={3} bg="white" borderRadius="md" boxShadow="sm">
          <ChakraText fontSize="sm" color="gray.500">
            Marcadas para reenajenación
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="700">
            {stats.marked_for_reenajenacion ?? 0}
          </ChakraText>
        </Box>
      </SimpleGrid>

      <FiscalDisincorporationCharts rows={rows} stats={stats} hint="Según filtros del listado" />

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <ChakraText fontWeight="600" mb={2}>
          Filtros
        </ChakraText>
        <HStack spacing={3} flexWrap="wrap">
          <Input
            placeholder="Proveedor o RIF contiene…"
            maxW="280px"
            value={filters.supplier}
            onChange={(e) => setFilters((f) => ({ ...f, supplier: e.target.value }))}
          />
          <Input
            placeholder="Memo"
            maxW="140px"
            value={filters.memoNumber}
            onChange={(e) => setFilters((f) => ({ ...f, memoNumber: e.target.value }))}
          />
          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <Select
            placeholder="Reenajenación"
            maxW="220px"
            value={filters.markedForReenajenacion}
            onChange={(e) => setFilters((f) => ({ ...f, markedForReenajenacion: e.target.value }))}
          >
            <option value="true">Solo marcadas</option>
            <option value="false">Solo no marcadas</option>
          </Select>
          <Button onClick={() => load()}>Aplicar</Button>
          <Button
            variant="outline"
            onClick={async () => {
              const cleared = { supplier: '', memoNumber: '', from: '', to: '', markedForReenajenacion: '' };
              setFilters(cleared);
              await load();
            }}
          >
            Limpiar
          </Button>
        </HStack>
      </Box>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Memo</Th>
              <Th>Serial</Th>
              <Th>Razón social</Th>
              <Th>RIF</Th>
              <Th>MAC/IMEI</Th>
              <Th>Observación</Th>
              <Th>Reenaj.</Th>
              <Th>Estado</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.item_id}>
                <Td>{r.memo_number}</Td>
                <Td>{r.fiscal_serial}</Td>
                <Td>{r.contact_name}</Td>
                <Td>{r.contact_rif}</Td>
                <Td>{r.device_mac_imei || '—'}</Td>
                <Td>{r.observations || '—'}</Td>
                <Td>
                  {r.marked_for_reenajenacion ? (
                    <Badge colorScheme="purple" fontSize="0.65em">
                      Sí
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {r.item_disincorporated_at || r.batch_disincorporated_at ? (
                    <Badge colorScheme="green" fontSize="0.65em">
                      DESINCORPORADA
                    </Badge>
                  ) : (
                    <Badge colorScheme="yellow" fontSize="0.65em">
                      PENDIENTE
                    </Badge>
                  )}
                </Td>
                <Td>
                  <HStack spacing={2} flexWrap="wrap">
                    <Button size="xs" variant="outline" onClick={() => openDetail(r.batch_id)}>
                      Ver lote
                    </Button>
                    <Button size="xs" onClick={() => generateDocs(r.batch_id)}>
                      Generar Word
                    </Button>
                    {!r.item_disincorporated_at && !r.batch_disincorporated_at ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await client.patch(`/api/fiscal-batch-items/${r.item_id}/mark-disincorporated`);
                            toast({ title: 'Marcada como desincorporada', status: 'success' });
                            await load();
                          } catch (err) {
                            toast({ title: 'Error', description: err.response?.data?.error || err.message, status: 'error' });
                          }
                        }}
                      >
                        Listo
                      </Button>
                    ) : null}
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nuevo lote · {pageTitle}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <HStack spacing={4} flexWrap="wrap" align="flex-end">
                <FormControl isRequired flex="1" minW="240px" maxW="480px">
                  <FormLabel>Proveedor</FormLabel>
                  <Select
                    placeholder="Seleccione proveedor"
                    value={form.supplierId}
                    onChange={(e) => onSupplierChange(e.target.value)}
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.rif}
                      </option>
                    ))}
                  </Select>
                  <FormHelperText>
                    Si no está en la lista, regístrelo con el botón «Registrar proveedor».
                  </FormHelperText>
                </FormControl>
                <Button mb={2} variant="outline" onClick={() => supplierModal.onOpen()}>
                  Registrar proveedor
                </Button>
                <FormControl maxW="160px">
                  <FormLabel>Cantidad</FormLabel>
                  <Input value={String(quantity)} isReadOnly bg="gray.50" />
                  <FormHelperText mt={1}>Filas de máquinas en la tabla.</FormHelperText>
                </FormControl>
                {eventType === 'desincorporacion' ? (
                  <FormControl maxW="420px" pt={2}>
                    <Checkbox
                      isChecked={form.markedForReenajenacion}
                      onChange={(e) => setForm((f) => ({ ...f, markedForReenajenacion: e.target.checked }))}
                    >
                      Desincorporación para reenajenación
                    </Checkbox>
                    <FormHelperText mt={1} fontSize="xs">
                      Marque esta opción si la máquina podrá tramitarse después en el módulo de{' '}
                      <strong>Reenajenación</strong> (tras la desincorporación).
                    </FormHelperText>
                  </FormControl>
                ) : null}
              </HStack>

              <Box bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200" overflowX="auto">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Razón social (contacto)</Th>
                      <Th>RIF (contacto)</Th>
                      <Th>Nº máquina</Th>
                      <Th>MAC/IMEI</Th>
                      <Th>Observación</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {form.items.map((it, idx) => (
                      <Tr key={idx}>
                        <Td>
                          <Input size="sm" value={it.contactName} onChange={(e) => updateItem(idx, { contactName: e.target.value })} />
                        </Td>
                        <Td>
                          <Input size="sm" value={it.contactRif} onChange={(e) => updateItem(idx, { contactRif: e.target.value })} />
                        </Td>
                        <Td>
                          <Input size="sm" value={it.fiscalSerial} onChange={(e) => updateItem(idx, { fiscalSerial: e.target.value })} />
                        </Td>
                        <Td>
                          <Input size="sm" value={it.deviceMacImei} onChange={(e) => updateItem(idx, { deviceMacImei: e.target.value })} />
                        </Td>
                        <Td>
                          <Input size="sm" value={it.observations} onChange={(e) => updateItem(idx, { observations: e.target.value })} />
                        </Td>
                        <Td>
                          <Button size="xs" variant="outline" onClick={() => removeRow(idx)}>
                            Quitar
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>

              <Button variant="outline" onClick={addRow} alignSelf="flex-start">
                + Agregar máquina
              </Button>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="brand" isLoading={saving} onClick={submit}>
              Guardar lote
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={supplierModal.isOpen} onClose={supplierModal.onClose} size="md" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Registrar proveedor</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <FormControl isRequired>
                <FormLabel>Nombre o razón social</FormLabel>
                <Input
                  value={newSupplier.name}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Ej. Empresa X, C.A."
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>RIF</FormLabel>
                <Input
                  value={newSupplier.rif}
                  onChange={(e) => setNewSupplier((s) => ({ ...s, rif: e.target.value }))}
                  placeholder="Ej. J-12345678-9"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={supplierModal.onClose}>
              Cancelar
            </Button>
            <Button colorScheme="brand" isLoading={savingSupplier} onClick={submitNewSupplier}>
              Guardar proveedor
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={detailModal.isOpen} onClose={detailModal.onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Detalle del lote</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {detailLoading ? (
              <HStack>
                <Spinner size="sm" />
                <ChakraText fontSize="sm">Cargando…</ChakraText>
              </HStack>
            ) : detailBatch ? (
              <VStack align="stretch" spacing={4}>
                <HStack flexWrap="wrap" spacing={4}>
                  <ChakraText fontSize="sm">
                    <strong>Memo:</strong> {detailBatch.memo_number}
                  </ChakraText>
                  <ChakraText fontSize="sm">
                    <strong>Tipo:</strong> {detailBatch.event_type}
                  </ChakraText>
                  <ChakraText fontSize="sm">
                    <strong>Proveedor:</strong> {detailBatch.supplier_name} · {detailBatch.supplier_rif}
                  </ChakraText>
                  <ChakraText fontSize="sm">
                    <strong>Cantidad:</strong> {detailBatch.items?.length ?? detailBatch.quantity}
                  </ChakraText>
                  {detailBatch.event_type === 'desincorporacion' ? (
                    <ChakraText fontSize="sm">
                      <strong>Para reenajenación:</strong>{' '}
                      {detailBatch.marked_for_reenajenacion ? 'Sí' : 'No'}
                    </ChakraText>
                  ) : null}
                  {detailBatch.event_type === 'desincorporacion' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await client.patch(`/api/fiscal-batches/${detailBatch.id}/mark-disincorporated`);
                          toast({ title: 'Lote marcado como desincorporado', status: 'success' });
                          await openDetail(detailBatch.id);
                          await load();
                        } catch (err) {
                          toast({
                            title: 'Error',
                            description: err.response?.data?.error || err.message,
                            status: 'error',
                          });
                        }
                      }}
                    >
                      Listo (lote)
                    </Button>
                  ) : null}
                </HStack>
                <Box overflowX="auto" borderWidth="1px" borderRadius="md" borderColor="gray.200">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        {detailBatch.event_type === 'desincorporacion' ? <Th>Estado</Th> : null}
                        <Th>Razón social (contacto)</Th>
                        <Th>RIF (contacto)</Th>
                        <Th>Nº máquina</Th>
                        <Th>MAC/IMEI</Th>
                        <Th>Observación</Th>
                        {detailBatch.event_type === 'desincorporacion' ? <Th /> : null}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {(detailBatch.items || []).map((it) => (
                        <Tr key={it.id}>
                          {detailBatch.event_type === 'desincorporacion' ? (
                            <Td>
                              {it.disincorporated_at || detailBatch.disincorporated_at ? (
                                <Badge colorScheme="green" fontSize="0.65em">
                                  DESINCORPORADA
                                </Badge>
                              ) : (
                                <Badge colorScheme="yellow" fontSize="0.65em">
                                  PENDIENTE
                                </Badge>
                              )}
                            </Td>
                          ) : null}
                          <Td>{it.contact_name}</Td>
                          <Td>{it.contact_rif}</Td>
                          <Td>{it.fiscal_serial}</Td>
                          <Td>{it.device_mac_imei}</Td>
                          <Td>{it.observations}</Td>
                          {detailBatch.event_type === 'desincorporacion' ? (
                            <Td>
                              {!it.disincorporated_at && !detailBatch.disincorporated_at ? (
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      await client.patch(`/api/fiscal-batch-items/${it.id}/mark-disincorporated`);
                                      toast({ title: 'Marcada como desincorporada', status: 'success' });
                                      await openDetail(detailBatch.id);
                                      await load();
                                    } catch (err) {
                                      toast({
                                        title: 'Error',
                                        description: err.response?.data?.error || err.message,
                                        status: 'error',
                                      });
                                    }
                                  }}
                                >
                                  Listo
                                </Button>
                              ) : (
                                '—'
                              )}
                            </Td>
                          ) : null}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button onClick={detailModal.onClose}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
