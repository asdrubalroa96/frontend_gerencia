import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Table,
  Tbody,
  Td,
  Text as ChakraText,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import client from '../api/client.js';

/**
 * Administración de cuentas internas y roles (solo perfil admin).
 */
export default function AdminUsersPage() {
  const toast = useToast();
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

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Correo</Th>
              <Th>Nombre</Th>
              <Th>Rol</Th>
              <Th>División</Th>
              <Th>Activo</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>{u.email}</Td>
                <Td>{u.full_name}</Td>
                <Td>{u.role_code}</Td>
                <Td>{u.division_name || '—'}</Td>
                <Td>{u.active ? 'Sí' : 'No'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
