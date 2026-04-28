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
  Switch,
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
import { useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Administración de cuentas internas y roles (solo perfil admin).
 */
function roleLabel(code) {
  const c = String(code || '').toLowerCase();
  if (c === 'admin') return 'Administrador';
  if (c === 'consulta') return 'Consulta';
  if (c === 'operador') return 'Operador';
  return code || '—';
}

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: authUser, isAdmin } = useAuth();
  const { isOpen: manageModalOpen, onOpen: onManageModalOpen, onClose: onManageModalCloseRaw } = useDisclosure();
  const closeManageModal = () => {
    setManageModalUser(null);
    onManageModalCloseRaw();
  };
  const [manageModalUser, setManageModalUser] = useState(null);
  const [manageRoleChoice, setManageRoleChoice] = useState('operador');
  const [manageActive, setManageActive] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    roleCode: 'operador',
    divisionId: '',
  });
  const [divisions, setDivisions] = useState([]);
  /** Evita doble envío mientras PATCH /api/users/:id está en curso. */
  const [busyUserId, setBusyUserId] = useState(null);

  const load = async () => {
    const [u, r, cat] = await Promise.all([
      client.get('/api/users'),
      client.get('/api/roles'),
      client.get('/api/catalogs'),
    ]);
    setUsers(u.data);
    setRoles(r.data);
    setDivisions(cat.data.divisions || []);
  };

  const patchUser = async (id, payload) => {
    await client.patch(`/api/users/${id}`, payload);
    toast({ title: 'Cambios guardados', status: 'success' });
    await load();
  };

  const setUserActive = async (u, nextActive) => {
    if (!isAdmin || !u?.id) return;
    if (u.id === authUser?.id && !nextActive) {
      toast({ title: 'No puede desactivar su propia cuenta', status: 'warning' });
      return;
    }
    if (Boolean(u.active) === Boolean(nextActive)) return;
    setBusyUserId(u.id);
    try {
      await patchUser(u.id, { active: nextActive });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const setUserRoleCode = async (u, roleCode) => {
    if (!isAdmin || !u?.id || u.id === authUser?.id) return;
    if (u.role_code === 'admin') return;
    const rc = String(roleCode || '').toLowerCase();
    if (rc !== 'operador' && rc !== 'consulta') return;
    if (String(u.role_code || '').toLowerCase() === rc) return;
    setBusyUserId(u.id);
    try {
      await patchUser(u.id, { roleCode: rc });
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setBusyUserId(null);
    }
  };

  const openManageModal = (u) => {
    if (!isAdmin || !u?.id || u.id === authUser?.id) return;
    setManageModalUser(u);
    setManageRoleChoice(u.role_code === 'consulta' ? 'consulta' : 'operador');
    setManageActive(Boolean(u.active));
    onManageModalOpen();
  };

  const saveManageModal = async () => {
    if (!manageModalUser) return;
    const payload = {};
    if (manageModalUser.role_code !== 'admin' && manageRoleChoice !== manageModalUser.role_code) {
      payload.roleCode = manageRoleChoice;
    }
    if (manageActive !== Boolean(manageModalUser.active)) {
      payload.active = manageActive;
    }
    if (!Object.keys(payload).length) {
      toast({ title: 'Sin cambios', status: 'info' });
      closeManageModal();
      return;
    }
    try {
      await patchUser(manageModalUser.id, payload);
      closeManageModal();
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
  }, []);

  const submit = async () => {
    if (form.roleCode !== 'admin' && !form.divisionId) {
      toast({ title: 'Indique la división', status: 'warning' });
      return;
    }
    try {
      const payload = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        roleCode: form.roleCode,
      };
      if (form.roleCode === 'admin') {
        if (form.divisionId) payload.divisionId = Number(form.divisionId);
      } else {
        payload.divisionId = Number(form.divisionId);
      }
      await client.post('/api/auth/register', payload);
      toast({ title: 'Usuario creado', status: 'success' });
      setForm({ email: '', password: '', fullName: '', roleCode: 'operador', divisionId: '' });
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
    <Box>
      <Heading size="md" mb={4}>
        Usuarios y roles
      </Heading>
      <ChakraText fontSize="sm" color="gray.600" mb={4}>
        En la tabla puede <strong>cambiar el rol</strong> (operador / consulta) con el desplegable y{' '}
        <strong>activar o desactivar</strong> la cuenta con el interruptor. Un usuario inactivo no podrá iniciar sesión.
        También puede usar <strong>Gestionar</strong> para el mismo ajuste en un panel. No puede desactivarse a sí mismo
        ni cambiar su propio rol aquí. El rol <strong>administrador</strong> no se sustituye por otro desde esta pantalla;
        sí puede desactivar o reactivar otras cuentas admin.
      </ChakraText>

      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={6}>
        <ChakraText fontWeight="600" mb={3}>
          Registrar usuario
        </ChakraText>
        <VStack align="stretch" spacing={3}>
          <FormControl isRequired>
            <FormLabel>Correo</FormLabel>
            <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Nombre completo</FormLabel>
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Contraseña temporal</FormLabel>
            <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </FormControl>
          <FormControl>
            <FormLabel>Rol</FormLabel>
            <Select value={form.roleCode} onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl isRequired={form.roleCode !== 'admin'}>
            <FormLabel>División de adscripción</FormLabel>
            <Select
              placeholder={form.roleCode === 'admin' ? 'Despacho (sin división)' : 'Seleccione división'}
              value={form.divisionId}
              onChange={(e) => setForm((f) => ({ ...f, divisionId: e.target.value }))}
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              Catálogo institucional: <strong>Despacho</strong> (superior jerárquico) y las cuatro divisiones. Los
              operadores deben tener división. Administrador: división opcional (sin división equivale a alcance
              global de gestión).
            </ChakraText>
          </FormControl>
          <Button colorScheme="brand" alignSelf="flex-start" onClick={submit}>
            Crear usuario
          </Button>
        </VStack>
      </Box>

      <TableContainer bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th textTransform="none">Correo</Th>
              <Th textTransform="none">Nombre</Th>
              <Th textTransform="none">Rol</Th>
              <Th textTransform="none">División</Th>
              <Th textTransform="none">Activo</Th>
              <Th textTransform="none">Acciones</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>{u.email}</Td>
                <Td>{u.full_name}</Td>
                <Td>
                  <VStack align="stretch" spacing={1}>
                    {u.role_code === 'admin' ? (
                      <Badge colorScheme="purple" w="fit-content">
                        {roleLabel(u.role_code)}
                      </Badge>
                    ) : u.role_code === 'operador' || u.role_code === 'consulta' ? (
                      <Select
                        size="sm"
                        maxW="240px"
                        value={u.role_code === 'consulta' ? 'consulta' : 'operador'}
                        isDisabled={!isAdmin || u.id === authUser?.id || busyUserId === u.id}
                        onChange={(e) => setUserRoleCode(u, e.target.value)}
                      >
                        <option value="operador">Operador</option>
                        <option value="consulta">Consulta</option>
                      </Select>
                    ) : (
                      <Badge colorScheme="blue" w="fit-content">
                        {roleLabel(u.role_code)}
                      </Badge>
                    )}
                    {u.id === authUser?.id ? (
                      <ChakraText fontSize="xs" color="gray.500">
                        Su cuenta: no puede cambiar su rol aquí.
                      </ChakraText>
                    ) : null}
                  </VStack>
                </Td>
                <Td>{u.division_name || '—'}</Td>
                <Td>
                  {u.id === authUser?.id ? (
                    <ChakraText fontSize="sm" color="gray.600">
                      {u.active ? 'Activo' : 'Inactivo'} (su cuenta)
                    </ChakraText>
                  ) : (
                    <Switch
                      isChecked={Boolean(u.active)}
                      isDisabled={!isAdmin || busyUserId === u.id}
                      onChange={(e) => setUserActive(u, e.target.checked)}
                      colorScheme="green"
                      size="md"
                    />
                  )}
                </Td>
                <Td>
                  {isAdmin && u.id !== authUser?.id ? (
                    <Button size="xs" variant="outline" colorScheme="brand" onClick={() => openManageModal(u)}>
                      Gestionar
                    </Button>
                  ) : null}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>

      <Modal isOpen={manageModalOpen} onClose={closeManageModal} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Gestionar usuario</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <ChakraText fontSize="sm" mb={4}>
              <strong>{manageModalUser?.full_name}</strong> ({manageModalUser?.email})
            </ChakraText>
            {manageModalUser?.role_code === 'admin' ? (
              <ChakraText fontSize="sm" color="gray.600" mb={4}>
                Rol: <strong>Administrador</strong> (no se modifica aquí).
              </ChakraText>
            ) : (
              <FormControl mb={4}>
                <FormLabel>Rol</FormLabel>
                <Select value={manageRoleChoice} onChange={(e) => setManageRoleChoice(e.target.value)}>
                  <option value="operador">Operador — gestión y consultas operativas</option>
                  <option value="consulta">Consulta — solo lectura (según permisos del sistema)</option>
                </Select>
              </FormControl>
            )}
            <FormControl display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <FormLabel mb={0}>Cuenta activa</FormLabel>
                <ChakraText fontSize="xs" color="gray.500">
                  Si está desactivada, el usuario no podrá entrar al sistema.
                </ChakraText>
              </Box>
              <Switch
                isChecked={manageActive}
                onChange={(e) => setManageActive(e.target.checked)}
                colorScheme="green"
                size="lg"
              />
            </FormControl>
            <ChakraText fontSize="xs" color="gray.600" mt={3}>
              Estado actual en base de datos: {manageModalUser?.active ? 'Activo' : 'Inactivo'}
            </ChakraText>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closeManageModal}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={() => saveManageModal()}>
              Guardar cambios
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
