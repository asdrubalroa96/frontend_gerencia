import { extendTheme } from '@chakra-ui/react';

/**
 * Tema visual institucional (identidad sobria, orientada a entorno gubernamental).
 */
const theme = extendTheme({
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
  colors: {
    /** Identidad visual principal (antes verde institucional → rojo). */
    brand: {
      50: '#fff5f5',
      100: '#fed7d7',
      200: '#feb2b2',
      300: '#fc8181',
      400: '#f56565',
      500: '#c53030',
      600: '#9b2c2c',
      700: '#822727',
      800: '#63171b',
      900: '#471818',
    },
  },
  fonts: {
    heading: `'Segoe UI', system-ui, sans-serif`,
    body: `'Segoe UI', system-ui, sans-serif`,
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
      },
    },
  },
});

export default theme;
