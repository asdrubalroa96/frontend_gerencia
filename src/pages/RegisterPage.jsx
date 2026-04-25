import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Stack,
  Text as ChakraText,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import client from '../api/client.js';
import SeniatBrandBlock from '../components/SeniatBrandBlock.jsx';

/**
 * Registro público: alta con rol operador vía POST /api/auth/signup (sin cookie hasta el login).
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [divisions, setDivisions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    client
      .get('/api/public/divisions')
      .then((res) => setDivisions(res.data || []))
      .catch(() => setDivisions([]));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: 'Las contraseñas no coinciden', status: 'warning' });
      return;
    }
    if (!divisionId) {
      toast({ title: 'Seleccione su división de adscripción', status: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      await client.post('/api/auth/signup', { email, password, fullName, divisionId: Number(divisionId) });
      toast({
        title: 'Cuenta creada',
        description: 'Inicie sesión con su correo y contraseña.',
        status: 'success',
      });
      navigate('/login');
    } catch (err) {
      toast({
        title: 'No se pudo registrar',
        description: err.response?.data?.error || err.message,
        status: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VStack spacing={4} maxW="md" mx="auto" mt={{ base: 10, md: 16 }} align="stretch">
      <SeniatBrandBlock align="center" maxW="280px" maxH="88px" />
      <Box p={8} bg="white" borderRadius="lg" boxShadow="md" w="100%">
        <Heading size="lg" mb={2} color="brand.600">
          Crear cuenta
        </Heading>
        <ChakraText mb={6} color="gray.600" fontSize="sm">
          Se registrará con perfil <strong>operador</strong>. Los administradores pueden asignar otros roles
          desde el panel de usuarios.
        </ChakraText>
        <form onSubmit={onSubmit}>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Nombre completo</FormLabel>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>División de adscripción</FormLabel>
              <ChakraText fontSize="xs" color="gray.600" mb={2}>
                Incluye <strong>Despacho</strong> (superior jerárquico) y las cuatro divisiones operativas. Elija la
                unidad donde presta servicios.
              </ChakraText>
              <Select
                placeholder="Seleccione su división"
                value={divisionId}
                onChange={(e) => setDivisionId(e.target.value)}
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Correo electrónico</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Contraseña (mín. 8 caracteres)</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Confirmar contraseña</FormLabel>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </FormControl>
            <Button type="submit" colorScheme="brand" isLoading={submitting}>
              Registrarme
            </Button>
          </Stack>
        </form>
        <ChakraText mt={6} fontSize="sm" color="gray.600">
          ¿Ya tiene cuenta?{' '}
          <Button as={RouterLink} to="/login" variant="link" colorScheme="brand" p={0} h="auto" fontWeight="600">
            Iniciar sesión
          </Button>
        </ChakraText>
      </Box>
    </VStack>
  );
}
