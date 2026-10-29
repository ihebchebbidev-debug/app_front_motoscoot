/**
 * Client-side cross-field matcher for TechSpec.
 *
 * Used by the public "Fiches techniques" pages so a query like "689",
 * "Sport", "73 ch", "Quickshifter" matches a spec regardless of which
 * sub-object stored the value (engine, chassis, electronics, dimensions…).
 *
 * Kept dependency-free and case/diacritic-insensitive. We don't try to
 * tokenise the query — substring match is what users expect ("MT" → "MT-07").
 *
 * Number/unit normalization: queries like "689", "689cc", "689 cc" all
 * collapse to the same canonical token "689cc" so they match a stored value
 * of "689 cc" or "689cm³". Same for power (ch/hp/kw), torque (nm), speed
 * (km/h, kmh, kph), weight (kg), capacity (l, litres).
 */
import type { TechSpec } from '../types';
import React from 'react';

const norm = (v: unknown): string =>
  v == null
    ? ''
    : String(v)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

/**
 * Canonicalize a normalized string so number+unit variants collapse to a
 * single form. Operates on already-lowercased/diacritic-stripped text.
 *
 * Examples:
 *   "689 cc"       → "689cc"
 *   "689 cm3"      → "689cc"
 *   "73 ch"        → "73ch"
 *   "73 hp" / "73 chevaux" → "73ch"
 *   "55 kw"        → "55kw"
 *   "180 km/h"     → "180kmh"
 *   "190 kg"       → "190kg"
 *   "14 l" / "14 litres" → "14l"
 *   "68 nm"        → "68nm"
 */
const canonicalize = (s: string): string => {
  let out = s;
  // Collapse "cm3" / "cm^3" / "cm³" → "cc"
  out = out.replace(/cm\s*(?:\^?\s*3|³)/g, 'cc');
  // Power synonyms → "ch"
  out = out.replace(/\b(?:hp|bhp|chevaux|cv)\b/g, 'ch');
  // Speed: "km/h", "km h", "kph" → "kmh"
  out = out.replace(/km\s*\/\s*h/g, 'kmh').replace(/\bkph\b/g, 'kmh');
  // Capacity: "litres"/"litre" → "l"
  out = out.replace(/\blitres?\b/g, 'l');
  // Strip whitespace between a number and a known unit so "689 cc" → "689cc".
  out = out.replace(
    /(\d)[\s\u00a0]+(cc|ch|kw|kmh|kg|nm|mm|cm|km|l)\b/g,
    '$1$2',
  );
  return out;
};

/** Flatten every leaf string/number from a spec into one searchable haystack. */
export function buildTechSpecHaystack(s: TechSpec): string {
  const parts: string[] = [
    s.brand,
    s.model,
    String(s.year ?? ''),
    s.category as string,
    s.priceNew,
    // Engine
    s.engine?.type, s.engine?.cc, s.engine?.power, s.engine?.torque,
    s.engine?.fuelSystem, s.engine?.cooling, s.engine?.transmission,
    // Chassis
    s.chassis?.frame, s.chassis?.suspensionFront, s.chassis?.suspensionRear,
    s.chassis?.brakesFront, s.chassis?.brakesRear,
    s.chassis?.tireFront, s.chassis?.tireRear,
    // Electronics
    s.electronics?.abs, s.electronics?.tcs,
    s.electronics?.ridingModes, s.electronics?.quickshifter,
    // Dimensions
    s.dimensions?.weight, s.dimensions?.seatHeight, s.dimensions?.tank,
    s.dimensions?.length, s.dimensions?.wheelbase,
    // Performance
    s.consumption, s.topSpeed,
  ].map((v) => canonicalize(norm(v)));
  return parts.filter(Boolean).join(' | ');
}

/**
 * Tokenise a query into canonical search tokens. A bare number is expanded
 * into multiple unit variants so "689" matches "689cc", and "73" matches
 * "73ch" — without forcing the user to type the unit.
 */
function queryTokens(query: string): string[][] {
  const q = canonicalize(norm(query)).trim();
  if (!q) return [];
  return q.split(/\s+/).map((tok) => {
    // Pure number → expand to common unit variants + bare number.
    if (/^\d+(?:[.,]\d+)?$/.test(tok)) {
      return [tok, `${tok}cc`, `${tok}ch`, `${tok}kw`, `${tok}kmh`, `${tok}kg`, `${tok}nm`, `${tok}l`];
    }
    return [tok];
  });
}

/** True when every query token (or one of its unit variants) is present. */
export function matchesTechSpec(spec: TechSpec, query: string): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const hay = buildTechSpecHaystack(spec);
  return tokens.every((variants) => variants.some((v) => hay.includes(v)));
}

/**
 * Build the set of literal substrings from a query that should be visually
 * highlighted in result text. We keep the user's raw tokens (not canonical
 * forms) so React renders exactly what they typed, plus their digit prefixes
 * so "689cc" lights up the "689" inside "689 cc".
 */
export function getHighlightTerms(query: string): string[] {
  const raw = (query || '').trim();
  if (!raw) return [];
  const out = new Set<string>();
  for (const tok of raw.split(/\s+/)) {
    if (!tok) continue;
    out.add(tok);
    // If the token starts with digits, also highlight just the number part
    // ("689cc" → also "689") so it matches stored "689 cc".
    const m = tok.match(/^(\d+(?:[.,]\d+)?)/);
    if (m && m[1] !== tok) out.add(m[1]);
  }
  return Array.from(out).filter((t) => t.length >= 1);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Render a piece of text with case/diacritic-insensitive highlights for the
 * given terms. Returns a React node (array of strings + <mark> elements).
 */
export function highlightText(
  text: string | number | null | undefined,
  terms: string[],
): React.ReactNode {
  const str = text == null ? '' : String(text);
  if (!str || !terms.length) return str;
  // Use the normalized text to find match positions, then slice the original
  // so we preserve casing/accents in the output.
  const normalized = norm(str);
  const pattern = new RegExp(
    `(${terms.map((t) => escapeRegExp(norm(t))).filter(Boolean).join('|')})`,
    'gi',
  );
  const out: Array<string | { key: string; value: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(normalized)) !== null) {
    if (m.index > last) out.push(str.slice(last, m.index));
    const slice = str.slice(m.index, m.index + m[0].length);
    out.push({ key: `${m.index}-${slice}`, value: slice });
    last = m.index + m[0].length;
    if (m.index === pattern.lastIndex) pattern.lastIndex++; // avoid zero-width loop
  }
  if (last < str.length) out.push(str.slice(last));

  return out.map((part, i) =>
    typeof part === 'string'
      ? part
      : React.createElement(
          'mark',
          {
            key: `${i}-${part.key}`,
            className:
              'bg-primary-100 text-primary-700 rounded px-0.5 font-extrabold',
          },
          part.value,
        ),
  );
}
