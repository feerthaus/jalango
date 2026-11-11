import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useRouting } from '@/contexts/RoutingContext';
import { useT } from '@/lib/i18n';
import type { Coordinates } from '@/types';
import { reversePath, type LngLat } from '@/utils/trace';

/** "Ikut laluan ini" / "Balik ikut jalan sama" for a path the driver drove before. */
export function useFollowPath() {
  const { followPath } = useRouting();
  const navigate = useNavigate();
  const [t] = useT();

  const follow = useCallback(
    (name: string, path: LngLat[], destination: { name: string; coordinates: Coordinates }) => {
      followPath({
        title: t(`laluan anda: ${name}`, `your route: ${name}`),
        path,
        destination: { id: `saved-route-end:${destination.coordinates.lat},${destination.coordinates.lng}`, name: destination.name, address: t('Ikut laluan yang anda lalui sebelum ini', 'Following a route you drove before'), coordinates: destination.coordinates, kind: 'other', source: 'link' },
      });
      navigate('/');
    },
    [followPath, navigate, t],
  );

  const goBack = useCallback(
    (name: string, path: LngLat[]) => {
      const back = reversePath(path);
      const end = back[back.length - 1];
      followPath({
        title: t(`balik ikut jalan sama: ${name}`, `back the same way: ${name}`),
        path: back,
        destination: { id: `saved-route-start:${end[1]},${end[0]}`, name: t(`Titik mula (${name})`, `Start point (${name})`), address: t('Balik ikut jalan yang sama', 'Back the same way'), coordinates: { lng: end[0], lat: end[1] }, kind: 'other', source: 'link' },
      });
      navigate('/');
    },
    [followPath, navigate, t],
  );

  return { follow, goBack };
}
