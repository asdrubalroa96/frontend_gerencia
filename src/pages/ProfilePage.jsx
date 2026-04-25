import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Stack,
  useToast,
  Text as ChakraText,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Actualización de perfil (nombre, correo, contraseña) persistida vía PATCH /api/users/me.
 */
export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirm) {
      toast({ title: 'Las contraseñas nuevas no coinciden', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const body = { fullName, email };
      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }
      await client.patch('/api/users/me', body);
      toast({ title: 'Perfil actualizado', status: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      await refresh();
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

  return (
    <Box maxW="lg">
      <Heading size="md" mb={2}>
        Mi perfil
      </Heading>
      <ChakraText color="gray.600" fontSize="sm" mb={6}>
        Los cambios se guardan en la base de datos. Si cambia el correo o la contraseña, la sesión se renueva automáticamente.
      </ChakraText>
      <Box bg="white" p={6} borderRadius="md" boxShadow="sm" as="form" onSubmit={onSubmit}>
        <Stack spacing={4}>
          <FormControl isRequired>
            <FormLabel>Nombre completo</FormLabel>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Correo</FormLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormControl>
          <ChakraText fontSize="sm" fontWeight="600" pt={2}>
            Cambiar contraseña (opcional)
          </ChakraText>
          <FormControl>
            <FormLabel>Contraseña actual</FormLabel>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Nueva contraseña</FormLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormControl>
          <FormControl>
            <FormLabel>Confirmar nueva</FormLabel>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </FormControl>
          <Button type="submit" colorScheme="brand" isLoading={saving}>
            Guardar cambios
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
