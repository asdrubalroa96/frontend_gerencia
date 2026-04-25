import {
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Icon,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text as ChakraText,
  Th,
  Thead,
  Tr,
  Select,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const emptyModalForm = () => ({
  recipientRazonSocial: '',
  recipientRif: '',
  fechaReenajenacion: new Date().toISOString().slice(0, 10),
  direccion: '',
  direccionEspecifica: '',
  ciudadEstado: '',
  zonaPostal: '',
  representanteLegal: '',
  numeroComunicacion: '',
  fechaComunicacion: '',
  fechaRecibidoGf: '',
  marca: '',
  modelo: '',
  numeroRegistro: '',
});

export default function ReenajenacionFormBlock() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const modal = useDisclosure();
  const [stats, setStats] = useState({ total: 0, total_mes: 0, ultima_semana: 0, byMonth: [], bySupplier: [] });
  const [pendientes, setPendientes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [supplierCatalog, setSupplierCatalog] = useState([]);
  const [newSupplierModel, setNewSupplierModel] = useState({ marca: '', modelo: '' });
  const [selectedItemId, setSelectedItemId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingEquipo, setEditingEquipo] = useState(null);
  const [modalForm, setModalForm] = useState(emptyModalForm);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);

  const loadCatalog = useCallback(async () => {
    try {
      const { data } = await client.get('/api/reenajenacion/catalog');
      setCatalog(Array.isArray(data) ? data : []);
    } catch {
      setCatalog([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [st, pen, reg] = await Promise.all([
        client.get('/api/reenajenacion/stats'),
        client.get('/api/reenajenacion/equipos-pendientes'),
        client.get('/api/reenajenacion/registros'),
      ]);
      setStats(st.data || { total: 0, total_mes: 0, ultima_semana: 0, byMonth: [], bySupplier: [] });
      setPendientes(Array.isArray(pen.data) ? pen.data : []);
      setRegistros(Array.isArray(reg.data) ? reg.data : []);
    } catch {
      setStats({ total: 0, total_mes: 0, ultima_semana: 0, byMonth: [], bySupplier: [] });
      setPendientes([]);
      setRegistros([]);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    loadAll();
  }, [loadCatalog, loadAll]);

  const marcas = useMemo(() => {
    const s = new Set();
    const src = supplierCatalog.length ? supplierCatalog : catalog;
    for (const r of src) {
      const m = r?.marca != null && String(r.marca).trim() !== '' ? String(r.marca).trim() : null;
      if (m) s.add(m);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalog, supplierCatalog]);

  const modelos = useMemo(() => {
    if (!modalForm.marca) return [];
    const src = supplierCatalog.length ? supplierCatalog : catalog;
    const raw = src
      .filter((r) => r?.marca != null && String(r.marca) === modalForm.marca)
      .map((r) => (r?.modelo != null ? String(r.modelo).trim() : ''))
      .filter(Boolean);
    return [...new Set(raw)].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalog, supplierCatalog, modalForm.marca]);

  const selectedEquipo = useMemo(
    () => pendientes.find((p) => String(p.item_id) === String(selectedItemId)),
    [pendientes, selectedItemId]
  );
  const activeEquipo = editingId ? editingEquipo : selectedEquipo;

  const openModal = () => {
    if (!selectedItemId || !selectedEquipo) {
      toast({
        title: 'Seleccione un equipo',
        description: 'La reenajenación es por unidad: elija un equipo pendiente en la tabla.',
        status: 'warning',
      });
      return;
    }
    setModalForm({
      ...emptyModalForm(),
      fechaReenajenacion: new Date().toISOString().slice(0, 10),
      // N° de máquina = N° de registro (prefill)
      numeroRegistro: String(selectedEquipo.fiscal_serial || '').trim(),
    });
    setEditingId(null);
    setEditingEquipo(null);
    setSupplierCatalog([]);
    setNewSupplierModel({ marca: '', modelo: '' });
    modal.onOpen();
  };

  const openEditModal = async (rowId) => {
    try {
      setSaving(true);
      const { data } = await client.get(`/api/reenajenacion/registros/${rowId}`);
      const row = data;
      setEditingId(rowId);
      setEditingEquipo({
        memo_number: '',
        supplier_name: row.supplier_name,
        supplier_rif: row.supplier_rif,
        transferor_contact_name: row.transferor_contact_name,
        transferor_contact_rif: row.transferor_contact_rif,
        fiscal_serial: row.fiscal_serial,
      });
      setModalForm({
        ...emptyModalForm(),
        recipientRazonSocial: row.recipient_razon_social || '',
        recipientRif: row.recipient_rif || '',
        fechaReenajenacion: String(row.fecha_reenajenacion || '').slice(0, 10),
        direccion: row.direccion || '',
        direccionEspecifica: row.direccion_especifica || '',
        ciudadEstado: row.ciudad_estado || '',
        zonaPostal: row.zona_postal || '',
        representanteLegal: row.representante_legal || '',
        numeroComunicacion: row.numero_comunicacion || '',
        fechaComunicacion: String(row.fecha_comunicacion || '').slice(0, 10),
        fechaRecibidoGf: row.fecha_recibido_gf ? String(row.fecha_recibido_gf).slice(0, 10) : '',
        marca: row.marca || '',
        modelo: row.modelo || '',
        numeroRegistro: row.numero_registro || String(row.fiscal_serial || '').trim(),
      });
      setSupplierCatalog([]);
      setNewSupplierModel({ marca: '', modelo: '' });
      modal.onOpen();
    } catch (err) {
      toast({
        title: 'No se pudo abrir para edición',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!modal.isOpen || !activeEquipo?.supplier_rif) return;
    client
      .get('/api/reenajenacion/supplier-models', { params: { supplierRif: activeEquipo.supplier_rif } })
      .then((r) => setSupplierCatalog(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSupplierCatalog([]));
  }, [modal.isOpen, activeEquipo?.supplier_rif]);

  const submitRegistro = async () => {
    if (!activeEquipo) return;
    if (!modalForm.recipientRazonSocial?.trim() || !modalForm.recipientRif?.trim()) {
      toast({ title: 'Indique quién recibe (razón social y RIF)', status: 'warning' });
      return;
    }
    if (!modalForm.numeroComunicacion?.trim() || !modalForm.fechaComunicacion) {
      toast({ title: 'N° y fecha de comunicación son obligatorios', status: 'warning' });
      return;
    }
    if (!modalForm.marca || !modalForm.modelo) {
      toast({ title: 'Marca y modelo son obligatorios', status: 'warning' });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        fiscalBatchItemId: selectedEquipo?.item_id,
        recipientRazonSocial: modalForm.recipientRazonSocial,
        recipientRif: modalForm.recipientRif,
        fechaReenajenacion: modalForm.fechaReenajenacion,
        direccion: modalForm.direccion,
        direccionEspecifica: modalForm.direccionEspecifica,
        ciudadEstado: modalForm.ciudadEstado,
        zonaPostal: modalForm.zonaPostal,
        representanteLegal: modalForm.representanteLegal,
        numeroComunicacion: modalForm.numeroComunicacion,
        fechaComunicacion: modalForm.fechaComunicacion,
        fechaRecibidoGf: modalForm.fechaRecibidoGf || null,
        marca: modalForm.marca,
        modelo: modalForm.modelo,
        numeroRegistro: modalForm.numeroRegistro,
      };
      const { data } = editingId
        ? await client.patch(`/api/reenajenacion/registros/${editingId}`, payload)
        : await client.post('/api/reenajenacion/registros', payload);
      toast({ title: editingId ? 'Reenajenación actualizada' : 'Reenajenación registrada', status: 'success' });
      modal.onClose();
      setSelectedItemId('');
      setEditingId(null);
      setEditingEquipo(null);
      await loadAll();
      return data;
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const generateDoc = async (id, docType) => {
    try {
      setGeneratingId(id);
      const { data } = await client.post(`/api/reenajenacion/registros/${id}/generate-document`, null, {
        params: docType ? { docType } : {},
      });
      toast({ title: 'Documento Word generado', status: 'success' });
      const url = data.downloadUrl;
      if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      await loadAll();
    } catch (err) {
      toast({
        title: 'No se pudo generar el Word',
        description: err.response?.data?.error || err.message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const cellTwoLines = (a, b) => (
    <VStack align="start" spacing={0} fontSize="sm">
      <ChakraText fontWeight="600">{a || '—'}</ChakraText>
      <ChakraText color="gray.600" fontSize="xs">
        {b || '—'}
      </ChakraText>
    </VStack>
  );

  return (
    <VStack spacing={6} align="stretch" w="full">
      <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="md" p={4}>
        <ChakraText fontSize="sm" color="gray.800">
          Cada máquina se reenajena <strong>por separado</strong>. Debe existir antes una{' '}
          <strong>desincorporación</strong> con el lote marcado{' '}
          <strong>«Desincorporación para reenajenación»</strong>. Datos de contacto y Nº máquina provienen de ese lote
          (quien transfiere).{' '}
          <Link as={RouterLink} to="/fiscal/desincorporacion" color="brand.600" fontWeight="700">
            Ir a desincorporación
          </Link>
        </ChakraText>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
          <ChakraText fontSize="xs" color="gray.500">
            Total reenajenaciones
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="800">
            {stats.total ?? 0}
          </ChakraText>
        </Box>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
          <ChakraText fontSize="xs" color="gray.500">
            Este mes
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="800">
            {stats.total_mes ?? 0}
          </ChakraText>
        </Box>
        <Box bg="white" p={4} borderRadius="md" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
          <ChakraText fontSize="xs" color="gray.500">
            Últimos 7 días
          </ChakraText>
          <ChakraText fontSize="2xl" fontWeight="800">
            {stats.ultima_semana ?? 0}
          </ChakraText>
        </Box>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
        <Box bg="white" borderRadius="md" boxShadow="sm" p={4} borderWidth="1px" borderColor="gray.200">
          <Heading size="sm" mb={3}>
            Reenajenaciones por mes
          </Heading>
          <Box h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={Array.isArray(stats.byMonth) ? stats.byMonth : []} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#1A202C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        <Box bg="white" borderRadius="md" boxShadow="sm" p={4} borderWidth="1px" borderColor="gray.200">
          <Heading size="sm" mb={3}>
            Reenajenaciones por proveedor
          </Heading>
          <Box h="260px">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={(Array.isArray(stats.bySupplier) ? stats.bySupplier : []).map((r) => ({
                  name: `${r.supplier_name || ''}${r.supplier_rif ? ` (${r.supplier_rif})` : ''}`.trim(),
                  total: r.total,
                }))}
                margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="total" name="Total" fill="#2B6CB0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </SimpleGrid>

      <Box bg="white" borderRadius="md" boxShadow="sm" p={4} borderWidth="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
          <Heading size="sm">Equipos pendientes de reenajenación</Heading>
          <Button colorScheme="brand" size="sm" onClick={openModal} isDisabled={!selectedItemId}>
            Abrir formulario de reenajenación
          </Button>
        </HStack>
        <ChakraText fontSize="xs" color="gray.600" mb={2}>
          Seleccione <strong>un</strong> equipo (reenajenación individual). Los datos de contacto y Nº máquina salen
          del módulo de desincorporación.
        </ChakraText>
        {pendientes.length === 0 ? (
          <ChakraText fontSize="sm" color="gray.500">
            No hay equipos pendientes (desincorpore con «para reenajenación» y sin trámite previo).
          </ChakraText>
        ) : (
          <RadioGroup value={selectedItemId} onChange={setSelectedItemId}>
            <Box overflowX="auto">
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th w="40px" />
                    <Th>Memo</Th>
                    <Th>Proveedor</Th>
                    <Th>Razón social (contacto)</Th>
                    <Th>RIF (contacto)</Th>
                    <Th>Nº máquina</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {pendientes.map((p) => (
                    <Tr key={p.item_id}>
                      <Td verticalAlign="middle">
                        <Radio value={String(p.item_id)} />
                      </Td>
                      <Td>{p.memo_number}</Td>
                      <Td>{p.supplier_name}</Td>
                      <Td>{p.transferor_contact_name}</Td>
                      <Td>{p.transferor_contact_rif}</Td>
                      <Td fontWeight="600">{p.fiscal_serial}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </RadioGroup>
        )}
      </Box>

      <Box bg="white" borderRadius="md" boxShadow="sm" p={4} borderWidth="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={3} flexWrap="wrap" gap={2}>
          <Heading size="sm">Equipos reenajenados</Heading>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.open('/api/reports/reenajenadas.pdf', '_blank', 'noopener,noreferrer');
            }}
          >
            Exportar PDF
          </Button>
        </HStack>
        <ChakraText fontSize="xs" color="gray.600" mb={2}>
          Listado con quien transfiere, quien recibe, proveedor, RIFs, serial y fecha.
        </ChakraText>
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Fecha</Th>
                <Th>Transfiere</Th>
                <Th>Recibe</Th>
                <Th>Proveedor</Th>
                <Th>Nº máquina</Th>
                <Th>Doc.</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {registros.map((r) => (
                <Tr key={r.id}>
                  <Td whiteSpace="nowrap">{r.fecha_reenajenacion}</Td>
                  <Td>
                    {cellTwoLines(r.transferor_contact_name, `RIF: ${r.transferor_contact_rif}`)}
                  </Td>
                  <Td>
                    {cellTwoLines(r.recipient_razon_social, `RIF: ${r.recipient_rif}`)}
                  </Td>
                  <Td>
                    {cellTwoLines(r.supplier_name, `RIF: ${r.supplier_rif}`)}
                  </Td>
                  <Td fontWeight="600">{r.fiscal_serial}</Td>
                  <Td>
                    <HStack spacing={3}>
                      {r.generated_doc_oficio_path ? (
                        <Button
                          as="a"
                          size="xs"
                          variant="link"
                          href={`/uploads/${r.generated_doc_oficio_path}`}
                          target="_blank"
                        >
                          Oficio
                        </Button>
                      ) : (
                        <ChakraText fontSize="sm" color="gray.500">
                          —
                        </ChakraText>
                      )}
                      {r.generated_doc_memo_path ? (
                        <Button
                          as="a"
                          size="xs"
                          variant="link"
                          href={`/uploads/${r.generated_doc_memo_path}`}
                          target="_blank"
                        >
                          Memo
                        </Button>
                      ) : null}
                    </HStack>
                  </Td>
                  <Td>
                    <HStack spacing={2} flexWrap="wrap">
                      <Button size="xs" variant="ghost" onClick={() => openEditModal(r.id)}>
                        Editar
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={async () => {
                          await generateDoc(r.id, 'oficio');
                          await generateDoc(r.id, 'memo');
                        }}
                        isLoading={generatingId === r.id}
                        isDisabled={generatingId != null}
                      >
                        Word
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Modal isOpen={modal.isOpen} onClose={modal.onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nueva reenajenación</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {modal.isOpen && activeEquipo ? (
              <VStack spacing={4} align="stretch">
                <Box bg="gray.50" borderRadius="md" p={3} borderWidth="1px" borderColor="gray.200">
                  <ChakraText fontSize="xs" fontWeight="700" color="gray.600" mb={2}>
                    Desde desincorporación (contribuyente que transfiere / encabezado del Word)
                  </ChakraText>
                  <SimpleGrid columns={2} spacing={2} fontSize="sm">
                    <ChakraText color="gray.600">
                      Memo <strong>{String(activeEquipo.memo_number ?? '')}</strong>
                    </ChakraText>
                    <ChakraText color="gray.600">
                      Proveedor <strong>{String(activeEquipo.supplier_name ?? '')}</strong> · {String(activeEquipo.supplier_rif ?? '')}
                    </ChakraText>
                    <ChakraText color="gray.600">
                      Razón social (contacto){' '}
                      <strong>{String(activeEquipo.transferor_contact_name ?? '')}</strong>
                    </ChakraText>
                    <ChakraText color="gray.600">
                      RIF (contacto) <strong>{String(activeEquipo.transferor_contact_rif ?? '')}</strong>
                    </ChakraText>
                    <Box gridColumn="1 / -1">
                      <ChakraText color="gray.600" fontSize="sm">
                        Nº máquina <strong>{String(activeEquipo.fiscal_serial ?? '')}</strong>
                      </ChakraText>
                    </Box>
                  </SimpleGrid>
                </Box>

                <FormControl isRequired>
                  <FormLabel>Razón social quien recibe</FormLabel>
                  <Input
                    value={modalForm.recipientRazonSocial}
                    onChange={(e) => setModalForm((f) => ({ ...f, recipientRazonSocial: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>RIF quien recibe</FormLabel>
                  <Input
                    value={modalForm.recipientRif}
                    onChange={(e) => setModalForm((f) => ({ ...f, recipientRif: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Fecha de reenajenación</FormLabel>
                  <Input
                    type="date"
                    value={modalForm.fechaReenajenacion}
                    onChange={(e) => setModalForm((f) => ({ ...f, fechaReenajenacion: e.target.value }))}
                  />
                </FormControl>

                <Heading size="xs" color="gray.700">
                  Domicilio (opcional)
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl>
                    <FormLabel>Dirección</FormLabel>
                    <Input
                      value={modalForm.direccion}
                      onChange={(e) => setModalForm((f) => ({ ...f, direccion: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Dirección específica</FormLabel>
                    <Input
                      value={modalForm.direccionEspecifica}
                      onChange={(e) => setModalForm((f) => ({ ...f, direccionEspecifica: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Ciudad y estado</FormLabel>
                    <Input
                      value={modalForm.ciudadEstado}
                      onChange={(e) => setModalForm((f) => ({ ...f, ciudadEstado: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Zona postal</FormLabel>
                    <Input
                      value={modalForm.zonaPostal}
                      onChange={(e) => setModalForm((f) => ({ ...f, zonaPostal: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl gridColumn={{ md: '1 / -1' }}>
                    <FormLabel>Representante legal</FormLabel>
                    <Input
                      value={modalForm.representanteLegal}
                      onChange={(e) => setModalForm((f) => ({ ...f, representanteLegal: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>

                <Heading size="xs" color="gray.700">
                  Comunicación
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl isRequired>
                    <FormLabel>N° comunicación</FormLabel>
                    <Input
                      value={modalForm.numeroComunicacion}
                      onChange={(e) => setModalForm((f) => ({ ...f, numeroComunicacion: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Fecha comunicación</FormLabel>
                    <Input
                      type="date"
                      value={modalForm.fechaComunicacion}
                      onChange={(e) => setModalForm((f) => ({ ...f, fechaComunicacion: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Fecha recibido GF</FormLabel>
                    <Input
                      type="date"
                      value={modalForm.fechaRecibidoGf}
                      onChange={(e) => setModalForm((f) => ({ ...f, fechaRecibidoGf: e.target.value }))}
                    />
                  </FormControl>
                </SimpleGrid>

                <Heading size="xs" color="gray.700">
                  Equipo (marca / modelo)
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                  <FormControl isRequired>
                    <FormLabel>Marca</FormLabel>
                    <Select
                      placeholder="Seleccione"
                      value={modalForm.marca}
                      onChange={(e) => setModalForm((f) => ({ ...f, marca: e.target.value, modelo: '' }))}
                    >
                      {marcas.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Modelo</FormLabel>
                    <Select
                      placeholder={modalForm.marca ? 'Seleccione' : 'Marca primero'}
                      value={modalForm.modelo}
                      isDisabled={!modalForm.marca}
                      onChange={(e) => setModalForm((f) => ({ ...f, modelo: e.target.value }))}
                    >
                      {modelos.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  {isAdmin ? (
                    <Box
                      gridColumn={{ md: '1 / -1' }}
                      bg="gray.50"
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="md"
                      p={3}
                    >
                      <ChakraText fontSize="xs" fontWeight="700" color="gray.600" mb={2}>
                        (Admin) Registrar nueva marca/modelo para este proveedor
                      </ChakraText>
                      <HStack spacing={2} flexWrap="wrap">
                        <Input
                          placeholder="Marca"
                          maxW="220px"
                          value={newSupplierModel.marca}
                          onChange={(e) => setNewSupplierModel((s) => ({ ...s, marca: e.target.value }))}
                        />
                        <Input
                          placeholder="Modelo"
                          maxW="220px"
                          value={newSupplierModel.modelo}
                          onChange={(e) => setNewSupplierModel((s) => ({ ...s, modelo: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const marca = String(newSupplierModel.marca || modalForm.marca || '').trim();
                              const modelo = String(newSupplierModel.modelo || modalForm.modelo || '').trim();
                              if (!marca || !modelo) {
                                toast({ title: 'Indique marca y modelo', status: 'warning' });
                                return;
                              }
                              const { data } = await client.post('/api/reenajenacion/supplier-models', {
                                supplierRif: activeEquipo?.supplier_rif,
                                marca,
                                modelo,
                              });
                              setSupplierCatalog(Array.isArray(data) ? data : []);
                              setNewSupplierModel({ marca: '', modelo: '' });
                              toast({ title: 'Marca/modelo registrada', status: 'success' });
                            } catch (err) {
                              toast({
                                title: 'Error',
                                description: err.response?.data?.error || err.message,
                                status: 'error',
                              });
                            }
                          }}
                        >
                          Agregar
                        </Button>
                      </HStack>
                      <ChakraText fontSize="xs" color="gray.500" mt={2}>
                        Se asocia al proveedor actual ({String(activeEquipo?.supplier_rif || '')}).
                      </ChakraText>
                    </Box>
                  ) : null}
                  <FormControl gridColumn={{ md: '1 / -1' }}>
                    <FormLabel>N° registro</FormLabel>
                    <Input
                      value={modalForm.numeroRegistro}
                      isReadOnly
                      bg="gray.100"
                    />
                    <FormHelperText>
                      Plantilla activa <code>reenajenacion_formulario</code>: encabezado = contribuyente que transfiere (
                      {`{razon_social}`}, {`{rif}`}, {`{contribuyente_transfiere_razon}`}…).
                    </FormHelperText>
                  </FormControl>
                </SimpleGrid>
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={modal.onClose}>
              Cancelar
            </Button>
            <Button
              colorScheme="blue"
              isLoading={saving || generatingId != null}
              onClick={async () => {
                const row = await submitRegistro();
                if (!row?.id) return;
                await generateDoc(row.id, 'oficio');
                await generateDoc(row.id, 'memo');
              }}
            >
              Word
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
