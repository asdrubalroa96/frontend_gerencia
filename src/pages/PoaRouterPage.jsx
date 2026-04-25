import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function PoaRouterPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return <Navigate to={isAdmin ? '/poa/planificacion' : '/poa/ejecucion'} replace />;
}

