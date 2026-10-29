/**
 * Static reference data used across the app for dropdowns, filters and labels.
 *
 * These are intentionally static — they describe the shape of the Tunisian
 * moto/scooter market (governorates, brands, accessory types, etc.) and do
 * not need to be fetched from the backend. The backend exposes equivalent
 * endpoints under /api/reference/* if you ever want to switch to dynamic.
 */

export const tunisianCities = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Sousse',
  'Monastir', 'Sfax', 'Bizerte', 'Gabès', 'Djerba',
] as const;

/** All 24 Tunisian governorates (official list). */
export const governoratesList = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa',
  'Jendouba', 'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia',
  'Manouba', 'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid',
  'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;

export const brandsMoto = [
  'Peugeot Motorcycles', 'Piaggio', 'Voge', 'Aprilia', 'Ki-Motors', 'SYM',
  'SLC', 'Dayun Motorcycle', 'Uniscoot', 'Kymco', 'QJMotor', 'SMT',
  'Phantom', 'First Motos', 'Suzuki', 'Senke', 'BBM', 'Zimota',
  'Zontes', 'CForce', 'LM', 'Novago', 'Lifan', 'Sanya',
  'GSM Gouiaa', 'CFMoto', 'FTM', 'Haojin', 'AA Tunisie', 'E-Rider',
  'Yadea', 'WattGo', 'Letbe', 'Ecoride', 'Vigo', 'Gold Motors',
  'XTF', 'Nlvneng', 'Motolux', 'Mistral', 'Luolf Moto', 'City Bike',
  'Rap Sev', 'Keren', 'Autre',
];

export const techSpecsBrands = [
  'Peugeot Motorcycles', 'Piaggio', 'Voge', 'Aprilia', 'Ki-Motors', 'SYM',
  'SLC', 'Dayun Motorcycle', 'Uniscoot', 'Kymco', 'QJMotor', 'SMT',
  'Phantom', 'First Motos', 'Suzuki', 'Senke', 'BBM', 'Zimota',
  'Zontes', 'CForce', 'LM', 'Novago', 'Lifan', 'Sanya',
  'GSM Gouiaa', 'CFMoto', 'FTM', 'Haojin', 'AA Tunisie', 'E-Rider',
  'Yadea', 'WattGo', 'Letbe', 'Ecoride', 'Vigo', 'Gold Motors',
  'XTF', 'Nlvneng', 'Motolux', 'Mistral', 'Luolf Moto', 'City Bike',
  'Rap Sev', 'Keren', 'Teyin', 'PISTA HR+', 'Ghost', 'Blaster',
];

export const brandLogos: Record<string, string> = {
  'Zontes': 'https://www.moto-scoot.tn/brand-logos/Zontes.webp',
  'Voge': 'https://www.moto-scoot.tn/brand-logos/voge.svg',
  'SYM': 'https://www.moto-scoot.tn/brand-logos/sym.svg',
  'Peugeot Motorcycles': 'https://www.moto-scoot.tn/brand-logos/peugeot.svg',
  'Piaggio': 'https://www.moto-scoot.tn/brand-logos/piagio.svg',
  'Suzuki': 'https://www.moto-scoot.tn/brand-logos/Suzuki.svg',
  'Kymco': 'https://www.moto-scoot.tn/brand-logos/kymco.svg',
  'CFMoto': 'https://www.moto-scoot.tn/brand-logos/cfmoto.svg',
};

/** Common models — used as a generic fallback list when a brand is not selected. */
export const commonModels = [
  'MT-07', 'MT-09', 'TMAX 560', 'X-ADV 750', 'Forza 750', 'R 1300 GS', 'S 1000 RR',
  'Duke 390', 'Z900', 'Monster 937', 'Vespa GTS 300', 'XP400', 'Maxsym TL 508', '350E',
];

export const modelsByBrand: Record<string, string[]> = {
  'SYM': [
    'Maxsym TL 508', 'Cruisym Alpha 300', 'ADX 125',
    'NHX 125', 'JET X 125', 'Husky ADX 300CC', 'Orbit II', 'FIDDLE 4',
    'FIDDLE II EFI', 'JET 4 RX 125', 'SYMPHONY ST 200', 'JET 14 125',
    'SYMPHONY ST 125', 'SYMPHONY S 125', 'SYMPHONY SR 125',
  ],
  'Piaggio': ['Vespa GTS 300', 'Vespa Primavera', 'Beverly 400', 'Liberty 125'],
  'Peugeot Motorcycles': ['XP400', 'Django 125', 'Kisbee 50', 'Tweet 125'],
  'Zontes': ['350E', '350D', 'ZT 310-T', '368G'],
  'Voge': ['SR ADV', 'SR16', 'SR4 Max', 'DS800X Rally', 'DS 525X', 'SR3'],
  'CFMoto': ['450SR', 'NK 800', 'MT 450', 'CL-X 700'],
  'Autre': [],
};

export const conditions = [
  'Neuf', 'État neuf', 'Excellent', 'Très bon', 'Bon', 'Correct', 'À réparer', 'Pour pièces',
];

export const accessoryTypes = [
  'Casques', 'Gants', 'Vestes', 'Pantalons', 'Bottes', 'Protections',
  'Antivols', 'Bagagerie', 'Électronique', 'Entretien', 'Pièces détachées', 'Autre',
];
