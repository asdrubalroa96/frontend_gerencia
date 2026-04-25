/**
 * Usuario restringido a una división operativa (no admin ni personal con alcance de Despacho global).
 * @param {{ role?: string, divisionId?: number | null, divisionGlobalScope?: boolean } | null | undefined} user
 */
export function isScopedDivisionUser(user) {
  return Boolean(user?.divisionId) && user?.role !== 'admin' && !user?.divisionGlobalScope;
}

function foldDivisionName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const ESTANDARES_REF = foldDivisionName('Estándares y Asistencia Técnica');

/** División operativa «Estándares y Asistencia Técnica» (por nombre en perfil). */
export function isEstándaresYAsistenciaTécnicaDivision(user) {
  return foldDivisionName(user?.divisionName) === ESTANDARES_REF;
}
