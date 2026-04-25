import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  Text as ChakraText,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SeniatBrandBlock from '../components/SeniatBrandBlock.jsx';

/**
 * Pantalla de acceso al portal (credenciales contra /api/auth/login).
 */
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toast({ title: 'Bienvenido', status: 'success' });
      navigate('/');
    } catch (err) {
      toast({
        title: 'Error de autenticación',
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
          Acceso institucional
        </Heading>
        <ChakraText mb={4} color="gray.700" fontWeight="700">
          Gerencia de Fiscalización
        </ChakraText>
        <ChakraText mb={6} color="gray.600" fontSize="sm">
          Inicie sesión con su correo institucional. Si aún no tiene cuenta, puede registrarse como operador.
        </ChakraText>
        <form onSubmit={onSubmit}>
          <Stack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Correo electrónico</FormLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Contraseña</FormLabel>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </FormControl>
            <Button type="submit" colorScheme="brand" isLoading={submitting}>
              Ingresar
            </Button>
          </Stack>
        </form>
        <ChakraText mt={6} fontSize="sm" color="gray.600">
          ¿No tiene cuenta?{' '}
          <Button as={RouterLink} to="/registro" variant="link" colorScheme="brand" p={0} h="auto" fontWeight="600">
            Registrarse
          </Button>
        </ChakraText>
      </Box>
    </VStack>
  );
}
