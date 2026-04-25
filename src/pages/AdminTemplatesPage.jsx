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
 * Carga de plantillas Word (.docx) para lotes de desincorporación (externo + interno).
 */
export default function AdminTemplatesPage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', kind: 'desincorporacion_externo', file: null });
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    const { data } = await client.get('/api/templates/word');
    setRows(data);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const submit = async () => {
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('kind', form.kind);
      if (!form.file) {
        toast({ title: 'Seleccione archivo .docx', status: 'warning' });
        return;
      }
      fd.append('file', form.file);
      await client.post('/api/templates/word', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast({ title: 'Plantilla registrada', status: 'success' });
      setForm({ name: '', kind: 'desincorporacion_externo', file: null });
      await load();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    }
  };

  const removeTemplate = async (id, name) => {
    if (!window.confirm(`¿Eliminar la plantilla "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      setDeletingId(id);
      await client.delete(`/api/templates/word/${id}`);
      toast({ title: 'Plantilla eliminada', status: 'success' });
      await load();
    } catch (err) {
      toast({
        title: 'No se pudo eliminar',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Box>
      <Heading size="md" mb={4}>
        Plantillas Word
      </Heading>
      <Box bg="white" p={4} borderRadius="md" boxShadow="sm" mb={6}>
        <VStack align="stretch" spacing={3}>
          <FormControl isRequired>
            <FormLabel>Nombre descriptivo</FormLabel>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </FormControl>
          <FormControl>
            <FormLabel>Tipo</FormLabel>
            <Select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="desincorporacion_externo">Desincorporación (externo)</option>
              <option value="desincorporacion_interno">Desincorporación (interno)</option>
              <option value="reenajenacion_oficio">Reenajenación (oficio)</option>
              <option value="reenajenacion_memo">Reenajenación (memo)</option>
              <option value="reenajenacion_formulario">Reenajenación (legacy: formulario único)</option>
            </Select>
            <ChakraText fontSize="xs" color="gray.600" mt={3}>
              <strong>Documento externo y memo interno</strong> (docxtemplater): mismos datos en ambos; use llaves{' '}
              <code>{'{}'}</code> con estos nombres.
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              Cabecera del lote: <code>{'{nombreproveedor}'}</code>, <code>{'{rifproveedor}'}</code>,{' '}
              <code>{'{cantidad}'}</code>, <code>{'{proveedor}'}</code>, <code>{'{rif_proveedor}'}</code> (sinónimos de
              proveedor), <code>{'{tipo_evento}'}</code> (<code>desincorporacion</code>), <code>{'{memo_number}'}</code>,{' '}
              <code>{'{para_reenajenacion}'}</code> (Sí/No), marcas <code>{'{para_reenajenacion_si}'}</code> /{' '}
              <code>{'{para_reenajenacion_no}'}</code> (X en casilla), texto tabulado de todas las filas{' '}
              <code>{'{datosmaquinas_text}'}</code>.
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.600" mt={2} fontWeight="600">
              Tabla en Word (6 columnas): un marcador por celda, en la misma fila de datos
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              Si pone varios campos en una sola celda, Word los amontona. Cree una fila de encabezado y, debajo,{' '}
              <strong>una fila</strong> con <strong>6 celdas</strong>, cada una con un solo bloque de marcadores así:
            </ChakraText>
            <ChakraText as="pre" fontSize="xs" color="gray.700" mt={1} whiteSpace="pre-wrap" fontFamily="mono">
              {[
                'Celda 1: {#datosmaquinas}{row_num}',
                'Celda 2: {razon_social}',
                'Celda 3: {rif_contacto}',
                'Celda 4: {num_maquina}',
                'Celda 5: {mac_imei}',
                'Celda 6: {observacion}{/datosmaquinas}',
              ].join('\n')}
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              <code>{'{row_num}'}</code> es el numerador (1, 2, 3…) según la cantidad de máquinas del lote. No use{' '}
              <code>{'{datosmaquinas_text}'}</code> dentro de una celda de tabla si quiere columnas separadas.
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              Compatibilidad (solo primera máquina del lote): <code>{'{proveedor_nombre}'}</code>,{' '}
              <code>{'{proveedor_rif}'}</code>, <code>{'{empresa_nombre}'}</code>, <code>{'{empresa_rif}'}</code>,{' '}
              <code>{'{serial_maquina}'}</code>, <code>{'{mac_imei}'}</code>, <code>{'{observaciones}'}</code>.
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={2}>
              Para generar lotes hacen falta <strong>dos</strong> plantillas activas: una con tipo{' '}
              <strong>desincorporacion_externo</strong> y otra <strong>desincorporacion_interno</strong> (mismos
              marcadores).
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.600" mt={3} fontWeight="600">
              Tipos <code>reenajenacion_oficio</code> / <code>reenajenacion_memo</code> (formulario REENAJENACIONES en app)
            </ChakraText>
            <ChakraText fontSize="xs" color="gray.500" mt={1}>
              Encabezado = contribuyente que transfiere (datos del contacto en desincorporación):{' '}
              <code>{'{razon_social}'}</code>, <code>{'{rif}'}</code>,{' '}
              <code>{'{contribuyente_transfiere_razon}'}</code>, <code>{'{contribuyente_transfiere_rif}'}</code>,{' '}
              <code>{'{contact_name}'}</code>, <code>{'{contact_rif}'}</code>; serial{' '}
              <code>{'{serial_maquina}'}</code> / <code>{'{num_maquina}'}</code>; fecha{' '}
              <code>{'{fecha_reenajenacion}'}</code>. Luego: <code>{'{direccion}'}</code>,{' '}
              <code>{'{direccion_especifica}'}</code>, <code>{'{ciudad_estado}'}</code>, <code>{'{zona_postal}'}</code>,{' '}
              <code>{'{representante_legal}'}</code>, <code>{'{numero_comunicacion}'}</code>,{' '}
              <code>{'{fecha_comunicacion}'}</code> (dd/mm/aaaa), <code>{'{nombre_proveedor}'}</code> o{' '}
              <code>{'{proveedor}'}</code>, <code>{'{rif_proveedor}'}</code>, <code>{'{fecha_recibido_gf}'}</code>,{' '}
              <code>{'{marca}'}</code>, <code>{'{modelo}'}</code>, <code>{'{numero_registro}'}</code>,{' '}
              <code>{'{razon_social_reenajenante}'}</code>, <code>{'{rif_reenajenante}'}</code>,{' '}
              <code>{'{razon_social_reenajenado}'}</code>, <code>{'{rif_reenajenado}'}</code>.
            </ChakraText>
          </FormControl>
          <FormControl>
            <FormLabel>Archivo .docx</FormLabel>
            <Input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
            />
          </FormControl>
          <Button colorScheme="brand" alignSelf="flex-start" onClick={submit}>
            Subir plantilla
          </Button>
        </VStack>
      </Box>

      <Box bg="white" borderRadius="md" boxShadow="sm" overflowX="auto">
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Nombre</Th>
              <Th>Tipo</Th>
              <Th>Ruta</Th>
              <Th w="120px"> </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.name}</Td>
                <Td>{r.kind}</Td>
                <Td>{r.file_path}</Td>
                <Td>
                  <Button
                    size="xs"
                    colorScheme="red"
                    variant="outline"
                    isLoading={deletingId === r.id}
                    onClick={() => removeTemplate(r.id, r.name)}
                  >
                    Eliminar
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    </Box>
  );
}
