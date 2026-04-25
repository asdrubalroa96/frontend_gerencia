import {
  Box,
  Button,
  Checkbox,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text as ChakraText,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import client from '../api/client.js';

/**
 * Asignación de permisos (accesos menú/API) a un rol concreto.
 */
export default function AdminRoleAccessPage() {
  const toast = useToast();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [allPerms, setAllPerms] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [roleRes, allRes] = await Promise.all([
          client.get(`/api/admin/roles/${id}/permissions`),
          client.get('/api/admin/permissions'),
        ]);
        if (cancelled) return;
        setRole(roleRes.data.role);
        setAllPerms(allRes.data);
        setSelected(new Set(roleRes.data.permissionIds));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const byKind = useMemo(() => {
    const m = { menu: [], api: [], admin: [] };
    for (const p of allPerms) {
      if (m[p.kind]) m[p.kind].push(p);
    }
    return m;
  }, [allPerms]);

  const toggle = (pid) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await client.put(`/api/admin/roles/${id}/permissions`, {
        permissionIds: Array.from(selected),
      });
      toast({ title: 'Permisos guardados', status: 'success' });
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

  if (loading) {
    return (
      <HStack>
        <Spinner />
        <ChakraText>Cargando…</ChakraText>
      </HStack>
    );
  }

  const Section = ({ title, items }) => (
    <Box>
      <ChakraText fontWeight="700" mb={2}>
        {title}
      </ChakraText>
      <VStack align="stretch" spacing={1}>
        {items.map((p) => (
          <Checkbox
            key={p.id}
            isChecked={selected.has(p.id)}
            onChange={() => toggle(p.id)}
            isDisabled={!p.active}
          >
            <ChakraText as="span" fontSize="sm">
              {p.name} <ChakraText as="span" color="gray.500">({p.code})</ChakraText>
            </ChakraText>
          </Checkbox>
        ))}
      </VStack>
    </Box>
  );

  return (
    <Box>
      <Button as={RouterLink} to="/admin/roles" variant="link" colorScheme="brand" mb={4}>
        ← Volver a roles
      </Button>
      <Heading size="md" mb={2}>
        Accesos: {role?.name}
      </Heading>
      <ChakraText color="gray.600" fontSize="sm" mb={6}>
        Marque los permisos que tendrán todos los usuarios con este rol (menú y operaciones en API).
      </ChakraText>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={6}>
        <Section title="Menú" items={byKind.menu} />
        <Section title="API / módulos" items={byKind.api} />
        <Section title="Administración" items={byKind.admin} />
      </SimpleGrid>
      <Button colorScheme="brand" onClick={save} isLoading={saving}>
        Guardar permisos
      </Button>
    </Box>
  );
}
