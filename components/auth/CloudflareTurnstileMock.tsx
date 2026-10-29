/**
 * CloudflareTurnstileMock — pixel-accurate visual clone of the Cloudflare
 * Turnstile widget ("Verifying…" → "Success!"). Purely cosmetic anti-bot
 * affordance for the login form; no real verification is performed.
 *
 * Visual reference: light gray rounded container, dotted ring spinner on
 * the left, label in the middle, official Cloudflare wordmark + logo on
 * the right with "Privacy • Terms" subtext.
 */
import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: boolean;
}

const CloudflareLogo: React.FC = () => (
  // Official Cloudflare wordmark + cloud (inline SVG so it renders offline).
  <div className="flex flex-col items-end leading-none">
    <div className="flex items-center gap-1.5">
      <span
        className="text-[13px] font-extrabold tracking-[0.04em] text-[#404041]"
        style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
      >
        CLOUDFLARE
      </span>
      <svg width="22" height="14" viewBox="0 0 64 40" aria-hidden="true">
        {/* Simplified Cloudflare cloud (orange/yellow gradient) */}
        <defs>
          <linearGradient id="cf-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBAD41" />
            <stop offset="100%" stopColor="#F48120" />
          </linearGradient>
        </defs>
        <path
          fill="url(#cf-grad)"
          d="M42.6 28.6L43.7 24.8c.5-1.8.3-3.5-.6-4.7-.8-1.1-2.2-1.8-3.8-1.9l-23.6-.3c-.2 0-.3-.1-.4-.2-.1-.2-.1-.3-.1-.5.1-.3.3-.5.6-.5l23.8-.3c2.8-.1 5.9-2.4 6.9-5.2l1.4-3.7c.1-.2.1-.3 0-.5C46.4 2.9 41 0 35 0c-5.6 0-10.4 3.6-12 8.6-1.1-.8-2.4-1.2-3.9-1.1-2.6.3-4.7 2.4-5 5-.1.7 0 1.3.1 1.9C9.9 14.5 6.5 18 6.5 22.4c0 .4 0 .8.1 1.2.1.2.2.3.4.3h35.1c.2 0 .4-.2.5-.4l.1-.9z"
        />
        <path
          fill="#FAAE40"
          d="M50.3 12.8c-.2 0-.4 0-.7.1-.1 0-.3.1-.3.3l-.8 2.6c-.3 1.2-.2 2.3.3 3 .5.8 1.4 1.2 2.5 1.3l5 .3c.1 0 .3.1.3.2.1.1.1.3.1.4-.1.2-.2.4-.4.4l-5.2.3c-2.8.1-5.9 2.4-6.9 5.2l-.4 1c-.1.2 0 .3.2.3h17.9c.2 0 .4-.1.4-.3.3-1 .5-2.1.5-3.2-.1-6-5-10.9-11.1-10.9z"
        />
      </svg>
    </div>
    <div
      className="text-[10.5px] font-normal text-[#404041] mt-0.5"
      style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
    >
      Privacy <span className="mx-0.5">•</span> Terms
    </div>
  </div>
);

const DottedSpinner: React.FC = () => (
  // 12-dot ring rotating like the real Turnstile spinner.
  <div className="relative w-[26px] h-[26px] animate-[cf-spin_1s_linear_infinite]">
    {Array.from({ length: 12 }).map((_, i) => (
      <span
        key={i}
        className="absolute left-1/2 top-1/2 w-[3px] h-[3px] rounded-full bg-[#3a9b3a]"
        style={{
          transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(-11px)`,
          opacity: 0.25 + (i / 12) * 0.75,
        }}
      />
    ))}
    <style>{`@keyframes cf-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const CloudflareTurnstileMock: React.FC<Props> = ({ checked, onChange, error }) => {
  const [state, setState] = useState<'idle' | 'verifying' | 'success'>(
    checked ? 'success' : 'idle',
  );

  // Keep external `checked` in sync (e.g. parent reset).
  useEffect(() => {
    if (!checked && state === 'success') setState('idle');
    if (checked && state !== 'success') setState('success');
  }, [checked]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (state !== 'idle') return;
    setState('verifying');
    // Simulate Cloudflare's ~1.4s verification round-trip.
    window.setTimeout(() => {
      setState('success');
      onChange(true);
    }, 1400);
  };

  const label =
    state === 'verifying' ? 'Verifying...' : state === 'success' ? 'Success!' : 'Verify you are human';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-pressed={state === 'success'}
      aria-label="Cloudflare verification"
      className={`mt-5 select-none flex items-center justify-between gap-4 px-5 py-4 rounded-[10px] border bg-[#fafafa] transition-colors ${
        error ? 'border-red-300' : 'border-[#e5e5e5]'
      } ${state === 'idle' ? 'cursor-pointer hover:bg-[#f3f3f3]' : 'cursor-default'}`}
      style={{ minHeight: 70 }}
    >
      <div className="flex items-center gap-4 min-w-0">
        {state === 'verifying' ? (
          <DottedSpinner />
        ) : state === 'success' ? (
          <div className="w-[26px] h-[26px] rounded-full bg-[#3a9b3a] flex items-center justify-center">
            <Check size={16} className="text-white" strokeWidth={3.5} />
          </div>
        ) : (
          <div className="w-[26px] h-[26px] rounded-[5px] border-2 border-[#bdbdbd] bg-white" />
        )}
        <span
          className="text-[15px] text-[#404041] font-normal truncate"
          style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
        >
          {label}
        </span>
      </div>
      <CloudflareLogo />
    </div>
  );
};

export default CloudflareTurnstileMock;
