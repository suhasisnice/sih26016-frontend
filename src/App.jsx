import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import RequireRole from './auth/RequireRole';
import { EnumsProvider } from './hooks/useEnums';
import {
  OFFICERS,
  PROPOSAL_AUTHORS,
  PROPOSAL_VIEWERS,
  REPORT_READERS,
  SUPERVISORY,
} from './auth/permissions';
import AppShell from './components/layout/AppShell';
import Loading from './components/states/Loading';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Notices from './pages/Notices';
import Dashboard from './pages/Dashboard';
import CaseList from './pages/CaseList';
import CaseDetail from './pages/CaseDetail';
import AuditTrail from './pages/AuditTrail';
import CaseCreate from './pages/CaseCreate';
import Objections from './pages/Objections';
import ObjectionDetail from './pages/ObjectionDetail';
import ParcelDetail from './pages/ParcelDetail';
import Proposals from './pages/Proposals';
import ProposalDetail from './pages/ProposalDetail';
import ProposalCreate from './pages/ProposalCreate';
import Notifications from './pages/Notifications';
import Reports from './pages/Reports';
import NotAuthorised from './pages/NotAuthorised';
import NotFound from './pages/NotFound';

/* Used on one route. Loading it only when that route opens keeps the first
   paint on Landing and Login small — no longer Leaflet's weight
   specifically (the map moved to a plain SVG canvas), but still worth
   splitting for its own code. */
const MapView = lazy(() => import('./pages/MapView'));

function App({ children }) {
  return <AppShell>{children}</AppShell>;
}

export default function Root() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <EnumsProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/notices" element={<Notices />} />

            {/* Anyone who works a caseload or oversees one. Deliberately
                SUPERVISORY rather than OFFICERS: a state or ministry officer
                reads across districts and the dashboard is the whole of what
                they came for. */}
            <Route
              path="/dashboard"
              element={
                <RequireRole roles={SUPERVISORY}>
                  <App>
                    <Dashboard />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/map"
              element={
                <RequireRole roles={SUPERVISORY}>
                  <App>
                    <Suspense fallback={<Loading label="Loading the map" rows={8} />}>
                      <MapView />
                    </Suspense>
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/reports"
              element={
                <RequireRole roles={REPORT_READERS}>
                  <App>
                    <Reports />
                  </App>
                </RequireRole>
              }
            />

            {/* Operational: opening a case is a district action */}
            <Route
              path="/cases/new"
              element={
                <RequireRole roles={OFFICERS}>
                  <App>
                    <CaseCreate />
                  </App>
                </RequireRole>
              }
            />

            {/* The approval chain. `new` is declared before `:proposalId` so
                /proposals/new is never read as a proposal with the id
                "new" — React Router ranks static segments first, but the
                order here makes that explicit to the next reader. */}
            <Route
              path="/proposals"
              element={
                <RequireRole roles={PROPOSAL_VIEWERS}>
                  <App>
                    <Proposals />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/proposals/new"
              element={
                <RequireRole roles={PROPOSAL_AUTHORS}>
                  <App>
                    <ProposalCreate />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/proposals/:proposalId"
              element={
                <RequireRole roles={PROPOSAL_VIEWERS}>
                  <App>
                    <ProposalDetail />
                  </App>
                </RequireRole>
              }
            />

            {/* Any signed-in role, scoped by the backend */}
            <Route
              path="/cases"
              element={
                <RequireRole>
                  <App>
                    <CaseList />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/cases/:caseId"
              element={
                <RequireRole>
                  <App>
                    <CaseDetail />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/cases/:caseId/audit"
              element={
                <RequireRole roles={OFFICERS}>
                  <App>
                    <AuditTrail />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/parcels/:parcelId"
              element={
                <RequireRole>
                  <App>
                    <ParcelDetail />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/objections"
              element={
                <RequireRole>
                  <App>
                    <Objections />
                  </App>
                </RequireRole>
              }
            />
            <Route
              path="/objections/:objectionId"
              element={
                <RequireRole>
                  <App>
                    <ObjectionDetail />
                  </App>
                </RequireRole>
              }
            />
            {/* A notification is addressed correspondence — every signed-in
                account has an inbox, even when it is empty. */}
            <Route
              path="/notifications"
              element={
                <RequireRole>
                  <App>
                    <Notifications />
                  </App>
                </RequireRole>
              }
            />

            <Route path="/not-authorised" element={<NotAuthorised />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </EnumsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
