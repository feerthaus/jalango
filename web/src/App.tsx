import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router';
import { AppProviders } from '@/contexts/AppProviders';
import { AppLayout } from '@/layouts/AppLayout';
import { ListingPage } from '@/pages/ListingPage';
import { SewaPage } from '@/pages/SewaPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { MapPage } from '@/pages/MapPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { BusinessPage } from '@/pages/BusinessPage';
import { ListingEditorPage } from '@/pages/ListingEditorPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SavedPage } from '@/pages/SavedPage';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { PrivacyPage } from '@/pages/legal/PrivacyPage';
import { TermsPage } from '@/pages/legal/TermsPage';
import { AdminPage } from '@/pages/AdminPage';
import { LiveViewPage } from '@/pages/LiveViewPage';
import { useEffect } from 'react';
import { pingActivity } from '@/lib/activity';

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
      { path: 'sewa', element: <SewaPage /> },
      { path: 'sewa/:id', element: <ListingPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'saved', element: <SavedPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'business', element: <BusinessPage /> },
      { path: 'business/listings/:id', element: <ListingEditorPage /> },
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
  // Anonymous daily check-in for the admin statistics (also when the app comes back on a new day)
  useEffect(() => {
    pingActivity();
    const onVisible = () => document.visibilityState === 'visible' && pingActivity();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
