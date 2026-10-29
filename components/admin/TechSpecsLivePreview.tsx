/**
 * TechSpecsLivePreview — sticky panel rendered next to the admin form so the
 * admin sees, in real time, exactly what the public "fiche détaillée" will
 * look like as they type and upload images.
 *
 * It intentionally mirrors the structure of components/TechSpecsDetails.tsx
 * (hero image + gallery thumbnails, identity strip, then the same five spec
 * sections) but in a compact, card-friendly layout so it fits in a sidebar.
 *
 * The component is purely presentational — it consumes the same SpecForm
 * shape the form edits and never touches the network.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Eye,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Settings,
  Cpu,
  Ruler,
  Activity,
} from 'lucide-react';

export interface PreviewSpec {
  brand: string;
  model: string;
  year: number | string;
  category: string;
  price_new: string;
  image: string;
  gallery: string[];
  norm_logo: string;
  engine_type: string;
  engine_cc: string;
  engine_power: string;
  engine_torque: string;
  fuel_system: string;
  cooling: string;
  transmission: string;
  frame: string;
  suspension_front: string;
  travel_front: string;
  suspension_rear: string;
  travel_rear: string;
  brakes_front: string;
  brakes_rear: string;
  tire_front: string;
  tire_rear: string;
  abs: string;
  tcs: string;
  riding_modes: string;
  quickshifter: string;
  lighting?: string;
  usb?: string;
  dashboard?: string;
  connectivity?: string;
  cruise_control?: string;
  keyless?: string;
  other_equipment?: string;
  warranty?: string;
  first_service?: string;
  service_interval?: string;
  weight: string;
  seat_height: string;
  tank: string;
  length: string;
  wheelbase: string;
  consumption: string;
  top_speed: string;
}

interface Props {
  form: PreviewSpec;
  brandLogo?: string;
}

/** A single label/value row, hidden when both are empty. */
const Row: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const v = (value || '').trim();
  return (
    <div className="flex justify-between items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-bold text-right ${v ? 'text-slate-900' : 'text-slate-300'}`}>
        {v || '—'}
      </span>
    </div>
  );
};

/** Section card with an icon header. Renders nothing when all rows are empty. */
const SpecSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  rows: Array<{ label: string; value?: string }>;
}> = ({ title, icon, rows }) => {
  const hasAny = rows.some((r) => (r.value || '').trim());
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center">
          {icon}
        </span>
        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">{title}</h5>
        {!hasAny && (
          <span className="ml-auto text-[9px] text-slate-300 italic">vide</span>
        )}
      </div>
      <div>
        {rows.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} />
        ))}
      </div>
    </div>
  );
};

const formatPrice = (v: string): string => {
  if (!v) return '';
  const str = String(v).trim();
  if (!str) return '';
  const isPureNumber = /^-?\d+(\.\d+)?$/.test(str);
  if (isPureNumber) {
    const n = parseFloat(str);
    if (Number.isFinite(n) && n > 0) return `${n.toLocaleString('fr-FR')} DT`;
    return '';
  }
  return str;
};

