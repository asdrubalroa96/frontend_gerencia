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

/**
 * CRUD de permisos (códigos de acceso); los roles enlazan aquí vía «Accesos» por rol.
 */
export default function AdminPermissionsPage() {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', description: '', kind: 'api' });

  const load = async () => {
    const { data } = await client.get('/api/admin/permissions');
    setRows(data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const submit = async () => {
    try {
      await client.post('/api/admin/permissions', form);
      toast({ title: 'Permiso creado', status: 'success' });
      onClose();
      setForm({ code: '', name: '', description: '', kind: 'api' });
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
      await client.patch(`/api/admin/permissions/${row.id}`, { active: !row.active });
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
    if (!window.confirm(`¿Eliminar el permiso «${row.code}»? Se quitará de todos los roles.`)) return;
    try {
      await client.delete(`/api/admin/permissions/${row.id}`);
      toast({ title: 'Eliminado', status: 'success' });
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
        <Heading size="md">Permisos (accesos)</Heading>
        <Button colorScheme="brand" onClick={onOpen}>
          Nuevo permiso
        </Button>
      </HStack>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th>Activo</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <ChakraText fontFamily="mono" fontSize="xs">
                    {r.code}
                  </ChakraText>
                </Td>
                <Td>{r.name}</Td>
                <Td>
                  <Badge>{r.kind}</Badge>
                </Td>
                <Td>
                  <Switch isChecked={r.active} onChange={() => toggleActive(r)} />
                </Td>
                <Td>
                  <Button size="xs" colorScheme="red" variant="ghost" onClick={() => remove(r)}>
                    Eliminar
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nuevo permiso</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl isRequired>
                <FormLabel>Código único</FormLabel>
                <Input
                  placeholder="ej: informes.export"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Nombre</FormLabel>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Descripción</FormLabel>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>Tipo</FormLabel>
                <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                  <option value="menu">Menú (navegación)</option>
                  <option value="api">API / módulo</option>
                  <option value="admin">Administración</option>
                </Select>
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
