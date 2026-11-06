import { createBrowserRouter, RouterProvider } from 'react-router';
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

const router = createBrowserRouter([
  { path: '/privacy', element: <PrivacyPage />, errorElement: <ErrorBoundary /> },
  { path: '/terms', element: <TermsPage />, errorElement: <ErrorBoundary /> },
  { path: '/admin', element: <AdminPage />, errorElement: <ErrorBoundary /> },
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

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
