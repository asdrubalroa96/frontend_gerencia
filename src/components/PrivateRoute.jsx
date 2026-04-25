import { Navigate } from 'react-router-dom';
import { Center, Spinner } from '@chakra-ui/react';
import { useAuth } from '../context/AuthContext.jsx';
import { isEstándaresYAsistenciaTécnicaDivision } from '../utils/divisionUi.js';

/**
 * Protege rutas: sesión obligatoria y, opcionalmente, permiso de menú/API.
 */
export default function PrivateRoute({ children, permission, adminOnly, fiscalEstándaresOnly }) {
  const { user, loading, can, isAdmin } = useAuth();

  if (loading) {
    return (
      <Center minH="60vh">
        <Spinner size="lg" color="brand.500" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/" replace state={{ forbidden: true }} />;
  }

  if (fiscalEstándaresOnly && !isAdmin && !isEstándaresYAsistenciaTécnicaDivision(user)) {
    return <Navigate to="/" replace state={{ forbidden: true }} />;
  }

  return children;
}