export const TechSpecsLivePreview: React.FC<Props> = ({ form, brandLogo }) => {
  // Combined image list: cover first, then gallery (deduped + non-empty).
  const images = useMemo(() => {
    const list = [form.image, ...(form.gallery || [])]
      .map((u) => (u || '').trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [form.image, form.gallery]);

  const [idx, setIdx] = useState(0);
  // Reset/clamp the carousel index when the underlying image list shrinks
  // (e.g. admin removes the cover or a gallery item).
  useEffect(() => {
    if (idx > Math.max(0, images.length - 1)) setIdx(0);
  }, [images.length, idx]);

  const current = images[idx];
  const price = formatPrice(form.price_new);
  const title = [form.brand, form.model].filter(Boolean).join(' ').trim() || 'Nouvelle fiche';

  return (
    <aside className="lg:sticky lg:top-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Eye size={14} className="text-primary-600" />
        Aperçu en direct (vue utilisateur)
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* HERO IMAGE + carousel */}
        <div className="relative aspect-[4/3] bg-slate-200">
          {current ? (
            <img
              src={current}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.25'; }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <ImageIcon size={32} />
              <p className="text-[11px] mt-2">Aucune image</p>
            </div>
          )}

          {form.norm_logo && (
            <img
              src={form.norm_logo}
              alt="Norme"
              className="absolute top-2 right-2 h-8 w-auto bg-white/90 rounded px-1 py-0.5 border border-white shadow-sm"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label="Image précédente"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
                aria-label="Image suivante"
              >
                <ChevronRight size={14} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                {idx + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        {/* Gallery thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-1.5 px-3 py-2 overflow-x-auto bg-white border-b border-slate-100">
            {images.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIdx(i)}
                className={`w-12 h-12 shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  i === idx ? 'border-primary-500' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* IDENTITY strip — mirrors the hero text on TechSpecsDetails. */}
        <div className="bg-white p-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            {brandLogo && (
              <img
                src={brandLogo}
                alt={form.brand}
                className="w-10 h-10 object-contain border border-slate-200 rounded-md p-0.5 bg-white shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {form.category && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-black uppercase tracking-wider">
                    {form.category}
                  </span>
                )}
                {form.year && (
                  <span className="text-[11px] text-slate-500 font-bold">{form.year}</span>
                )}
              </div>
              <h3 className="text-base font-black text-slate-900 leading-tight mt-1 truncate">
                {title}
              </h3>
              {price && (
                <p className="text-[13px] font-black text-primary-600 mt-1">{price}</p>
              )}
            </div>
          </div>
        </div>

        {/* SPEC SECTIONS — same five groups as the public details page. */}
        <div className="p-3 space-y-3 bg-slate-50">
          <SpecSection
            title="Moteur"
            icon={<Zap size={12} />}
            rows={[
              { label: 'Type', value: form.engine_type },
              { label: 'Cylindrée', value: form.engine_cc },
              { label: 'Puissance', value: form.engine_power },
              { label: 'Couple', value: form.engine_torque },
              { label: 'Transmission', value: form.transmission },
              { label: 'Refroidissement', value: form.cooling },
              { label: 'Alimentation', value: form.fuel_system },
            ]}
          />
          <SpecSection
            title="Châssis & Roues"
            icon={<Settings size={12} />}
            rows={[
              { label: 'Cadre', value: form.frame },
              { label: 'Susp. avant', value: form.suspension_front },
              { label: 'Déb. avant', value: form.travel_front },
              { label: 'Susp. arrière', value: form.suspension_rear },
              { label: 'Déb. arrière', value: form.travel_rear },
              { label: 'Frein avant', value: form.brakes_front },
              { label: 'Frein arrière', value: form.brakes_rear },
              { label: 'Pneu avant', value: form.tire_front },
              { label: 'Pneu arrière', value: form.tire_rear },
            ]}
          />
          <SpecSection
            title="Dimensions"
            icon={<Ruler size={12} />}
            rows={[
              { label: 'Poids', value: form.weight },
              { label: 'Hauteur de selle', value: form.seat_height },
              { label: 'Réservoir', value: form.tank },
              { label: 'Longueur', value: form.length },
              { label: 'Empattement', value: form.wheelbase },
            ]}
          />
          <SpecSection
            title="Électronique"
            icon={<Cpu size={12} />}
            rows={[
              { label: 'ABS', value: form.abs },
              { label: 'Contrôle traction', value: form.tcs },
              { label: 'Modes', value: form.riding_modes },
              { label: 'Quickshifter', value: form.quickshifter },
              { label: 'Éclairage', value: form.lighting },
              { label: 'Prise USB', value: form.usb },
              { label: 'Tableau de bord', value: form.dashboard },
              { label: 'Connectivité', value: form.connectivity },
              { label: 'Régulateur de vitesse', value: form.cruise_control },
              { label: 'Démarrage sans clé', value: form.keyless },
              { label: 'Autres équipements', value: form.other_equipment },
            ]}
          />
          <SpecSection
            title="Garantie & Entretien"
            icon={<Settings size={12} />}
            rows={[
              { label: 'Garantie constructeur', value: form.warranty },
              { label: 'Première révision', value: form.first_service },
              { label: 'Révisions régulières', value: form.service_interval },
            ]}
          />
          <SpecSection
            title="Performances"
            icon={<Activity size={12} />}
            rows={[
              { label: 'Vitesse max', value: form.top_speed },
              { label: 'Consommation', value: form.consumption },
            ]}
          />
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Aperçu local — non sauvegardé tant que vous n'avez pas cliqué sur{' '}
        <span className="font-bold">Enregistrer</span>.
      </p>
    </aside>
  );
};

export default TechSpecsLivePreview;
