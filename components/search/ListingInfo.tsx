import React from 'react';
import { Calendar, Gauge, Zap, ShieldCheck, User, MapPin, Phone, SearchCheck, Lock, Layers, Ruler, Eye, Footprints, Headphones } from 'lucide-react';

interface ListingInfoProps {
  brand: string;
  model: string;
  price: string;
  location: string;
  date?: string;
  year?: string;
  mileage?: string;
  cc?: string;
  condition: string;
  type: string;
  seller: string;
  sellerType: string;
  /** Optional avatar/logo URL — used for Pro shop logos and Particulier avatars. */
  sellerImage?: string;
  sellerPhone?: string;
  /**
   * 'phone'    → number is public, Call/WhatsApp buttons are shown.
   * 'callback' → number is hidden; cards expose a "Demander un rappel"
   *              button that deep-links into the listing detail page where
   *              the in-app callback form lives. Defaults to 'phone' when
   *              the listing pre-dates migration 023.
   */
  contactMethod?: 'phone' | 'callback';
  /**
   * Per-category metadata — used to surface accessory specifics
   * (helmet type, size, gender, …) on cards instead of a generic "Accessoire".
   */
  attributes?: Record<string, string | string[]>;
  viewMode: 'grid' | 'list';
  favorited?: boolean;
  onFavoriteToggle?: () => void;
  isLoggedIn?: boolean;
  onTriggerLogin?: () => void;
}

type Chip = { icon: React.ComponentType<any>; text: string };

/**
 * Pick accessory facts ordered by importance.
 * Order: type → main descriptor → size → gender → extras.
 */
function pickAccessoryChips(attrs?: Record<string, string | string[]>): Chip[] {
  if (!attrs) return [];
  const out: Chip[] = [];
  const push = (icon: React.ComponentType<any>, val?: string | string[]) => {
    if (!val) return;
    const text = Array.isArray(val) ? val.join(', ') : val;
    if (text) out.push({ icon, text });
  };
  push(Layers, attrs.accessoryType);
  push(ShieldCheck, attrs.helmetType);
  push(Eye, attrs.visorType);
  push(Ruler, attrs.size);
  push(Footprints, attrs.shoeSize);
  push(User, attrs.gender);
  push(Lock, attrs.antiTheftType);
  push(Headphones, attrs.intercomFeatures);
  return out;
}

/**
 * Build EXACTLY 6 info chips (3 cols × 2 rows) so every card has the same
 * footprint. Order: category-specific facts first, then location/condition/date
 * as fallbacks. Em-dash placeholders fill any remaining slot so the grid
 * never collapses to 1 line.
 */
