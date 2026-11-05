import React, { useMemo } from 'react';
import { getOptimizedImageUrl } from '../../utils/urlUtils';

/**
 * The deposit's one authored moment: the seller's own main photo slides into
 * an envelope, the flap closes on a Moto-Scoot seal, the envelope flies off
 * (dashed trail), and a green stamp lands with a short confetti burst.
 * ~2.2 s, plays once, decorative (aria-hidden): the heading below says it.
 * Reduced motion: the final stamp only, no movement, no confetti.
 */

const CONFETTI_COLORS = [
  'hsl(var(--primary-600))',
  'hsl(var(--primary-300))',
  'hsl(var(--success-500))',
  'hsl(var(--gray-900))',
  'hsl(var(--primary-500))',
];

const css = `
.mse-stage { position: relative; width: 240px; height: 190px; margin: 0 auto; }
.mse-stage svg { position: relative; overflow: visible; }
.mse-env, .mse-photo, .mse-flap, .mse-flap-back, .mse-seal, .mse-stamp, .mse-check, .mse-trail-mask { transform-box: fill-box; }
.mse-photo { animation: mse-drop 520ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both; }
/* The open flap sits behind the photo; the closing flap is in front. */
.mse-flap-back { transform-origin: 50% 0%; transform: scaleY(-1); animation: mse-hide 1ms linear 660ms both; }
.mse-flap { transform-origin: 50% 0%; animation: mse-fold 260ms cubic-bezier(0.4, 0, 0.2, 1) 660ms both; }
.mse-seal { transform-origin: center; animation: mse-seal 220ms cubic-bezier(0.16, 1, 0.3, 1) 860ms both; }
.mse-env { transform-origin: center; animation: mse-fly 700ms linear 960ms both; }
.mse-trail-mask { stroke-dasharray: 1 1; animation: mse-draw 520ms cubic-bezier(0.5, 0, 0.75, 0.25) 1120ms both; }
.mse-trail { animation: mse-fade 420ms ease-out 1640ms both; }
.mse-stamp { transform-origin: center; animation: mse-stamp 460ms cubic-bezier(0.16, 1, 0.3, 1) 1420ms both; }
.mse-check { stroke-dasharray: 1 1; animation: mse-draw 320ms cubic-bezier(0.16, 1, 0.3, 1) 1600ms both; }
.mse-confetti { position: absolute; left: 50%; top: 104px; width: 7px; height: 11px; border-radius: 2px; opacity: 0;
  animation: mse-burst 1000ms cubic-bezier(0.16, 1, 0.3, 1) 1380ms both; }
.mse-confetti.round { width: 7px; height: 7px; border-radius: 999px; }

@keyframes mse-drop { from { transform: translateY(-74px); opacity: 0; } 25% { opacity: 1; } to { transform: translateY(0); opacity: 1; } }
@keyframes mse-fold { from { transform: scaleY(-1); opacity: 0; } 2% { opacity: 1; } to { transform: scaleY(1); opacity: 1; } }
@keyframes mse-hide { to { opacity: 0; } }
@keyframes mse-seal { from { transform: scale(0); } to { transform: scale(1); } }
/* Follows the trail's curve; spacing of the keyframes gives the take-off its acceleration. */
@keyframes mse-fly {
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
  22%  { transform: translate(-6px, 6px) rotate(4deg) scale(1.02); opacity: 1; }
  52%  { transform: translate(28px, -20px) rotate(-8deg) scale(0.86); opacity: 1; }
  78%  { transform: translate(98px, -92px) rotate(-16deg) scale(0.6); opacity: 1; }
  100% { transform: translate(198px, -186px) rotate(-24deg) scale(0.32); opacity: 0; }
}
@keyframes mse-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes mse-fade { from { opacity: 1; } to { opacity: 0; } }
@keyframes mse-stamp { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes mse-burst {
  0%   { transform: translate(-50%, -50%) rotate(0deg) scale(0.3); opacity: 0; }
  12%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--r)); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mse-env, .mse-trail, .mse-confetti, .mse-flap-back { display: none; }
  .mse-stamp, .mse-check { animation: none; opacity: 1; transform: none; stroke-dashoffset: 0; }
}
`;

