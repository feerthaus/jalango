import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router';
import { AppProviders } from '@/contexts/AppProviders';
import { AppLayout } from '@/layouts/AppLayout';
import { ExplorePage } from '@/pages/ExplorePage';
import { MapPage } from '@/pages/MapPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SavedPage } from '@/pages/SavedPage';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PrivacyPage } from '@/pages/legal/PrivacyPage';
import { TermsPage } from '@/pages/legal/TermsPage';
import { AdminPage } from '@/pages/AdminPage';
import { LiveViewPage } from '@/pages/LiveViewPage';

const router = createBrowserRouter([
  { path: '/privacy', element: <PrivacyPage />, errorElement: <ErrorBoundary /> },
  { path: '/terms', element: <TermsPage />, errorElement: <ErrorBoundary /> },
  { path: '/admin', element: <AdminPage />, errorElement: <ErrorBoundary /> },
  { path: '/live/:token', element: <LiveViewPage />, errorElement: <ErrorBoundary /> },
  { path: '/convoy/:code', element: <ConvoyInvite /> },
  {
    element: <AppLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <MapPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

/** Invite links open the map with the join sheet pre-filled. */
function ConvoyInvite() {
  const { code = '' } = useParams();
  return <Navigate to={`/?convoy=${encodeURIComponent(code)}`} replace />;
}

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