function buildChipGrid(opts: {
  isAccessory: boolean;
  accessoryChips: Chip[];
  year?: string;
  mileage?: string;
  cc?: string;
  condition: string;
  location: string;
  date: string;
}): Chip[] {
  const { isAccessory, accessoryChips, year, mileage, cc, condition, location, date } = opts;
  const chips: Chip[] = [];

  if (isAccessory) {
    chips.push(...accessoryChips);
  } else {
    if (year) chips.push({ icon: Calendar, text: year });
    if (mileage) chips.push({ icon: Gauge, text: mileage });
    if (cc) chips.push({ icon: Zap, text: cc });
  }
  // Always-present fallbacks (only added if not already filled to 6).
  const fallbacks: Chip[] = [
    { icon: MapPin, text: location },
    { icon: SearchCheck, text: condition },
  ];
  for (const f of fallbacks) {
    if (chips.length >= 6) break;
    if (!f.text) continue;
    chips.push(f);
  }
  return chips.slice(0, 6);
}

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export const ListingInfo: React.FC<ListingInfoProps> = ({
  brand,
  model,
  price,
  location,
  date = "Récemment",
  year,
  mileage,
  cc,
  condition,
  type,
  seller,
  sellerType,
  sellerImage,
  sellerPhone,
  contactMethod = 'phone',
  attributes,
  viewMode,
  isLoggedIn = false,
  onTriggerLogin,
}) => {
  const isGrid = viewMode === 'grid';
  const isAccessory = type === 'Accessoires';
  const isPro = sellerType === 'Pro';
  const accessoryChips = isAccessory ? pickAccessoryChips(attributes) : [];

  const cleanPhone = sellerPhone?.replace(/\s/g, '') || '';
  const cleanLocation = location.split(',')[0];

  // Unified 3×2 chip grid — same shape for motos AND accessories so all
  // cards line up perfectly regardless of category.
  const chipGrid = buildChipGrid({
    isAccessory,
    accessoryChips,
    year,
    mileage,
    cc,
    condition,
    location: cleanLocation,
    date,
  });

  const ChipGrid = ({ dense = false }: { dense?: boolean }) => (
    <div className={`flex flex-wrap gap-x-3 gap-y-1.5 ${dense ? 'mb-3' : 'mb-5'}`}>
      {chipGrid.map(({ icon: I, text }, i) => (
        <div
          key={i}
          className="flex items-center gap-1 text-[12px] font-semibold text-gray-600 leading-none tracking-tight"
        >
          <I size={13} className="text-gray-400 shrink-0" strokeWidth={2.5} />
          <span className="whitespace-nowrap">{text}</span>
        </div>
      ))}
    </div>
  );

  // Privacy: for Particulier sellers, only show "Firstname .L" (first name +
  // initial of the last name). Pro shops keep their full brand name.
  const formatPrivateName = (raw: string) => {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return raw;
    if (parts.length === 1) return parts[0];
    return `${parts[0]} .${parts[parts.length - 1].charAt(0).toUpperCase()}`;
  };
  const displayName = isPro ? seller : formatPrivateName(seller);

  // Reusable avatar tile — renders the shop logo (Pro) or the personal avatar
  // (Particulier) when available, with a graceful icon fallback.
  const SellerAvatar = ({ size = 36 }: { size?: number }) => (
    <div
      className={`rounded-full bg-card flex items-center justify-center text-gray-400 border ${
        isPro ? 'border-primary-200 ring-1 ring-primary-100' : 'border-gray-100'
      } overflow-hidden shrink-0`}
      style={{ width: size, height: size }}
    >
      {sellerImage ? (
        <img src={sellerImage} alt={seller} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <User size={Math.round(size * 0.5)} />
      )}
    </div>
  );

  if (isGrid) {
    return (
      <div className="flex flex-col flex-1 w-full h-full font-sans">
        <h3 className="text-[17px] font-extrabold text-gray-900 line-clamp-1 leading-snug tracking-tight mb-1">
          {brand} {model}
        </h3>

        <p className="text-[16px] font-[900] text-primary-600 leading-none mb-6 tracking-tighter">
          {price}
        </p>

        <ChipGrid />

        <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-gray-100/80">
          <div className="flex items-center gap-3 min-w-0">
             <SellerAvatar size={36} />
             <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-extrabold text-gray-700 truncate uppercase leading-tight tracking-wider flex items-center gap-1.5">
                   {displayName}
                   {isPro && (
                     <span className="px-1.5 py-px rounded bg-primary-50 text-primary-600 text-[9px] font-black tracking-wider">PRO</span>
                   )}
                </span>
                <span className="text-[12px] font-medium text-gray-400 leading-tight mt-0.5 whitespace-nowrap">
                   {isPro ? 'Professionnel' : 'Particulier'}
                </span>
             </div>
          </div>
          
          {/* When the seller chose 'Garder privé (rappel)' on this listing,
              the phone number must NEVER appear here. We replace the
              Call/WhatsApp pair with a single CTA that opens the listing
              detail page (where the in-app callback form lives). The
              parent <a> already wraps the whole card, so this button just
              needs to NOT preventDefault — the card-level navigation
              handles the rest. */}
          <div className="flex items-center gap-3 md:gap-2 shrink-0">
            {contactMethod === 'callback' ? (
              <span
                className="h-11 px-3 inline-flex items-center gap-1.5 rounded-xl bg-primary-50 border border-primary-600 text-primary-700 text-[11px] font-black uppercase tracking-wider shadow-sm"
                title="Le vendeur préfère être contacté via un rappel — ouvrez l'annonce pour faire la demande."
              >
                <Phone size={14} fill="currentColor" /> Rappel
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`https://wa.me/${cleanPhone}`, '_blank', 'noopener,noreferrer');
                  }}
                  aria-label={`Contacter ${seller} sur WhatsApp`}
                  className="w-14 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-brand-whatsapp-bg border border-brand-whatsapp text-brand-whatsapp transition-all hover:bg-brand-whatsapp-bg-hover active:scale-95 shadow-sm"
                >
                  <WhatsAppIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `tel:${cleanPhone}`;
                  }}
                  aria-label={`Appeler ${seller}`}
                  className="w-14 h-11 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-primary-50 border border-primary-600 text-primary-600 transition-all duration-300 hover:bg-primary-100 active:scale-95 shadow-sm"
                >
                  <Phone size={16} fill="currentColor" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow min-w-0 md:p-3 lg:p-5 gap-4 font-sans">
      <div className="md:hidden space-y-1">
        <h3 className="text-xl font-extrabold text-gray-900 leading-snug tracking-tight line-clamp-1">
          {brand} {model}
        </h3>
        <span className="font-black text-primary-600 tracking-tighter leading-none text-xl block mb-4">
          {price}
        </span>
      </div>

      <div className="hidden md:flex flex-col gap-1.5">
        <h3 className="text-[22px] font-extrabold text-gray-900 leading-tight tracking-tighter">
          {brand} {model}
        </h3>

        <div className="flex items-center gap-3 text-[12px] font-semibold text-gray-400">
          <div className="flex items-center gap-1">
            <MapPin size={13} strokeWidth={2.5} />
            <span>{cleanLocation}</span>
          </div>
        </div>
      </div>

      {/* Unified 3×2 chip grid for both desktop and mobile (list mode) */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 my-1">
        {chipGrid.map(({ icon: I, text }, i) => (
          <div
            key={i}
            className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 rounded-md border border-gray-100/50 text-[12px] font-semibold text-gray-600 leading-none tracking-tight"
          >
            <I size={13} className="text-gray-400 shrink-0" strokeWidth={2.5} />
            <span className="whitespace-nowrap">{text}</span>
          </div>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-3 mt-auto pt-3 border-t border-gray-50">
        <SellerAvatar size={36} />
        <div className="flex flex-col min-w-0">
          <span className="text-[12px] font-extrabold text-gray-700 truncate uppercase leading-tight tracking-wider flex items-center gap-1.5">
            {displayName}
            {isPro && (
              <span className="px-1.5 py-px rounded bg-primary-50 text-primary-600 text-[9px] font-black tracking-wider">PRO</span>
            )}
          </span>
          <span className="text-[12px] font-medium text-gray-400 leading-tight mt-0.5 whitespace-nowrap">
            {isPro ? 'Professionnel' : 'Particulier'}
          </span>
        </div>
      </div>
    </div>
  );
};
