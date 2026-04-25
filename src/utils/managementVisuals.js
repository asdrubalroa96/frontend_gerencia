/** Colores de gestión: informativo amarillo; pendiente rojo; concluido verde. */
export function managementBadgeProps(code) {
  switch (code) {
    case 'por_gestionar':
      return { bg: 'red.500', color: 'white' };
    case 'informativo':
      return { bg: 'yellow.400', color: 'gray.800' };
    case 'concluido':
      return { bg: 'green.600', color: 'white' };
    default:
      return { bg: 'gray.400', color: 'white' };
  }
}

export function managementRowBg(code) {
  switch (code) {
    case 'por_gestionar':
      return 'rgba(252, 165, 165, 0.35)';
    case 'informativo':
      return 'rgba(250, 240, 137, 0.45)';
    case 'concluido':
      return 'rgba(198, 246, 213, 0.75)';
    default:
      return undefined;
  }
}
