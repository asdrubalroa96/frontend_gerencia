import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Text as ChakraText,
  useDisclosure,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { FiLogOut, FiMenu } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';
import SeniatBrandBlock from './SeniatBrandBlock.jsx';
import { isEstándaresYAsistenciaTécnicaDivision } from '../utils/divisionUi.js';

const ADMIN_ITEMS = [
  { to: '/admin/plantillas', label: 'Plantillas Word', icon: '📄' },
  { to: '/admin/usuarios', label: 'Usuarios', icon: '👥' },
  { to: '/admin/roles', label: 'Roles y accesos', icon: '🔐' },
  { to: '/admin/permisos', label: 'Permisos del sistema', icon: '⚙️' },
];

function normalizeAccordionIndex(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'number') return v < 0 ? [] : [v];
  return [];
}

function NavItem({ to, label, end, onNavigate, icon }) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate}>
      {({ isActive }) => (
        <Box
          px={3}
          py={2}
          borderRadius="md"
          bg={isActive ? 'brand.500' : 'gray.50'}
          color={isActive ? 'white' : 'gray.800'}
          fontWeight={isActive ? '700' : '500'}
          borderWidth="1px"
          borderColor={isActive ? 'brand.600' : 'gray.200'}
          boxShadow={isActive ? 'sm' : 'none'}
          transition="background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease"
          _hover={{
            bg: isActive ? 'brand.600' : 'gray.100',
            color: isActive ? 'white' : 'gray.900',
          }}
        >
          <HStack spacing={2} align="center">
            {icon ? (
              <Box as="span" fontSize="lg" lineHeight={1} aria-hidden>
                {icon}
              </Box>
            ) : null}
            <ChakraText fontSize="sm" as="span">
              {label}
            </ChakraText>
          </HStack>
        </Box>
      )}
    </NavLink>
  );
}

