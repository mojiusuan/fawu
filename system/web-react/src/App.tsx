import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import RequireAuth from './components/common/RequireAuth';
import LoginPage from './components/pages/LoginPage';
import Home from './components/pages/Home/Home';
import CaseCenter from './components/pages/CaseCenter/CaseCenter';
import CaseAnalysis from './components/pages/CaseAnalysis/CaseAnalysis';
import Contract from './components/pages/Contract/Contract';
import Consultation from './components/pages/Consultation/Consultation';
import TaskBoard from './components/pages/TaskBoard/TaskBoard';
import Notifications from './components/pages/Notifications/Notifications';
import Templates from './components/pages/Templates/Templates';
import Calculators from './components/pages/Calculators/Calculators';
import KG from './components/pages/KG/KG';
import Audit from './components/pages/Audit/Audit';
import RPA from './components/pages/RPA/RPA';
import Evidence from './components/pages/Evidence/Evidence';
import Settings from './components/pages/Settings/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected — all pages require authentication */}
              <Route element={<Layout />}>
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/case-center" element={<CaseCenter />} />
                  <Route path="/case-analysis" element={<CaseAnalysis />} />
                  <Route path="/contract" element={<Contract />} />
                  <Route path="/consultation" element={<Consultation />} />
                  <Route path="/tasks" element={<TaskBoard />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/kg" element={<KG />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/calculators" element={<Calculators />} />
                  <Route path="/evidence" element={<Evidence />} />
                  <Route path="/audit" element={<Audit />} />
                  <Route path="/rpa" element={<RPA />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>
            </Routes>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
