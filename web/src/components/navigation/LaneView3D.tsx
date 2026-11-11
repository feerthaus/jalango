import { useId } from 'react';
import type { RouteStep } from '@/types';
import { LANE_W, laneArrowPath, ROAD_H } from '@/utils/laneArrows';
import { laneArrow } from './LaneGuide';

/**
 * Close to a junction: the road ahead in perspective, with the lanes to use
 * lit up and their arrows painted on the tarmac (like a junction view).
 * Drawn from the route's lane data, so it works everywhere Mapbox has lanes.
 */
export function LaneView3D({ step, lang }: { step: RouteStep; lang: 'ms' | 'en' }) {
  const id = useId().replace(/:/g, '');
  const lanes = step.lanes ?? [];
  const n = lanes.length;
  const w = n * LANE_W;
  const valid = lanes.filter((l) => l.valid).length;
  const pad = 30; // shoulders
  return (
    <div
      className="relative h-36 overflow-hidden border-t border-white/10 bg-gradient-to-b from-sky-900/70 via-ink-900 to-ink-950"
      role="img"
      aria-label={lang === 'ms' ? `Guna ${valid} daripada ${n} lorong yang bertanda hijau` : `Use the ${valid} of ${n} lanes marked green`}
    >
      {/* horizon glow */}
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-sky-400/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex h-[150%] justify-center" style={{ perspective: '220px', perspectiveOrigin: '50% 0%' }}>
        <svg
          viewBox={`${-pad} 0 ${w + pad * 2} ${ROAD_H}`}
          preserveAspectRatio="xMidYMax meet"
          className="h-full max-w-[min(100%,26rem)]"
          style={{ transform: 'rotateX(58deg)', transformOrigin: '50% 100%' }}
        >
          <defs>
            <marker id={`h-ok-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#5cf0c4" />
            </marker>
            <marker id={`h-no-${id}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#64748b" />
            </marker>
            <linearGradient id={`ok-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#14c493" stopOpacity="0.05" />
              <stop offset="1" stopColor="#14c493" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          {/* tarmac */}
          <rect x={-pad} y="0" width={w + pad * 2} height={ROAD_H} fill="#1e293b" />
          {lanes.map((l, i) => l.valid && <rect key={`g${i}`} x={i * LANE_W + 3} y="0" width={LANE_W - 6} height={ROAD_H} fill={`url(#ok-${id})`} />)}
          {/* edges */}
          <line x1="0" y1="0" x2="0" y2={ROAD_H} stroke="#e2e8f0" strokeWidth="5" />
          <line x1={w} y1="0" x2={w} y2={ROAD_H} stroke="#e2e8f0" strokeWidth="5" />
          {/* lane dividers, moving towards the driver */}
          {lanes.slice(1).map((_, i) => (
            <line key={`d${i}`} x1={(i + 1) * LANE_W} y1="0" x2={(i + 1) * LANE_W} y2={ROAD_H} stroke="#e2e8f0" strokeWidth="4" strokeDasharray="26 26" className="motion-safe:animate-lane-dash" />
          ))}
          {/* arrows */}
          {lanes.map((l, i) => (
            <path
              key={`a${i}`}
              d={laneArrowPath(laneArrow(l.indications, step.maneuver.modifier))}
              transform={`translate(${i * LANE_W} 0)`}
              fill="none"
              stroke={l.valid ? '#5cf0c4' : '#64748b'}
              strokeOpacity={l.valid ? 1 : 0.55}
              strokeWidth={l.valid ? 14 : 10}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#h-${l.valid ? 'ok' : 'no'}-${id})`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
