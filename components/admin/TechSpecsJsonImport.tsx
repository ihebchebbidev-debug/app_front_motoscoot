/**
 * TechSpecsJsonImport — paste-JSON shortcut for "Fiches techniques".
 * See `mapJsonToForm` below for the full validation rules.
 */
import React, { useState } from 'react';
import { ClipboardCopy, Upload, Check, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const TEMPLATE = {
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  category: '',
  price_new: null as number | null,
  image: '',
  gallery: [] as string[],
  norm_logo: '',
  engine: {
    type: '', cc: '', power: '', torque: '',
    fuelSystem: '', cooling: '', transmission: '',
  },
  chassis: {
    frame: '', suspensionFront: '', travelFront: '',
    suspensionRear: '', travelRear: '',
    brakesFront: '', brakesRear: '',
    tireFront: '', tireRear: '',
  },
  electronics: { abs: '', tcs: '', ridingModes: '', quickshifter: '' },
  dimensions: { weight: '', seatHeight: '', tank: '', length: '', wheelbase: '' },
  consumption: '',
  top_speed: '',
};

const PROMPT = `Tu es un expert moto. Renvoie UNIQUEMENT un objet JSON valide (sans markdown, sans texte avant/après) qui décrit la fiche technique complète de la moto suivante : <MARQUE> <MODÈLE> <ANNÉE>.

Utilise EXACTEMENT cette structure de clés (laisse une chaîne vide si inconnu) :
${JSON.stringify(TEMPLATE, null, 2)}

Règles :
- Toutes les valeurs textuelles incluent l'unité (ex: "689 cc", "73 ch", "67 Nm", "184 kg", "805 mm", "14 L").
- price_new = nombre en DT (Dinar Tunisien) ou null si inconnu.
- gallery = tableau d'URLs d'images publiques (ou tableau vide).
- image = URL principale (ou chaîne vide).
- Réponds en français.`;

type AnyForm = Record<string, any>;

export interface ImportIssue {
  field: string;       // form field key, e.g. "year", "engine_cc"
  label: string;       // human label shown to admin
  message: string;     // why it's wrong
  severity: 'error' | 'warning';
}

export interface ImportResult {
  partial: AnyForm;        // fields safe to apply
  errors: ImportIssue[];   // blocking — apply is refused
  warnings: ImportIssue[]; // non-blocking — value coerced or skipped
  appliedCount: number;
}

// Pull a value from either a nested path (e.g. ["engine","cc"]) or a flat
// fallback key. Returns undefined when neither is present so we don't
// overwrite existing form data with empty strings from missing fields.
const pick = (obj: AnyForm, nested: string[], flat?: string): any => {
  let cur: any = obj;
  for (const k of nested) {
    if (cur && typeof cur === 'object' && k in cur) cur = cur[k];
    else { cur = undefined; break; }
  }
  if (cur !== undefined && cur !== null && cur !== '') return cur;
  if (flat && obj[flat] !== undefined && obj[flat] !== null && obj[flat] !== '') return obj[flat];
  return undefined;
};

const isHttpUrl = (s: string): boolean => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
};