function NavList({ can, user, onNavigate }) {
  const location = useLocation();
  const path = location.pathname;

  const canCorr = can('corr_sent.read') || can('corr_recv.read');
  const isAdmin = user?.role === 'admin';
  const canFiscal =
    can('fiscal.read') && (isAdmin || isEstándaresYAsistenciaTécnicaDivision(user));

  const [corrIdx, setCorrIdx] = useState(() => (path.startsWith('/correspondencia') ? [0] : []));
  const [fiscalIdx, setFiscalIdx] = useState(() => (path.startsWith('/fiscal') ? [0] : []));

  useEffect(() => {
    setCorrIdx(path.startsWith('/correspondencia') ? [0] : []);
    setFiscalIdx(path.startsWith('/fiscal') ? [0] : []);
  }, [path]);

  return (
    <VStack align="stretch" spacing={2}>
      {can('dashboard.view') && (
        <NavItem to="/" label="Inicio" end icon="🏠" onNavigate={onNavigate} />
      )}

      {canCorr && (
        <Accordion
          allowMultiple
          index={corrIdx}
          onChange={(v) => setCorrIdx(normalizeAccordionIndex(v))}
          reduceMotion
        >
          <AccordionItem border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden" bg="gray.50">
            <AccordionButton py={2} px={3} _expanded={{ bg: 'brand.50', borderColor: 'brand.200' }}>
              <HStack flex="1" spacing={2} justify="flex-start">
                <Box as="span" fontSize="lg" aria-hidden>
                  📧
                </Box>
                <ChakraText fontWeight="700" fontSize="sm" flex="1" textAlign="left">
                  Correspondencia
                </ChakraText>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={2} pt={0} px={2} bg="white">
              <VStack align="stretch" spacing={1} pl={1}>
                {can('corr_sent.read') && (
                  <NavItem
                    to="/correspondencia/enviada"
                    label="Enviada"
                    icon="📤"
                    onNavigate={onNavigate}
                  />
                )}
                {can('corr_recv.read') && (
                  <NavItem
                    to="/correspondencia/recibida"
                    label="Recibida"
                    icon="📥"
                    onNavigate={onNavigate}
                  />
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}

      {can('assets.read') && (
        <NavItem to="/bienes" label="Bienes nacionales" icon="🏢" onNavigate={onNavigate} />
      )}

      {canFiscal && (
        <Accordion
          allowMultiple
          index={fiscalIdx}
          onChange={(v) => setFiscalIdx(normalizeAccordionIndex(v))}
          reduceMotion
        >
          <AccordionItem border="1px solid" borderColor="gray.200" borderRadius="md" overflow="hidden" bg="gray.50">
            <AccordionButton py={2} px={3} _expanded={{ bg: 'brand.50', borderColor: 'brand.200' }}>
              <HStack flex="1" spacing={2} justify="flex-start">
                <Box as="span" fontSize="lg" aria-hidden>
                  🖨️
                </Box>
                <ChakraText fontWeight="700" fontSize="sm" flex="1" textAlign="left">
                  Máquinas fiscales
                </ChakraText>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={2} pt={0} px={2} bg="white">
              <VStack align="stretch" spacing={1} pl={1}>
                <NavItem
                  to="/fiscal/desincorporacion"
                  label="Desincorporación"
                  icon="📤"
                  onNavigate={onNavigate}
                />
                <NavItem
                  to="/fiscal/reenajenacion"
                  label="Reenajenación"
                  icon="🔄"
                  onNavigate={onNavigate}
                />
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}

      {can('poa.read') && (
        <NavItem to="/poa" label="Plan operativo anual" icon="📅" onNavigate={onNavigate} />
      )}

      {isAdmin ? (
        <>
          <Divider borderColor="gray.200" my={2} />
          <ChakraText fontSize="xs" fontWeight="700" color="gray.500" letterSpacing="wide">
            ADMINISTRACIÓN
          </ChakraText>
          <ChakraText fontSize="xs" color="gray.500" mb={1} lineHeight="short">
            Roles, permisos, usuarios y plantillas (solo administrador).
          </ChakraText>
          {ADMIN_ITEMS.map((item) => (
            <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} onNavigate={onNavigate} />
          ))}
        </>
      ) : null}
    </VStack>
  );
}

export default function ShellLayout() {
  const { user, logout, can, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    if (!user) {
      return undefined;
    }
    const apiOrigin =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || window.location.origin;
    const socket = io(apiOrigin, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    const onConnect = () => {
      socket.emit('join-rooms');
    };
    if (socket.connected) {
      socket.emit('join-rooms');
    }
    const onCorr = (payload) => {
      const kind = payload?.kind;
      let title = 'Correspondencia recibida';
      let description = '';
      if (kind === 'external_received') {
        title = 'Nueva correspondencia externa';
        description = payload?.subject
          ? `Asunto: ${payload.subject}. Revise la bandeja de recibida.`
          : 'Nuevo registro del exterior. Revise la bandeja de recibida.';
      } else {
        const memo =
          payload?.memoLabel != null && String(payload.memoLabel).length > 0
            ? `Memo ${payload.memoLabel}`
            : payload?.memoNumber != null
              ? `Memo ${payload.memoNumber}`
              : 'Nuevo movimiento de correspondencia';
        description = payload?.subject ? `${memo}: ${payload.subject}` : `${memo} en su bandeja de recibida.`;
      }
      toast({
        title,
        description,
        status: 'info',
        duration: 9000,
        isClosable: true,
      });
    };
    socket.on('connect', onConnect);
    socket.on('correspondence_received', onCorr);
    return () => {
      socket.off('connect', onConnect);
      socket.off('correspondence_received', onCorr);
      socket.disconnect();
    };
  }, [user, toast]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Flex minH="100vh" direction={{ base: 'column', md: 'row' }} w="100%" align="stretch" bg="gray.50">
      <Box
        display={{ base: 'none', md: 'block' }}
        w={{ md: '240px', lg: '260px' }}
        flexShrink={0}
        bg="white"
        borderRight="1px solid"
        borderColor="gray.200"
        pl={2}
        pr={3}
        py={4}
        alignSelf="stretch"
      >
        <Box px={3}>
          <SeniatBrandBlock align="start" maxW="100%" maxH="68px" mb={4} />
        </Box>
        <NavList can={can} user={user} />
      </Box>

      <Flex direction="column" flex="1" minW={0} maxW="100%">
        <HStack
          justify="space-between"
          align="center"
          px={{ base: 3, md: 4 }}
          py={3}
          borderBottom="1px solid"
          borderColor="gray.200"
          bg="white"
          gap={2}
          flexWrap="wrap"
        >
          <HStack spacing={3} minW={0} flex="1">
            <IconButton
              display={{ base: 'flex', md: 'none' }}
              aria-label="Abrir menú"
              icon={<FiMenu />}
              variant="outline"
              borderColor="gray.300"
              onClick={onOpen}
            />
            <Box minW={0}>
              <ChakraText fontSize="sm" color="gray.500">
                Sesión
              </ChakraText>
              <ChakraText fontWeight="600" noOfLines={1}>
                {user?.fullName} · {user?.role}
                {user?.divisionName
                  ? ` · ${user.divisionName}`
                  : !isAdmin && !user?.divisionId
                    ? ' · Despacho'
                    : ''}
              </ChakraText>
            </Box>
          </HStack>
          <HStack spacing={2} flexShrink={0}>
            {can('profile.edit') && (
              <Button as={Link} to="/perfil" size="sm" variant="outline" colorScheme="brand">
                👤 Mi perfil
              </Button>
            )}
            <IconButton
              aria-label="Cerrar sesión"
              icon={<FiLogOut />}
              colorScheme="brand"
              variant="outline"
              onClick={handleLogout}
            />
          </HStack>
        </HStack>
        <Box
          flex="1"
          overflow="auto"
          bg="gray.50"
          py={{ base: 4, md: 5 }}
          pr={{ base: 4, md: 8, lg: 12 }}
          pl={{ base: 4, md: 5 }}
          w="100%"
          maxW="100%"
        >
          <Outlet />
        </Box>
      </Flex>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent maxW="300px">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">Menú</DrawerHeader>
          <DrawerBody py={4}>
            <Box px={3}>
              <SeniatBrandBlock align="start" maxW="100%" maxH="56px" mb={4} />
            </Box>
            <NavList can={can} user={user} onNavigate={onClose} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Flex>
  );
}
