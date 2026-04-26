import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isScopedDivisionUser } from '../utils/divisionUi.js';
import { uploadUrl } from '../utils/uploadUrl.js';

const CHART_PALETTE = ['#9B2C2C', '#C53030', '#E53E3E', '#FC8181', '#742A2A', '#822727', '#4A5568', '#D69E2E', '#744210'];

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="600">
        {name}
      </ChakraText>
      <ChakraText fontSize="sm" color="gray.600">
        {value} bien{value === 1 ? '' : 'es'}
      </ChakraText>
    </Box>
  );
}

function BarTooltipAssigned({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const label = row.fullName ?? row.name;
  return (
    <Box bg="white" px={3} py={2} borderRadius="md" boxShadow="md" borderWidth="1px" borderColor="gray.100">
      <ChakraText fontSize="sm" fontWeight="600">
        {label}
      </ChakraText>
      <ChakraText fontSize="sm" color="gray.600">
        {payload[0].value} bien{payload[0].value === 1 ? '' : 'es'}
      </ChakraText>
    </Box>
  );
}

function ChartEmpty({ message }) {
  return (
    <Box h="220px" display="flex" alignItems="center" justifyContent="center" bg="gray.50" borderRadius="md">
      <ChakraText fontSize="sm" color="gray.500">
        {message}
      </ChakraText>
    </Box>
  );
}

/**
 * Inventario de bienes nacionales con foto, división y persona asignada (o no asignado).
 */
export default function NationalAssetsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isDivisionOnly = isScopedDivisionUser(user);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isTypesOpen,
    onOpen: onTypesOpen,
    onClose: onTypesClose,
  } = useDisclosure();
  const {
    isOpen: isPhotoPreviewOpen,
    onOpen: onPhotoPreviewOpen,
    onClose: onPhotoPreviewClose,
  } = useDisclosure();
  const [photoPreview, setPhotoPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [byDivision, setByDivision] = useState([]);
  const [byPerson, setByPerson] = useState([]);
  const [byType, setByType] = useState([]);
  const [summary, setSummary] = useState({ total: 0, assigned: 0, unassigned: 0 });
  const [catalog, setCatalog] = useState({ divisions: [], assetTypes: [], assignees: [] });
  const [filters, setFilters] = useState({
    divisionId: '',
    assetTypeId: '',
    assignedUserId: '',
    assetCode: '',
    unassignedOnly: false,
    disincorporated: '',
  });
  const [form, setForm] = useState({
    assetTypeId: '',
    assetCode: '',
    divisionId: '',
    assignedUserId: '',
    unassigned: false,
    disincorporated: false,
    disincorporatedDate: '',
    disincorporatedObservation: '',
    photo: null,
  });
  const [editing, setEditing] = useState(null);
  const [typesAdmin, setTypesAdmin] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');

  const filterAssigneeOptions = useMemo(() => {
    const list = catalog.assignees || [];
    if (!filters.divisionId) return list;
    const id = Number(filters.divisionId);
    if (!Number.isFinite(id)) return list;
    return list.filter((u) => u.division_id != null && Number(u.division_id) === id);
  }, [catalog.assignees, filters.divisionId]);

  const formAssigneeOptions = useMemo(() => {
    const list = catalog.assignees || [];
    if (!form.divisionId) return [];
    const id = Number(form.divisionId);
    if (!Number.isFinite(id)) return [];
    let base = list.filter((u) => u.division_id != null && Number(u.division_id) === id);
    const curId = editing?.assigned_user_id || form.assignedUserId;
    if (curId) {
      const cur = list.find((u) => u.id === curId);
      if (cur && !base.some((u) => u.id === cur.id)) {
        base = [cur, ...base];
      }
    }
    return base;
  }, [catalog.assignees, form.divisionId, form.assignedUserId, editing]);

  const load = async () => {
    const params = {};
    if (filters.divisionId) params.divisionId = filters.divisionId;
    if (filters.assetTypeId) params.assetTypeId = filters.assetTypeId;
    if (filters.assignedUserId) params.assignedUserId = filters.assignedUserId;
    if (filters.assetCode) params.assetCode = filters.assetCode;
    if (filters.unassignedOnly) params.unassignedOnly = 'true';
    if (filters.disincorporated) params.disincorporated = filters.disincorporated;
    const [listRes, summaryRes, catRes] = await Promise.all([
      client.get('/api/national-assets', { params }),
      client.get('/api/national-assets/stats/summary'),
      client.get('/api/catalogs'),
    ]);
    setRows(listRes.data);
    setSummary(summaryRes.data.summary);
    setByType(summaryRes.data.byType);
    setByDivision(summaryRes.data.byDivision);
    setByPerson(summaryRes.data.byPerson);
    setCatalog(catRes.data);
  };

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

  const exportAssets = async (kind) => {
    try {
      const params = {};
      if (filters.divisionId) params.divisionId = filters.divisionId;
      if (filters.assetTypeId) params.assetTypeId = filters.assetTypeId;
      if (filters.assignedUserId) params.assignedUserId = filters.assignedUserId;
      if (filters.assetCode) params.assetCode = filters.assetCode;
      if (filters.unassignedOnly) params.unassignedOnly = 'true';
      if (filters.disincorporated) params.disincorporated = filters.disincorporated;
      const endpoint = kind === 'pdf' ? '/api/reports/national-assets.pdf' : '/api/reports/national-assets.xlsx';
      const filename = kind === 'pdf' ? 'bienes_nacionales.pdf' : 'bienes_nacionales.xlsx';
      const res = await client.get(endpoint, { params, responseType: 'blob' });
      downloadBlob(res.data, filename);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photoUrl = (path) => uploadUrl(path);

  const openPhotoPreview = (row) => {
    if (!row.photo_path) return;
    setPhotoPreview({
      src: photoUrl(row.photo_path),
      alt: `Foto del bien ${row.asset_code}`,
      caption: `${row.asset_type_name} · Código ${row.asset_code}`,
    });
    onPhotoPreviewOpen();
  };

  const closePhotoPreview = () => {
    onPhotoPreviewClose();
    setPhotoPreview(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      assetTypeId: '',
      assetCode: '',
      divisionId: '',
      assignedUserId: '',
      unassigned: false,
      disincorporated: false,
      disincorporatedDate: '',
      disincorporatedObservation: '',
      photo: null,
    });
    onOpen();
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      assetTypeId: String(row.asset_type_id),
      assetCode: row.asset_code,
      divisionId: String(row.division_id),
      assignedUserId: row.assigned_user_id || '',
      unassigned: !row.assigned_user_id,
      disincorporated: Boolean(row.disincorporated),
      disincorporatedDate: row.disincorporated_date ? String(row.disincorporated_date).slice(0, 10) : '',
      disincorporatedObservation: row.disincorporated_observation || '',
      photo: null,
    });
    onOpen();
  };

  const submit = async () => {
    try {
      if (isDivisionOnly && editing) {
        await client.patch(`/api/national-assets/${editing.id}`, {
          unassigned: form.unassigned,
          assignedUserId: form.unassigned ? null : form.assignedUserId || null,
        });
        toast({ title: 'Asignación actualizada', status: 'success' });
        onClose();
        await load();
        return;
      }

      const fd = new FormData();
      fd.append('assetTypeId', form.assetTypeId);
      fd.append('assetCode', form.assetCode);
      fd.append('divisionId', form.divisionId);
      fd.append('unassigned', form.unassigned ? 'true' : 'false');
      fd.append('disincorporated', form.disincorporated ? 'true' : 'false');
      if (form.disincorporatedDate) fd.append('disincorporatedDate', form.disincorporatedDate);
      if (form.disincorporatedObservation) fd.append('disincorporatedObservation', form.disincorporatedObservation);
      if (!form.unassigned && form.assignedUserId) {
        fd.append('assignedUserId', form.assignedUserId);
      }
      if (form.photo) fd.append('photo', form.photo);

      if (!editing) {
        await client.post('/api/national-assets', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({ title: 'Bien registrado', status: 'success' });
      } else if (form.photo) {
        await client.patch(`/api/national-assets/${editing.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({ title: 'Bien actualizado', status: 'success' });
      } else {
        await client.patch(`/api/national-assets/${editing.id}`, {
          assetTypeId: Number(form.assetTypeId),
          assetCode: form.assetCode,
          divisionId: Number(form.divisionId),
          unassigned: form.unassigned,
          assignedUserId: form.unassigned ? null : form.assignedUserId || null,
          disincorporated: form.disincorporated,
          disincorporatedDate: form.disincorporated ? form.disincorporatedDate || null : null,
          disincorporatedObservation: form.disincorporated ? form.disincorporatedObservation || null : null,
        });
        toast({ title: 'Bien actualizado', status: 'success' });
      }
      onClose();
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const openTypes = async () => {
    if (isDivisionOnly) return;
    try {
      const res = await client.get('/api/national-asset-types');
      setTypesAdmin(res.data);
      onTypesOpen();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const createType = async () => {
    if (isDivisionOnly) return;
    try {
      const name = newTypeName.trim();
      if (!name) return;
      await client.post('/api/national-asset-types', { name });
      setNewTypeName('');
      const [adminRes, catRes] = await Promise.all([client.get('/api/national-asset-types'), client.get('/api/catalogs')]);
      setTypesAdmin(adminRes.data);
      setCatalog(catRes.data);
      toast({ title: 'Tipo creado', status: 'success' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const toggleTypeActive = async (row) => {
    if (isDivisionOnly) return;
    try {
      await client.patch(`/api/national-asset-types/${row.id}`, { active: !row.active });
      const [adminRes, catRes] = await Promise.all([client.get('/api/national-asset-types'), client.get('/api/catalogs')]);
      setTypesAdmin(adminRes.data);
      setCatalog(catRes.data);
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const assignmentPieData = useMemo(() => {
    const rows = [
      { name: 'Asignados', value: Number(summary.assigned) || 0 },
      { name: 'No asignados', value: Number(summary.unassigned) || 0 },
    ];
    return rows.filter((d) => d.value > 0);
  }, [summary.assigned, summary.unassigned]);

  const typePieData = useMemo(
    () => byType.map((r) => ({ name: r.type, value: Number(r.total) || 0 })).filter((d) => d.value > 0),
    [byType]
  );

  const divisionBarData = useMemo(
    () =>
      byDivision.map((r) => {
        const full = r.division || '';
        return {
          fullName: full,
          name: full.length > 20 ? `${full.slice(0, 20)}…` : full,
          value: Number(r.total) || 0,
        };
      }),
    [byDivision]
  );

  const personBarData = useMemo(
    () =>
      byPerson.map((r) => {
        const full = r.person || '';
        return {
          fullName: full,
          name: full.length > 20 ? `${full.slice(0, 20)}…` : full,
          value: Number(r.total) || 0,
        };
      }),
    [byPerson]
  );

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Bienes nacionales</Heading>
        <HStack>
          <Button variant="outline" onClick={() => exportAssets('pdf')}>
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={() => exportAssets('xlsx')}>
            Exportar Excel
          </Button>
          {!isDivisionOnly ? (
            <Button variant="outline" onClick={openTypes}>
              Tipos de bien
            </Button>
          ) : null}
          {!isDivisionOnly ? (
            <Button colorScheme="brand" onClick={openCreate}>
              Nuevo bien
            </Button>
          ) : null}
        </HStack>
      </HStack>

      {isDivisionOnly ? (
        <Box mb={4} p={3} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.100">
          <ChakraText fontSize="sm" color="gray.700">
            Vista acotada a <strong>{user?.divisionName || 'su división'}</strong>. El <strong>Despacho</strong> registra
            cada bien y lo asigna a una división; desde aquí solo puede <strong>asignar o quitar la persona</strong>{' '}
            responsable dentro de su unidad (o dejarlo sin asignar).
          </ChakraText>
        </Box>
      ) : null}

      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={4} mb={4}>
        <Box
          bg="white"
          p={4}
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <ChakraText fontWeight="700" fontSize="sm" color="gray.700">
            Totales
          </ChakraText>
          <ChakraText fontSize="xs" color="gray.500" mb={1}>
            Inventario: <strong>{summary.total}</strong> bien{summary.total === 1 ? '' : 'es'} · Torta por asignación
          </ChakraText>
          {summary.total === 0 ? (
            <ChartEmpty message="Sin bienes registrados" />
          ) : assignmentPieData.length === 0 ? (
            <ChartEmpty message="Sin datos de asignación" />
          ) : (
            <Box h="240px" w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Pie
                    data={assignmentPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {assignmentPieData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => <span style={{ fontSize: '12px', color: '#4A5568' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>

        <Box
          bg="white"
          p={4}
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <ChakraText fontWeight="700" fontSize="sm" color="gray.700">
            Por división
          </ChakraText>
          <ChakraText fontSize="xs" color="gray.500" mb={1}>
            Barras horizontales por división de asignación
          </ChakraText>
          {divisionBarData.length === 0 ? (
            <ChartEmpty message="Sin datos por división" />
          ) : (
            <Box h="240px" w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={divisionBarData}
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<BarTooltipAssigned />} cursor={{ fill: 'rgba(197, 48, 48, 0.08)' }} />
                  <Bar dataKey="value" name="Cantidad" radius={[0, 6, 6, 0]} barSize={16}>
                    {divisionBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>

        <Box
          bg="white"
          p={4}
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <ChakraText fontWeight="700" fontSize="sm" color="gray.700">
            Por tipo
          </ChakraText>
          <ChakraText fontSize="xs" color="gray.500" mb={1}>
            Torta por tipo de bien nacional
          </ChakraText>
          {typePieData.length === 0 ? (
            <ChartEmpty message="Sin datos por tipo" />
          ) : (
            <Box h="240px" w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Pie
                    data={typePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={40}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {typePieData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[(i + 1) % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span style={{ fontSize: '11px', color: '#4A5568' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>

        <Box
          bg="white"
          p={4}
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
          borderColor="gray.100"
        >
          <ChakraText fontWeight="700" fontSize="sm" color="gray.700">
            Por persona
          </ChakraText>
          <ChakraText fontSize="xs" color="gray.500" mb={1}>
            Barras por persona asignada (incl. «No asignado»)
          </ChakraText>
          {personBarData.length === 0 ? (
            <ChartEmpty message="Sin datos por persona" />
          ) : (
            <Box h="240px" w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={personBarData}
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal stroke="#E2E8F0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<BarTooltipAssigned />} cursor={{ fill: 'rgba(197, 48, 48, 0.08)' }} />
                  <Bar dataKey="value" name="Cantidad" radius={[0, 6, 6, 0]} barSize={16}>
                    {personBarData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[(i + 3) % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Box>
      </SimpleGrid>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={4}>
        <HStack spacing={3} flexWrap="wrap">
          <Input
            placeholder="Buscar por código"
            maxW="240px"
            value={filters.assetCode}
            onChange={(e) => setFilters((f) => ({ ...f, assetCode: e.target.value }))}
          />
          {!isDivisionOnly ? (
            <Select
              placeholder="División"
              maxW="240px"
              value={filters.divisionId}
              onChange={(e) => setFilters((f) => ({ ...f, divisionId: e.target.value }))}
            >
              {catalog.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Select
            placeholder="Tipo de bien"
            maxW="240px"
            value={filters.assetTypeId}
            onChange={(e) => setFilters((f) => ({ ...f, assetTypeId: e.target.value }))}
          >
            {catalog.assetTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          <Select
            placeholder="Persona"
            maxW="240px"
            value={filters.assignedUserId}
            onChange={(e) => setFilters((f) => ({ ...f, assignedUserId: e.target.value }))}
            isDisabled={filters.unassignedOnly}
          >
            {filterAssigneeOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Checkbox
            isChecked={filters.unassignedOnly}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                unassignedOnly: e.target.checked,
                assignedUserId: e.target.checked ? '' : f.assignedUserId,
              }))
            }
          >
            Solo no asignados
          </Checkbox>
          <Select
            placeholder="Estado"
            maxW="220px"
            value={filters.disincorporated}
            onChange={(e) => setFilters((f) => ({ ...f, disincorporated: e.target.value }))}
          >
            <option value="false">Solo activos</option>
            <option value="true">Solo desincorporados</option>
          </Select>
          <Button onClick={() => load()}>Aplicar</Button>
        </HStack>
      </Box>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Nº</Th>
              <Th>Tipo</Th>
              <Th>Código</Th>
              <Th>División</Th>
              <Th>Persona</Th>
              <Th>Desincorp.</Th>
              <Th>Foto</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.registry_number}</Td>
                <Td>{r.asset_type_name}</Td>
                <Td>{r.asset_code}</Td>
                <Td>{r.division_name}</Td>
                <Td>{r.assigned_name || 'No asignado'}</Td>
                <Td>{r.disincorporated ? 'Sí' : 'No'}</Td>
                <Td>
                  {r.photo_path ? (
                    <Popover trigger="hover" openDelay={150} closeDelay={100} placement="right" gutter={10}>
                      <PopoverTrigger>
                        <Box
                          as="button"
                          type="button"
                          display="inline-block"
                          borderWidth="0"
                          p={0}
                          bg="transparent"
                          cursor="zoom-in"
                          lineHeight={0}
                          borderRadius="md"
                          onClick={() => openPhotoPreview(r)}
                          aria-label={`Ampliar foto del bien ${r.asset_code}`}
                          _focusVisible={{ outline: '2px solid', outlineColor: 'brand.500', outlineOffset: '2px' }}
                        >
                          <Image
                            src={photoUrl(r.photo_path)}
                            alt=""
                            boxSize="48px"
                            objectFit="cover"
                            borderRadius="md"
                            pointerEvents="none"
                          />
                        </Box>
                      </PopoverTrigger>
                      <PopoverContent
                        w="auto"
                        borderWidth="1px"
                        boxShadow="lg"
                        sx={{ maxWidth: 'min(90vw, 360px)' }}
                      >
                        <PopoverBody p={2}>
                          <Image
                            src={photoUrl(r.photo_path)}
                            alt={`Vista previa ${r.asset_code}`}
                            maxH="280px"
                            maxW="320px"
                            w="auto"
                            h="auto"
                            objectFit="contain"
                            borderRadius="md"
                          />
                          <ChakraText fontSize="xs" color="gray.600" mt={2} textAlign="center">
                            Clic para ver a tamaño completo
                          </ChakraText>
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  <Button size="xs" onClick={() => openEdit(r)}>
                    Editar
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isPhotoPreviewOpen} onClose={closePhotoPreview} size="4xl" isCentered>
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent mx={{ base: 3, md: 6 }} bg="gray.900" borderWidth={0}>
          <ModalCloseButton color="white" _hover={{ bg: 'whiteAlpha.200' }} />
          <ModalBody p={{ base: 3, md: 6 }}>
            {photoPreview ? (
              <VStack spacing={3}>
                <Image
                  src={photoPreview.src}
                  alt={photoPreview.alt}
                  maxH={{ base: '70vh', md: '80vh' }}
                  w="full"
                  objectFit="contain"
                  borderRadius="md"
                />
                <ChakraText color="gray.300" fontSize="sm" textAlign="center">
                  {photoPreview.caption}
                </ChakraText>
              </VStack>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editing ? (isDivisionOnly ? 'Asignar responsable del bien' : 'Editar bien') : 'Registrar bien'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              {isDivisionOnly && editing ? (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                  <ChakraText fontSize="sm" mb={1}>
                    <strong>Tipo:</strong> {editing.asset_type_name}
                  </ChakraText>
                  <ChakraText fontSize="sm" mb={1}>
                    <strong>Código:</strong> {editing.asset_code}
                  </ChakraText>
                  <ChakraText fontSize="sm">
                    <strong>División del bien:</strong> {editing.division_name}
                  </ChakraText>
                </Box>
              ) : (
                <>
                  <FormControl isRequired>
                    <FormLabel>Tipo de bien</FormLabel>
                    <Select
                      placeholder="Seleccione"
                      value={form.assetTypeId}
                      onChange={(e) => setForm((f) => ({ ...f, assetTypeId: e.target.value }))}
                    >
                      {catalog.assetTypes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Código del bien</FormLabel>
                    <Input
                      value={form.assetCode}
                      onChange={(e) => setForm((f) => ({ ...f, assetCode: e.target.value }))}
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>División de asignación</FormLabel>
                    <ChakraText fontSize="sm" color="gray.600" mb={1}>
                      Asignación primaria: el bien queda bajo la responsabilidad de la división elegida. Solo puede
                      indicar personas <strong>adscritas a esa misma división</strong> (incluido el personal del
                      Despacho cuando el bien pertenece al Despacho).
                    </ChakraText>
                    <Select
                      placeholder="Seleccione"
                      value={form.divisionId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, divisionId: e.target.value, assignedUserId: '' }))
                      }
                    >
                      {catalog.divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
              <Checkbox
                isChecked={form.unassigned}
                onChange={(e) => setForm((f) => ({ ...f, unassigned: e.target.checked, assignedUserId: '' }))}
              >
                Sin persona asignada (el bien sigue en la división)
              </Checkbox>
              {!form.unassigned && (
                <FormControl>
                  <FormLabel>Persona asignada</FormLabel>
                  {!form.divisionId && !isDivisionOnly ? (
                    <ChakraText fontSize="sm" color="gray.500" mb={1}>
                      Elija primero la división del bien para listar a quienes están adscritos allí.
                    </ChakraText>
                  ) : null}
                  <Select
                    placeholder={form.divisionId ? 'Seleccione' : 'Seleccione división primero'}
                    value={form.assignedUserId}
                    onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                    isDisabled={!form.divisionId}
                  >
                    {formAssigneeOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
              {!(isDivisionOnly && editing) ? (
                <FormControl>
                  <FormLabel>Fotografía</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setForm((f) => ({ ...f, photo: e.target.files?.[0] || null }))}
                  />
                </FormControl>
              ) : null}

              {!isDivisionOnly ? (
                <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
                  <Checkbox
                    isChecked={form.disincorporated}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        disincorporated: e.target.checked,
                        disincorporatedDate: e.target.checked ? f.disincorporatedDate : '',
                        disincorporatedObservation: e.target.checked ? f.disincorporatedObservation : '',
                      }))
                    }
                  >
                    Marcar como desincorporado
                  </Checkbox>
                  <HStack mt={3} spacing={3} align="flex-start" flexWrap="wrap">
                    <FormControl maxW="220px" isDisabled={!form.disincorporated}>
                      <FormLabel>Fecha</FormLabel>
                      <Input
                        type="date"
                        value={form.disincorporatedDate}
                        onChange={(e) => setForm((f) => ({ ...f, disincorporatedDate: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl flex="1" isDisabled={!form.disincorporated}>
                      <FormLabel>Observación</FormLabel>
                      <Input
                        value={form.disincorporatedObservation}
                        onChange={(e) => setForm((f) => ({ ...f, disincorporatedObservation: e.target.value }))}
                        placeholder="Motivo / nota"
                      />
                    </FormControl>
                  </HStack>
                </Box>
              ) : null}
            </VStack>
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

      <Modal isOpen={isTypesOpen} onClose={onTypesClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Tipos de bien nacional</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <HStack>
                <Input
                  placeholder="Nuevo tipo (ej. Mobiliario)"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
                <Button onClick={createType} colorScheme="brand">
                  Agregar
                </Button>
              </HStack>
              <Box borderWidth="1px" borderRadius="md" overflow="hidden">
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Nombre</Th>
                      <Th>Estado</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {typesAdmin.map((t) => (
                      <Tr key={t.id}>
                        <Td>{t.name}</Td>
                        <Td>{t.active ? 'Activo' : 'Inactivo'}</Td>
                        <Td>
                          <Button size="xs" variant="outline" onClick={() => toggleTypeActive(t)}>
                            {t.active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onTypesClose}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
