import { Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute.jsx';
import ShellLayout from './components/ShellLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import HomePage from './pages/HomePage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import CorrespondenceSentPage from './pages/CorrespondenceSentPage.jsx';
import CorrespondenceReceivedPage from './pages/CorrespondenceReceivedPage.jsx';
import NationalAssetsPage from './pages/NationalAssetsPage.jsx';
import FiscalRecordsPage from './pages/FiscalRecordsPage.jsx';
import PoaRouterPage from './pages/PoaRouterPage.jsx';
import PoaPlanningPage from './pages/PoaPlanningPage.jsx';
import PoaExecutionPage from './pages/PoaExecutionPage.jsx';
import AdminTemplatesPage from './pages/AdminTemplatesPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminRolesPage from './pages/AdminRolesPage.jsx';
import AdminPermissionsPage from './pages/AdminPermissionsPage.jsx';
import AdminRoleAccessPage from './pages/AdminRoleAccessPage.jsx';

/**
 * Rutas con control de permisos alineado al backend (códigos en JWT + /auth/me).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <ShellLayout />
          </PrivateRoute>
        }
      >
        <Route
          index
          element={
            <PrivateRoute permission="dashboard.view">
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="perfil"
          element={
            <PrivateRoute permission="profile.edit">
              <ProfilePage />
            </PrivateRoute>
          }
        />
        <Route
          path="correspondencia/enviada"
          element={
            <PrivateRoute permission="corr_sent.read">
              <CorrespondenceSentPage />
            </PrivateRoute>
          }
        />
        <Route
          path="correspondencia/recibida"
          element={
            <PrivateRoute permission="corr_recv.read">
              <CorrespondenceReceivedPage />
            </PrivateRoute>
          }
        />
        <Route
          path="bienes"
          element={
            <PrivateRoute permission="assets.read">
              <NationalAssetsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="fiscal/:modo"
          element={
            <PrivateRoute permission="fiscal.read" fiscalEstándaresOnly>
              <FiscalRecordsPage />
            </PrivateRoute>
          }
        />
        <Route path="fiscal" element={<Navigate to="/fiscal/desincorporacion" replace />} />
        <Route
          path="poa"
          element={
            <PrivateRoute permission="poa.read">
              <PoaRouterPage />
            </PrivateRoute>
          }
        />
        <Route
          path="poa/planificacion"
          element={
            <PrivateRoute adminOnly>
              <PoaPlanningPage />
            </PrivateRoute>
          }
        />
        <Route
          path="poa/ejecucion"
          element={
            <PrivateRoute permission="poa.read">
              <PoaExecutionPage />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/plantillas"
          element={
            <PrivateRoute adminOnly>
              <AdminTemplatesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/usuarios"
          element={
            <PrivateRoute adminOnly>
              <AdminUsersPage />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <PrivateRoute adminOnly>
              <AdminRolesPage />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/roles/:id/accesos"
          element={
            <PrivateRoute adminOnly>
              <AdminRoleAccessPage />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/permisos"
          element={
            <PrivateRoute adminOnly>
              <AdminPermissionsPage />
            </PrivateRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
