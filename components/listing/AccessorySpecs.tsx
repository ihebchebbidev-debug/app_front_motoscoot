import React from 'react';
import {
  Layers, ShieldCheck, Eye, Ruler, User, Footprints, Lock, Headphones,
  Sparkles, Tag, Settings2,
} from 'lucide-react';

interface AccessorySpecsProps {
  /**
   * Free-form per-listing metadata (migration 024). Only the keys the
   * deposit wizard collects for accessories are rendered — anything else
   * is silently ignored so a future schema change can't crash the page.
   */
  attributes?: Record<string, string | string[]>;
}

type FieldMeta = {
  label: string;
  icon: React.ComponentType<any>;
  /** which visual group the field belongs to */
  group: 'identification' | 'specs' | 'details';
};

// Each wizard field is mapped to a label, an icon and a visual group so we
// can render Caractéristiques as multiple themed sections instead of one
// flat grid (much easier to scan, mirrors the top "Catégorie / État" cards).
const LABELS: Record<string, FieldMeta> = {
  accessoryType:    { label: 'Accessoire',        icon: Layers,       group: 'identification' },
  helmetType:       { label: 'Type de casque',    icon: ShieldCheck,  group: 'identification' },
  antiTheftType:    { label: "Type d'antivol",    icon: Lock,         group: 'identification' },
  visorType:        { label: 'Visière',           icon: Eye,          group: 'specs' },
  intercomFeatures: { label: 'Options intercom',  icon: Headphones,   group: 'specs' },
  size:             { label: 'Taille',            icon: Ruler,        group: 'details' },
  shoeSize:         { label: 'Pointure',          icon: Footprints,   group: 'details' },
  gender:           { label: 'Genre',             icon: User,         group: 'details' },
};

// Group definitions — ordered top-to-bottom on the rendered card.
const GROUPS: { id: FieldMeta['group']; title: string; icon: React.ComponentType<any> }[] = [
  { id: 'identification', title: 'Identification', icon: Tag },
  { id: 'specs',          title: 'Spécifications', icon: Settings2 },
  { id: 'details',        title: 'Détails produit', icon: Ruler },
];

const S = {
  // Each value is a "chip card" — same DNA as the top spec cards in
  // ListingSpecs (icon column + label/value column) so accessories feel
  // native to the rest of the listing detail page.
  Grid:    'grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4',
  Item:    'group bg-card rounded-2xl border border-gray-100 flex flex-row items-stretch transition-all hover:border-primary-200 hover:shadow-md shadow-sm overflow-hidden',
  IconBox: 'w-[25%] flex items-center justify-center border-r border-gray-100 py-3 shrink-0 bg-primary-50/40 group-hover:bg-primary-50 transition-colors',
  TextBox: 'w-[75%] flex flex-col justify-center px-[10px] md:px-[14px] py-2.5 min-w-0',
  Label:   'font-sans text-[11px] font-bold text-gray-400 uppercase tracking-wider text-left mb-1',
  Value:   'font-sans text-[15px] font-extrabold text-gray-800 leading-[20px] tracking-normal text-left truncate',
  // Multi-value chips (e.g. "Fumé, Iridium") get pills under the label so
  // each option is individually readable instead of one comma-soup string.
  Chips:   'flex flex-wrap gap-1.5 mt-0.5',
  Chip:    'inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-[12px] font-bold leading-snug',

  // Group header — small caption + accent line, very subtle so the cards
  // remain the visual hero.
  GroupHeader:  'flex items-center gap-2 mb-2.5',
  GroupIcon:    'w-6 h-6 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0',
  GroupTitle:   'font-sans text-[12px] font-black text-gray-700 uppercase tracking-widest',
  GroupRule:    'flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent',
};

function asArray(v: string | string[]): string[] {
  if (Array.isArray(v)) return v.filter(s => typeof s === 'string' && s.trim().length > 0);
  return typeof v === 'string' && v.trim().length > 0 ? [v] : [];
}

/**
 * AccessorySpecs — renders the wizard-collected accessory attributes as
 * grouped spec cards (Identification / Spécifications / Détails) so the
 * accessory detail page exposes the same level of polish as bike listings,
 * with each field clearly categorised. Multi-value fields (visor types,
 * intercom features…) render as chip pills so each option is readable.
 * Returns a friendly empty state when nothing useful is available.
 */
export const AccessorySpecs: React.FC<AccessorySpecsProps> = ({ attributes }) => {
  // Keep only known fields with a non-empty value, then bucket per group.
  const buckets: Record<FieldMeta['group'], { key: string; meta: FieldMeta; values: string[] }[]> = {
    identification: [], specs: [], details: [],
  };

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      const meta = LABELS[key];
      if (!meta) continue;
      const values = asArray(value);
      if (values.length === 0) continue;
      buckets[meta.group].push({ key, meta, values });
    }
  }

  const total =
    buckets.identification.length + buckets.specs.length + buckets.details.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-6 px-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/40">
        <div className="w-11 h-11 rounded-full bg-primary-50 flex items-center justify-center mb-3">
          <Sparkles size={20} className="text-primary-600" strokeWidth={2.5} />
        </div>
        <p className="font-sans text-[14px] font-extrabold text-gray-700 leading-snug">
          Pas encore de caractéristiques détaillées
        </p>
        <p className="font-sans text-[12px] font-medium text-gray-500 leading-relaxed mt-1 max-w-sm">
          Le vendeur n'a pas renseigné les détails de cet accessoire. Contactez-le directement pour en savoir plus (taille, état, compatibilité…).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(g => {
        const items = buckets[g.id];
        if (items.length === 0) return null;
        const GIcon = g.icon;
        return (
          <section key={g.id}>
            <header className={S.GroupHeader}>
              <span className={S.GroupIcon}>
                <GIcon size={14} strokeWidth={2.5} />
              </span>
              <span className={S.GroupTitle}>{g.title}</span>
              <span className={S.GroupRule} />
            </header>

            <div className={S.Grid}>
              {items.map(({ key, meta, values }) => {
                const Icon = meta.icon;
                const multi = values.length > 1;
                return (
                  <div key={key} className={S.Item}>
                    <div className={S.IconBox}>
                      <Icon size={22} className="text-primary-600" strokeWidth={2.5} />
                    </div>
                    <div className={S.TextBox}>
                      <span className={S.Label}>{meta.label}</span>
                      {multi ? (
                        <div className={S.Chips}>
                          {values.map(v => (
                            <span key={v} className={S.Chip}>{v}</span>
                          ))}
                        </div>
                      ) : (
                        <span className={S.Value} title={values[0]}>{values[0]}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default AccessorySpecs;