// Map a parsed JSON object to the SpecForm shape used by TechSpecsTab.
// Validates required fields and number/url shapes; returns a result with
// errors (blocking) and warnings (silently skipped fields).
export function mapJsonToForm(raw: AnyForm): ImportResult {
  const out: AnyForm = {};
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  // --- Required strings -------------------------------------------------
  const reqStr = (key: string, label: string, value: any) => {
    if (value === undefined) {
      errors.push({ field: key, label, message: 'Champ obligatoire manquant', severity: 'error' });
      return;
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push({ field: key, label, message: `Doit être une chaîne (reçu: ${typeof value})`, severity: 'error' });
      return;
    }
    const s = String(value).trim();
    if (!s) {
      errors.push({ field: key, label, message: 'Ne peut pas être vide', severity: 'error' });
      return;
    }
    if (s.length > 120) {
      errors.push({ field: key, label, message: `Trop long (${s.length} caractères, max 120)`, severity: 'error' });
      return;
    }
    out[key] = s;
  };
  reqStr('brand', 'Marque', pick(raw, ['brand']));
  reqStr('model', 'Modèle', pick(raw, ['model']));

  // --- year (int, 1900–2100) -------------------------------------------
  const yRaw = pick(raw, ['year']);
  if (yRaw === undefined) {
    errors.push({ field: 'year', label: 'Année', message: 'Champ obligatoire manquant', severity: 'error' });
  } else {
    const n = Number(yRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      errors.push({ field: 'year', label: 'Année', message: `Doit être un entier (reçu: "${yRaw}")`, severity: 'error' });
    } else if (n < 1900 || n > 2100) {
      errors.push({ field: 'year', label: 'Année', message: `Doit être entre 1900 et 2100 (reçu: ${n})`, severity: 'error' });
    } else {
      out.year = n;
    }
  }

  // --- Optional simple strings -----------------------------------------
  const optStr = (key: string, label: string, value: any, maxLen = 200) => {
    if (value === undefined) return;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      warnings.push({ field: key, label, message: `Type non supporté (${typeof value}) — ignoré`, severity: 'warning' });
      return;
    }
    const s = String(value).trim();
    if (!s) return;
    if (s.length > maxLen) {
      warnings.push({ field: key, label, message: `Tronqué (${s.length} → ${maxLen} caractères)`, severity: 'warning' });
      out[key] = s.slice(0, maxLen);
      return;
    }
    out[key] = s;
  };

  optStr('category', 'Catégorie', pick(raw, ['category']), 60);

  // --- price_new (positive number, ≤ 10M) -------------------------------
  const pRaw = pick(raw, ['price_new'], 'priceNew');
  if (pRaw !== undefined) {
    const n = Number(pRaw);
    if (!Number.isFinite(n)) {
      errors.push({ field: 'price_new', label: 'Prix neuf', message: `Doit être un nombre (reçu: "${pRaw}")`, severity: 'error' });
    } else if (n < 0) {
      errors.push({ field: 'price_new', label: 'Prix neuf', message: `Doit être positif (reçu: ${n})`, severity: 'error' });
    } else if (n > 10_000_000) {
      errors.push({ field: 'price_new', label: 'Prix neuf', message: `Trop élevé (max 10 000 000)`, severity: 'error' });
    } else {
      out.price_new = String(n);
    }
  }

  // --- image (URL) ------------------------------------------------------
  const imgRaw = pick(raw, ['image'], 'cover_image');
  if (imgRaw !== undefined) {
    if (typeof imgRaw !== 'string') {
      warnings.push({ field: 'image', label: 'Image principale', message: 'Doit être une URL — ignoré', severity: 'warning' });
    } else if (!isHttpUrl(imgRaw)) {
      warnings.push({ field: 'image', label: 'Image principale', message: 'URL invalide (http/https requis) — ignoré', severity: 'warning' });
    } else {
      out.image = imgRaw;
    }
  }

  // --- gallery (array of URLs) -----------------------------------------
  const gRaw = pick(raw, ['gallery']);
  if (gRaw !== undefined) {
    if (!Array.isArray(gRaw)) {
      warnings.push({ field: 'gallery', label: 'Galerie', message: 'Doit être un tableau — ignoré', severity: 'warning' });
    } else {
      const valid: string[] = [];
      gRaw.forEach((u: any, i: number) => {
        if (typeof u === 'string' && isHttpUrl(u)) valid.push(u);
        else warnings.push({ field: 'gallery', label: `Galerie [${i}]`, message: 'URL invalide — ignorée', severity: 'warning' });
      });
      out.gallery = valid;
    }
  }

  // --- norm_logo (URL, optional) ---------------------------------------
  const nlRaw = pick(raw, ['norm_logo'], 'normLogo');
  if (nlRaw !== undefined) {
    if (typeof nlRaw !== 'string') {
      warnings.push({ field: 'norm_logo', label: 'Logo norme', message: 'Doit être une URL — ignoré', severity: 'warning' });
    } else if (!isHttpUrl(nlRaw)) {
      warnings.push({ field: 'norm_logo', label: 'Logo norme', message: 'URL invalide — ignoré', severity: 'warning' });
    } else {
      out.norm_logo = nlRaw;
    }
  }

  // --- All other free-text fields --------------------------------------
  const textFields: Array<[string, string, string[], string?]> = [
    ['engine_type',      'Moteur · Type',         ['engine', 'type'],         'engine_type'],
    ['engine_cc',        'Moteur · Cylindrée',    ['engine', 'cc'],           'engine_cc'],
    ['engine_power',     'Moteur · Puissance',    ['engine', 'power'],        'engine_power'],
    ['engine_torque',    'Moteur · Couple',       ['engine', 'torque'],       'engine_torque'],
    ['fuel_system',      'Moteur · Alimentation', ['engine', 'fuelSystem'],   'fuel_system'],
    ['cooling',          'Moteur · Refroidiss.',  ['engine', 'cooling'],      'cooling'],
    ['transmission',     'Moteur · Transmission', ['engine', 'transmission'], 'transmission'],
    ['frame',            'Châssis · Cadre',       ['chassis', 'frame'],            'frame'],
    ['suspension_front', 'Châssis · Susp. avant', ['chassis', 'suspensionFront'],  'suspension_front'],
    ['travel_front',     'Châssis · Déb. avant',  ['chassis', 'travelFront'],      'travel_front'],
    ['suspension_rear',  'Châssis · Susp. arr.',  ['chassis', 'suspensionRear'],   'suspension_rear'],
    ['travel_rear',      'Châssis · Déb. arr.',   ['chassis', 'travelRear'],       'travel_rear'],
    ['brakes_front',     'Châssis · Frein avant', ['chassis', 'brakesFront'],      'brakes_front'],
    ['brakes_rear',      'Châssis · Frein arr.',  ['chassis', 'brakesRear'],       'brakes_rear'],
    ['tire_front',       'Châssis · Pneu avant',  ['chassis', 'tireFront'],        'tire_front'],
    ['tire_rear',        'Châssis · Pneu arr.',   ['chassis', 'tireRear'],         'tire_rear'],
    ['abs',              'Élec. · ABS',           ['electronics', 'abs'],          'abs'],
    ['tcs',              'Élec. · TCS',           ['electronics', 'tcs'],          'tcs'],
    ['riding_modes',     'Élec. · Modes',         ['electronics', 'ridingModes'],  'riding_modes'],
    ['quickshifter',     'Élec. · Quickshifter',  ['electronics', 'quickshifter'], 'quickshifter'],
    ['weight',           'Dim. · Poids',          ['dimensions', 'weight'],        'weight'],
    ['seat_height',      'Dim. · Hauteur selle',  ['dimensions', 'seatHeight'],    'seat_height'],
    ['tank',             'Dim. · Réservoir',      ['dimensions', 'tank'],          'tank'],
    ['length',           'Dim. · Longueur',       ['dimensions', 'length'],        'length'],
    ['wheelbase',        'Dim. · Empattement',    ['dimensions', 'wheelbase'],     'wheelbase'],
    ['consumption',      'Perf. · Consommation',  ['consumption']],
    ['top_speed',        'Perf. · Vitesse max',   ['top_speed'], 'topSpeed'],
  ];
  for (const [key, label, nested, flat] of textFields) {
    optStr(key, label, pick(raw, nested, flat), 200);
  }

  // Count only non-empty applied fields
  const appliedCount = Object.keys(out).filter((k) => {
    const v = out[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  }).length;

  return { partial: out, errors, warnings, appliedCount };
}

