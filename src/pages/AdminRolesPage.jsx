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
  Switch,
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
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import client from '../api/client.js';

/**
 * CRUD de roles institucionales; la asignación de permisos por rol se edita en otra vista.
 */
export default function AdminRolesPage() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const load = async () => {
    const { data } = await client.get('/api/admin/roles');
    setRows(data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const submit = async () => {
    try {
      await client.post('/api/admin/roles', form);
      toast({ title: 'Rol creado', status: 'success' });
      onClose();
      setForm({ code: '', name: '', description: '' });
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const toggleActive = async (row) => {
    try {
      await client.patch(`/api/admin/roles/${row.id}`, { active: !row.active });
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`¿Eliminar el rol «${row.name}»?`)) return;
    try {
      await client.delete(`/api/admin/roles/${row.id}`);
      toast({ title: 'Rol eliminado', status: 'success' });
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
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Roles</Heading>
        <Button colorScheme="brand" onClick={onOpen}>
          Nuevo rol
        </Button>
      </HStack>
      <ChakraText fontSize="sm" color="gray.600" mb={4}>
        Los roles del sistema no se eliminan. Asigne permisos (menú y API) en «Accesos».
      </ChakraText>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Usuarios</Th>
              <Th>Sistema</Th>
              <Th>Activo</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.code}</Td>
                <Td>{r.name}</Td>
                <Td>{r.user_count}</Td>
                <Td>{r.is_system ? <Badge>Sí</Badge> : '—'}</Td>
                <Td>
                  <Switch
                    isChecked={r.active}
                    onChange={() => toggleActive(r)}
                    isDisabled={r.is_system}
                  />
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Button as={RouterLink} to={`/admin/roles/${r.id}/accesos`} size="xs" variant="outline">
                      Accesos
                    </Button>
                    {!r.is_system && (
                      <Button size="xs" colorScheme="red" variant="ghost" onClick={() => remove(r)}>
                        Eliminar
                      </Button>
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nuevo rol</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl isRequired>
                <FormLabel>Código (sin espacios)</FormLabel>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Nombre visible</FormLabel>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Descripción</FormLabel>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button colorScheme="brand" onClick={submit}>
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
