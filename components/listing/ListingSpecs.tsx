import React from 'react';
import {
  Calendar, Gauge, Zap, Info,
  Layers, ShieldCheck, Eye, Ruler, User, Footprints, Lock, Headphones,
} from 'lucide-react';

interface ListingSpecsProps {
  year?: string;
  mileage?: string;
  cc?: string;
  condition: string;
  type?: string;
  /** Free-form per-listing metadata (migration 024). For accessories,
   *  these are merged inline with État/Catégorie so everything sits on
   *  the same spec grid instead of inside a separate Caractéristiques box. */
  attributes?: Record<string, string | string[]>;
}

const S = {
  SpecGrid: "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4",
  SpecItem: "bg-card rounded-2xl border border-gray-100 flex flex-row items-stretch transition-all hover:border-primary-100 shadow-sm overflow-hidden",
  IconBox: "w-[25%] flex items-center justify-center border-r border-gray-100 py-3 shrink-0 bg-gray-50/20",
  TextBox: "w-[75%] flex flex-col justify-center px-[10px] md:px-[14px] py-2.5 min-w-0",
  SpecLabel: "font-sans text-[12px] font-bold text-gray-400 leading-[11px] tracking-normal normal-case text-left mb-0.5",
  SpecValue: "font-sans text-[15px] font-extrabold text-gray-700 leading-[20px] tracking-normal normal-case text-left truncate",
};

const SpecItem = ({ icon: Icon, label, value }: any) => (
  <div className={S.SpecItem}>
    <div className={S.IconBox}>
      <Icon size={22} className="text-primary-600" strokeWidth={2.5} />
    </div>
    <div className={S.TextBox}>
      <span className={S.SpecLabel}>{label}</span>
      <span className={S.SpecValue} title={typeof value === 'string' ? value : undefined}>{value}</span>
    </div>
  </div>
);

// Accessory attribute → label + icon mapping. Order here defines the order
// in which they appear after État/Catégorie on the spec grid.
const ACCESSORY_FIELDS: { key: string; label: string; icon: any }[] = [
  { key: 'accessoryType',    label: 'Accessoire',       icon: Layers },
  { key: 'helmetType',       label: 'Type de casque',   icon: ShieldCheck },
  { key: 'antiTheftType',    label: "Type d'antivol",   icon: Lock },
  { key: 'visorType',        label: 'Visière',          icon: Eye },
  { key: 'intercomFeatures', label: 'Options intercom', icon: Headphones },
  { key: 'size',             label: 'Taille',           icon: Ruler },
  { key: 'shoeSize',         label: 'Pointure',         icon: Footprints },
  { key: 'gender',           label: 'Genre',            icon: User },
];

function formatValue(v: string | string[]): string {
  if (Array.isArray(v)) return v.filter(s => typeof s === 'string' && s.trim()).join(', ');
  return typeof v === 'string' ? v : '';
}

export const ListingSpecs: React.FC<ListingSpecsProps> = ({ year, mileage, cc, condition, type, attributes }) => {
  const isAccessory = type === 'Accessoires';

  const accessoryItems = isAccessory && attributes
    ? ACCESSORY_FIELDS
        .map(f => ({ ...f, value: formatValue(attributes[f.key] as any) }))
        .filter(f => f.value.length > 0)
    : [];

  return (
    <div className={S.SpecGrid}>
      {!isAccessory && (
        <>
          <SpecItem icon={Calendar} label="Année" value={year} />
          <SpecItem icon={Gauge} label="Km" value={mileage} />
          <SpecItem icon={Zap} label="Cylindrée" value={cc} />
        </>
      )}
      <SpecItem icon={Info} label="État" value={condition} />
      {accessoryItems.map(item => (
        <SpecItem key={item.key} icon={item.icon} label={item.label} value={item.value} />
      ))}
    </div>
  );
};
