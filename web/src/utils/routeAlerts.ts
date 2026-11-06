import type { TrafficReport } from '@/types';
import { projectOnRoute, type RouteIndex } from './routeProgress';

/** A report that lies on the route, with its position along it. */
export interface ReportOnRoute {
  report: TrafficReport;
  /** metres from the route start */
  along: number;
}

/** Reports within `maxOffset` metres of the route line, ordered along the route. */
export function reportsOnRoute(index: RouteIndex, reports: TrafficReport[], maxOffset = 50): ReportOnRoute[] {
  if (index.coords.length < 2) return [];
  const out: ReportOnRoute[] = [];
  for (const report of reports) {
    const p = projectOnRoute(index, { lat: report.latitude, lng: report.longitude });
    if (p.offset <= maxOffset) out.push({ report, along: p.along });
  }
  return out.sort((a, b) => a.along - b.along);
}

export interface UpcomingAlert {
  report: TrafficReport;
  /** metres ahead along the route */
  distance: number;
}

/** Reports ahead of the driver, nearest first, up to `horizon` metres. */
export function upcomingAlerts(onRoute: ReportOnRoute[], along: number, horizon = 2000): UpcomingAlert[] {
  return onRoute
    .filter((r) => r.along > along + 5 && r.along - along <= horizon)
    .map((r) => ({ report: r.report, distance: r.along - along }));
}

/** Reports the driver has just driven past (between `min` and `max` metres behind). */
export function justPassed(onRoute: ReportOnRoute[], along: number, min = 30, max = 400): ReportOnRoute[] {
  return onRoute.filter((r) => along - r.along >= min && along - r.along <= max);
}