interface Props {
  onApply: (partial: AnyForm) => void;
}

const TechSpecsJsonImport: React.FC<Props> = ({ onApply }) => {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState<'template' | 'prompt' | null>(null);
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const [warnings, setWarnings] = useState<ImportIssue[]>([]);

  const copy = async (kind: 'template' | 'prompt') => {
    const payload = kind === 'template' ? JSON.stringify(TEMPLATE, null, 2) : PROMPT;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
      addToast(kind === 'template' ? 'Modèle JSON copié' : 'Prompt ChatGPT copié', 'success');
    } catch {
      addToast('Copie impossible', 'error');
    }
  };

  const apply = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setErrors([]); setWarnings([]);
      addToast('Collez d’abord un JSON', 'error');
      return;
    }
    // Tolerate ChatGPT wrapping the JSON in ```json fences
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e: any) {
      setErrors([{ field: '_root', label: 'Format JSON', message: e?.message || 'erreur de parsing', severity: 'error' }]);
      setWarnings([]);
      addToast('JSON invalide', 'error');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setErrors([{ field: '_root', label: 'Format JSON', message: 'Le JSON doit être un objet (pas un tableau)', severity: 'error' }]);
      setWarnings([]);
      addToast('Le JSON doit être un objet', 'error');
      return;
    }
    const result = mapJsonToForm(parsed);
    setErrors(result.errors);
    setWarnings(result.warnings);

    if (result.errors.length > 0) {
      addToast(`${result.errors.length} erreur(s) — corrigez le JSON avant import`, 'error');
      return;
    }
    if (result.appliedCount === 0) {
      addToast('Aucun champ reconnu dans ce JSON', 'error');
      return;
    }
    onApply(result.partial);
    const warnSuffix = result.warnings.length ? ` (${result.warnings.length} avertissement)` : '';
    addToast(`${result.appliedCount} champ(s) importé(s)${warnSuffix} — vérifiez puis enregistrez`, 'success');
    setText('');
    setOpen(false);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-indigo-600" />
          <span className="text-sm font-black text-indigo-900">
            Import rapide via JSON (ChatGPT)
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-indigo-700" /> : <ChevronDown size={16} className="text-indigo-700" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Copiez le prompt, demandez à ChatGPT la fiche d’un modèle, puis collez sa réponse JSON ci-dessous.
            Les champs reconnus rempliront le formulaire — vous pourrez tout vérifier avant d’enregistrer.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy('prompt')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold"
            >
              {copied === 'prompt' ? <Check size={12} /> : <ClipboardCopy size={12} />}
              Copier le prompt ChatGPT
            </button>
            <button
              type="button"
              onClick={() => copy('template')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold"
            >
              {copied === 'template' ? <Check size={12} /> : <ClipboardCopy size={12} />}
              Copier le modèle JSON vide
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Collez ici la réponse JSON de ChatGPT, ex: {"brand":"Yamaha","model":"MT-07","engine":{"cc":"689 cc",...}}'
            rows={8}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none bg-white"
          />

          {/* Field-level validation feedback ------------------------------ */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertCircle size={14} className="text-red-600" />
                <p className="text-[12px] font-black text-red-800">
                  {errors.length} erreur{errors.length > 1 ? 's' : ''} — import bloqué
                </p>
              </div>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {errors.map((e, i) => (
                  <li key={i} className="text-[11px] text-red-900 leading-snug">
                    <span className="font-bold">{e.label} :</span> {e.message}
                    <code className="ml-1 px-1 py-0.5 bg-red-100 rounded text-[10px] text-red-700">{e.field}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={14} className="text-amber-600" />
                <p className="text-[12px] font-black text-amber-800">
                  {warnings.length} avertissement{warnings.length > 1 ? 's' : ''} — valeurs ignorées ou ajustées
                </p>
              </div>
              <ul className="space-y-1 max-h-40 overflow-auto">
                {warnings.map((w, i) => (
                  <li key={i} className="text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold">{w.label} :</span> {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={apply}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              <Upload size={14} />
              Importer dans le formulaire
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechSpecsJsonImport;