export const SentEnvelope: React.FC<{ photo?: string }> = ({ photo }) => {
  // Fixed per mount: the burst does not reshuffle on re-render.
  const confetti = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const dist = 70 + Math.random() * 60;
        return {
          x: `${Math.round(Math.cos(angle) * dist)}px`,
          // Pieces fall a little after the burst (gravity).
          y: `${Math.round(Math.sin(angle) * dist * 0.75 + 30)}px`,
          r: `${Math.round((Math.random() - 0.5) * 540)}deg`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
          delay: Math.round(Math.random() * 90),
        };
      }),
    [],
  );
  const src = photo ? getOptimizedImageUrl(photo, 160, 120, 70) : null;

  return (
    <div className="mse-stage" aria-hidden="true">
      <style>{css}</style>
      {/* Confetti start hidden behind the stamp (drawn under the SVG). */}
      {confetti.map((p, i) => (
        <span
          key={i}
          className={`mse-confetti${p.round ? ' round' : ''}`}
          style={{ background: p.color, ['--x' as any]: p.x, ['--y' as any]: p.y, ['--r' as any]: p.r, animationDelay: `${1480 + p.delay}ms` }}
        />
      ))}
      <svg viewBox="0 0 240 190" width="240" height="190">
        <defs>
          <clipPath id="mse-photo-clip"><rect x="88" y="103" width="64" height="46" rx="3" /></clipPath>
          <mask id="mse-trail-reveal" maskUnits="userSpaceOnUse" x="-40" y="-120" width="360" height="320">
            <path className="mse-trail-mask" d="M120 120 C 150 95, 170 60, 215 25 S 290 -40, 320 -70" pathLength={1}
              fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
          </mask>
        </defs>

        {/* Flight trail, revealed as the envelope leaves. */}
        <path className="mse-trail stroke-primary-300" d="M120 120 C 150 95, 170 60, 215 25 S 290 -40, 320 -70"
          fill="none" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9" mask="url(#mse-trail-reveal)" />

        <g className="mse-env">
          {/* Back of the envelope */}
          <rect x="60" y="90" width="120" height="80" rx="9" className="fill-gray-100 stroke-gray-300" strokeWidth="1.5" />
          {/* Open flap, behind the photo while it slides in */}
          <path className="mse-flap-back fill-gray-50 stroke-gray-300" d="M62 91 L120 138 L178 91 Z" strokeWidth="1.5" strokeLinejoin="round" />
          {/* The seller's main photo, as a print sliding in */}
          <g className="mse-photo">
            <rect x="84" y="99" width="72" height="54" rx="5" className="fill-card stroke-gray-200" strokeWidth="1" />
            {src ? (
              <image href={src} x="88" y="103" width="64" height="46" preserveAspectRatio="xMidYMid slice" clipPath="url(#mse-photo-clip)" />
            ) : (
              <rect x="88" y="103" width="64" height="46" rx="3" className="fill-primary-100" />
            )}
          </g>
          {/* Front pocket */}
          <path d="M60 99 Q60 90 69 90 L120 132 L171 90 Q180 90 180 99 L180 161 Q180 170 171 170 L69 170 Q60 170 60 161 Z"
            className="fill-card stroke-gray-300" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Flap in front: folds down over the photo */}
          <path className="mse-flap fill-gray-50 stroke-gray-300" d="M62 91 L120 138 L178 91 Z" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Seal */}
          <g className="mse-seal">
            <circle cx="120" cy="136" r="10" className="fill-primary-700" />
            <text x="120" y="140" textAnchor="middle" className="fill-white" style={{ font: '900 11px Inter, system-ui, sans-serif' }}>M</text>
          </g>
        </g>

        {/* Stamp: where the envelope was */}
        <g className="mse-stamp">
          <circle cx="120" cy="114" r="36" className="fill-success-500" />
          <circle cx="120" cy="114" r="44" fill="none" className="stroke-success-200" strokeWidth="3" />
          <path className="mse-check" d="M104 115 L115 126 L137 103" pathLength={1} fill="none" stroke="#fff"
            strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

    </div>
  );
};

export default SentEnvelope;
