/**
 * CategoryImagePicker — admin widget for picking a category illustration.
 *
 * Two sources combined in one control:
 *   1. A built-in gallery of pre-generated category artworks (Quad, Vélo,
 *      Jet ski, Pièces détachées, …) admins can pick in one click.
 *   2. The standard AdminImageUpload (file upload OR pasted URL).
 *
 * The chosen URL is propagated through `onChange`. The component is
 * intentionally stateless — the parent owns the value.
 */
import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { AdminImageUpload } from './AdminImageUpload';

// Pre-generated category artworks, importable so Vite hashes them and
// serves them with long-term caching. Adding a new preset = drop the file
// in src/assets and append it here.
import presetMoto from '../../src/assets/category-moto.jpg';
import presetScooter from '../../src/assets/category-scooter.jpg';
import presetQuad from '../../src/assets/category-quad.jpg';
import presetAccessoires from '../../src/assets/category-accessoires.jpg';
import presetVelo from '../../src/assets/category-velo.jpg';
import presetJetski from '../../src/assets/category-jetski.jpg';
import presetPieces from '../../src/assets/category-pieces.jpg';

interface Preset {
  label: string;
  url: string;
}

const PRESETS: Preset[] = [
  { label: 'Moto', url: presetMoto },
  { label: 'Scooter', url: presetScooter },
  { label: 'Quad', url: presetQuad },
  { label: 'Vélo', url: presetVelo },
  { label: 'Jet ski', url: presetJetski },
  { label: 'Pièces', url: presetPieces },
  { label: 'Accessoires', url: presetAccessoires },
];

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export const CategoryImagePicker: React.FC<Props> = ({
  value,
  onChange,
  label = 'Image catégorie',
}) => {
  return (
    <div className="space-y-3 col-span-1 md:col-span-3">
      <label className="block text-xs font-bold text-slate-700 flex items-center gap-2">
        <ImageIcon size={12} /> {label}
      </label>

      {/* Preset gallery */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Choisir parmi les visuels prêts à l'emploi
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const selected = value === p.url;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.url)}
                className={`group relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                  selected ? 'border-primary-600 ring-2 ring-primary-200' : 'border-gray-200 hover:border-primary-300'
                }`}
                title={p.label}
              >
                <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] font-bold py-0.5 text-center">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload / paste URL */}
      <AdminImageUpload value={value} onChange={onChange} label="Ou téléverser un fichier / coller une URL" />
    </div>
  );
};
