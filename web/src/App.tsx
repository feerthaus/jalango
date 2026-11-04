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

const router = createBrowserRouter([
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
