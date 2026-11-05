import React, { memo } from 'react';
import { Pencil } from 'lucide-react';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
import type { DepositStepId } from '../../utils/depositSteps';
import type { UploadedMedia } from '../../types/listing';

interface StepRecapProps {
  values: Record<string, any>;
  mediaList: UploadedMedia[];
  isAccessory: boolean;
  onEdit: (step: DepositStepId) => void;
}

const S = {
  HeaderSection: 'text-center md:text-left mb-8',
  Title: 'text-[26px] md:text-3xl leading-[1.15] font-extrabold text-gray-900 mb-2 tracking-[-0.02em]',
  Subtitle: 'text-base leading-relaxed text-gray-600',
  Section: 'py-6 first:pt-0 last:pb-0',
  SectionHead: 'flex items-center justify-between gap-4 mb-4',
  SectionTitle: 'text-[16px] font-bold text-gray-900',
  EditButton:
    'inline-flex items-center gap-1.5 min-h-11 px-3 -mr-3 rounded-xl text-[14px] font-semibold text-primary-700 hover:bg-primary-50 hover:text-primary-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900',
  Grid: 'grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4',
  Term: 'text-[13px] font-medium text-gray-600',
  Value: 'mt-0.5 text-[16px] font-semibold text-gray-900 break-words',
  Missing: 'mt-0.5 text-[16px] text-gray-500',
};

const show = (v: unknown): string | null => {
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const formatNumber = (v: unknown, unit: string): string | null => {
  const n = Number(String(v ?? '').replace(/\s/g, ''));
  return show(v) && Number.isFinite(n) ? `${n.toLocaleString('fr-FR')} ${unit}` : show(v);
};

const Section: React.FC<{ title: string; step: DepositStepId; onEdit: StepRecapProps['onEdit']; children: React.ReactNode }> = ({
  title, step, onEdit, children,
}) => (
  <section className={S.Section} aria-label={title}>
    <div className={S.SectionHead}>
      <h3 className={S.SectionTitle}>{title}</h3>
      <button type="button" onClick={() => onEdit(step)} className={S.EditButton} aria-label={`Modifier : ${title}`}>
        <Pencil size={14} aria-hidden="true" />
        Modifier
      </button>
    </div>
    {children}
  </section>
);

const Facts: React.FC<{ items: [string, string | null][] }> = ({ items }) => (
  <dl className={S.Grid}>
    {items.map(([term, value]) => (
      <div key={term} className="min-w-0">
        <dt className={S.Term}>{term}</dt>
        <dd className={value ? S.Value : S.Missing}>{value ?? 'Non renseigné'}</dd>
      </div>
    ))}
  </dl>
);

/**
 * Last wizard step: everything the seller entered, grouped like the steps,
 * each group with a "Modifier" link back to its step. "Publier" sits in the
 * wizard's bottom bar.
 */
export const StepRecap = memo(({ values: v, mediaList, isAccessory, onEdit }: StepRecapProps) => {
  const photos = mediaList.filter((m) => m.status === 'success');

  const vehicle: [string, string | null][] = isAccessory
    ? [
        ['Catégorie', show(v.category)],
        ["Type d'accessoire", show(v.accessoryType)],
        ['Marque', show(v.brand)],
        ['Modèle', show(v.model)],
        ['État', show(v.condition)],
        ...([
          ['Type de casque', show(v.helmetType)],
          ['Visière', show(v.visorType)],
          ['Taille', show(v.size)],
          ['Genre', show(v.gender)],
          ['Pointure', show(v.shoeSize)],
          ["Type d'antivol", show(v.antiTheftType)],
          ['Options', show(v.intercomFeatures)],
        ] as [string, string | null][]).filter(([, value]) => value),
      ]
    : [
        ['Catégorie', show(v.category)],
        ['Marque', show(v.brand)],
        ['Modèle', show(v.model)],
        ['État', show(v.condition)],
        ['Année', show(v.year)],
        ['Kilométrage', formatNumber(v.mileage, 'km')],
        ['Cylindrée', v.cc === 'Autre' ? 'Autre / Électrique' : formatNumber(v.cc, 'cc')],
      ];

  const place = [show(v.city), show(v.governorate)].filter(Boolean);
  const uniquePlace = place.length === 2 && place[0] === place[1] ? [place[0]] : place;
  const equipment: string[] = Array.isArray(v.equipment) ? v.equipment : [];

  return (
    <div>
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Vérifiez votre annonce</h2>
        <p className={S.Subtitle}>Relisez avant de publier. Vous pouvez encore modifier chaque partie.</p>
      </div>

      <div className="divide-y divide-gray-100">
        <Section title={`Photos (${photos.length})`} step="photos" onEdit={onEdit}>
          {photos.length > 0 ? (
            <ul className="grid grid-cols-4 sm:grid-cols-5 gap-2" aria-label="Photos de l'annonce">
              {photos.slice(0, 5).map((m, i) => (
                <li key={m.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={getOptimizedImageUrl(m.url, 240, 180, 70)}
                    alt={i === 0 ? 'Photo principale' : `Photo ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {i === 4 && photos.length > 5 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-gray-900/60 text-white text-[15px] font-black">
                      +{photos.length - 5}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={S.Missing}>Aucune photo</p>
          )}
        </Section>

        <Section title={isAccessory ? 'Accessoire' : 'Véhicule'} step="technical" onEdit={onEdit}>
          <Facts items={vehicle} />
        </Section>

        {!isAccessory && (
          <Section title="Équipements" step="equipment" onEdit={onEdit}>
            {equipment.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {equipment.map((e) => (
                  <li key={e} className="px-3 py-1.5 rounded-full bg-gray-100 text-[14px] font-medium text-gray-700">{e}</li>
                ))}
              </ul>
            ) : (
              <p className={S.Missing}>Aucun équipement sélectionné</p>
            )}
          </Section>
        )}

        <Section title="Prix et contact" step="details" onEdit={onEdit}>
          <Facts
            items={[
              ['Prix', formatNumber(v.price, 'DT')],
              ['Lieu', uniquePlace.length ? uniquePlace.join(', ') : null],
              ['Téléphone', show(v.phone)],
              ['Contact', v.contactMethod === 'callback' ? 'Rappel (numéro masqué)' : 'Numéro affiché'],
            ]}
          />
        </Section>

        <Section title="Description" step="details" onEdit={onEdit}>
          {show(v.description) ? (
            <p className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-line break-words max-w-[70ch]">{v.description}</p>
          ) : (
            <p className={S.Missing}>Non renseignée</p>
          )}
        </Section>
      </div>
    </div>
  );
});
