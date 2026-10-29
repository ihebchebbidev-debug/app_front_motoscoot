import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair, Search, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Reusable map picker built on Leaflet + OpenStreetMap tiles.
 *
 * Usage:
 *   <MapPicker
 *     value={{ lat: 36.8, lng: 10.18 }}
 *     onChange={(coords, address) => { ... }}
 *   />
 *
 * - Click anywhere on the map to drop / move the pin.
 * - Drag the pin for fine adjustment.
 * - "Ma position" button uses the browser geolocation API.
 * - Search box queries Nominatim (OSM) for an address → coords.
 * - Whenever the pin moves we call `onChange(coords, address?)` where
 *   `address` is the reverse-geocoded street address (best-effort,
 *   non-blocking — we still emit the new coords immediately).
 *
 * Default center is Tunis, Tunisia.
 */

export interface LatLng { lat: number; lng: number }

interface Props {
  value?: LatLng | null;
  onChange: (coords: LatLng, address?: string) => void;
  className?: string;
  /** Initial address shown in the search box. */
  defaultAddressQuery?: string;
}

const TUNIS_CENTER: LatLng = { lat: 36.8065, lng: 10.1815 };

/* -------------------------------------------------------------------------- */
/* Leaflet default-icon shim                                                  */
/* -------------------------------------------------------------------------- */
// react-leaflet ships with a default marker that breaks under Vite because
// the icon URLs reference assets via require(). We rebuild a pure CDN icon
// once, at module load, so every Marker instance picks it up automatically.
// Using the official OSM-hosted PNGs avoids any local-asset bundling issue.
const DEFAULT_ICON = new L.Icon({
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41],
  iconAnchor:  [12, 41],
  popupAnchor: [1, -34],
  shadowSize:  [41, 41],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(L.Marker.prototype as any).options.icon = DEFAULT_ICON;

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function ClickHandler({ onClick }: { onClick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) { onClick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

/** Pan/zoom the map to a new center whenever `target` changes. */
function Recenter({ target, zoom }: { target: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], zoom ?? Math.max(map.getZoom(), 14), {
      duration: 0.6,
    });
  }, [target?.lat, target?.lng, zoom, map, target]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Reverse-geocoding helpers (OpenStreetMap Nominatim)                        */
/* -------------------------------------------------------------------------- */

async function reverseGeocode(c: LatLng, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lng}&accept-language=fr`;
    const r = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
    if (!r.ok) return undefined;
    const data = await r.json();
    return (data?.display_name as string) || undefined;
  } catch { return undefined; }
}

async function forwardGeocode(query: string, signal?: AbortSignal): Promise<{ coords: LatLng; address: string } | null> {
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&accept-language=fr&countrycodes=tn`;
    const r = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const data = await r.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;
    return {
      coords: { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) },
      address: hit.display_name as string,
    };
  } catch { return null; }
}

interface GeoSuggestion { coords: LatLng; address: string }
async function searchSuggestions(query: string, signal?: AbortSignal): Promise<GeoSuggestion[]> {
  if (!query.trim() || query.trim().length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&accept-language=fr&countrycodes=tn&addressdetails=1`;
    const r = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    return data.map((hit: any) => ({
      coords: { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) },
      address: hit.display_name as string,
    }));
  } catch { return []; }
}

/* -------------------------------------------------------------------------- */
/* Public component                                                           */
/* -------------------------------------------------------------------------- */

export const MapPicker: React.FC<Props> = ({ value, onChange, className, defaultAddressQuery }) => {
  const initial = value || TUNIS_CENTER;
  const [pin, setPin] = useState<LatLng>(initial);
  const [searchQuery, setSearchQuery] = useState(defaultAddressQuery || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // Resolved address shown back to the user as a confirmation receipt.
  // We surface success ("✓ Adresse détectée…") AND failures ("Coordonnées
  // enregistrées sans adresse — vérifiez la position du repère.") so the
  // user is never left guessing whether geocoding worked.
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(defaultAddressQuery || null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'resolving' | 'ok' | 'failed'>('idle');
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  // Sync inbound changes (e.g. parent reset the form) into the pin position.
  useEffect(() => {
    if (value && (value.lat !== pin.lat || value.lng !== pin.lng)) {
      setPin(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  // Debounced live suggestions as the user types — no need to click "Rechercher".
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    // Skip fetching if the input matches a previously-resolved address.
    if (q === resolvedAddress) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const results = await searchSuggestions(q, ctrl.signal);
      setSuggestions(results);
      setShowSuggestions(true);
      setHighlightIdx(-1);
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [searchQuery, resolvedAddress]);

  const pickSuggestion = (s: GeoSuggestion) => {
    setPin(s.coords);
    setSearchQuery(s.address);
    setResolvedAddress(s.address);
    setGeoStatus('ok');
    setShowSuggestions(false);
    setSuggestions([]);
    onChange(s.coords, s.address);
  };

  /** Move the pin and notify the parent. Reverse-geocoding runs in the
   *  background so we don't block the UI on a remote request. */
  const updatePin = (coords: LatLng) => {
    setPin(coords);
    onChange(coords); // emit coords immediately
    setGeoStatus('resolving');
    reverseGeocode(coords).then((addr) => {
      if (addr) {
        setResolvedAddress(addr);
        setGeoStatus('ok');
        onChange(coords, addr);
      } else {
        setGeoStatus('failed');
      }
    });
  };

  const handleLocate = () => {
    if (!('geolocation' in navigator)) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        updatePin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setGeoStatus('resolving');
    const hit = await forwardGeocode(searchQuery);
    setIsSearching(false);
    if (hit) {
      setPin(hit.coords);
      setResolvedAddress(hit.address);
      setGeoStatus('ok');
      onChange(hit.coords, hit.address);
    } else {
      setGeoStatus('failed');
    }
  };

  const tileUrl = useMemo(
    () => 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    [],
  );

  return (
    <div className={`flex flex-col gap-3 ${className || ''}`}>
      {/* Toolbar — only "Ma position" remains. The address search box was
          removed: users locate themselves via geolocation or by clicking /
          dragging the pin on the map. The reverse-geocoded address is still
          shown below the map as confirmation. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleLocate}
          disabled={isLocating}
          className="px-4 h-11 rounded-xl border border-border bg-card text-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-muted transition flex items-center justify-center gap-2"
          title="Utiliser ma position actuelle"
        >
          {isLocating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
          Ma position
        </button>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 320 }}>
        <MapContainer
          center={[pin.lat, pin.lng]}
          zoom={13}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={tileUrl}
          />
          <Marker
            position={[pin.lat, pin.lng]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                updatePin({ lat: ll.lat, lng: ll.lng });
              },
            }}
          />
          <ClickHandler onClick={updatePin} />
          <Recenter target={pin} />
        </MapContainer>
      </div>

      {/* Address confirmation — explicit success/failure feedback so the user
          knows whether geocoding actually resolved the chosen pin. */}
      <div className="space-y-1.5">
        {geoStatus === 'ok' && resolvedAddress && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[12px] font-semibold text-emerald-800">
            <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <span className="leading-snug">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-700/70 mb-0.5">Adresse détectée</span>
              {resolvedAddress}
            </span>
          </div>
        )}
        {geoStatus === 'failed' && (
          <div className="flex flex-col gap-2 px-3 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="leading-snug">
                <span className="block text-[10px] font-black uppercase tracking-widest text-amber-700/80 mb-0.5">
                  Adresse introuvable
                </span>
                Nous n'avons pas pu retrouver d'adresse précise pour ce point.
                Vous pouvez conserver les coordonnées telles quelles, ou saisir
                l'adresse manuellement dans le champ ci-dessus.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              <button
                type="button"
                onClick={() => {
                  const coordsLabel = `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`;
                  setResolvedAddress(coordsLabel);
                  setGeoStatus('ok');
                  onChange(pin, coordsLabel);
                }}
                className="px-3 h-8 rounded-lg bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider hover:bg-amber-700 transition flex items-center gap-1.5"
              >
                <Crosshair size={12} /> Utiliser mes coordonnées
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeoStatus('idle');
                  const el = document.querySelector<HTMLInputElement>(
                    'input[name="address"]',
                  );
                  if (el) {
                    el.focus();
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="px-3 h-8 rounded-lg border border-amber-300 bg-white text-amber-800 text-[11px] font-black uppercase tracking-wider hover:bg-amber-100 transition flex items-center gap-1.5"
              >
                <Search size={12} /> Modifier l'adresse
              </button>
            </div>
          </div>
        )}
        {geoStatus === 'resolving' && (
          <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Recherche de l'adresse…
          </div>
        )}

        {/* Coordinates readout always visible as a verification line */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          <MapPin size={14} className="text-primary" />
          <span>{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
          <span className="text-muted-foreground/60 normal-case font-medium">
            — cliquez sur la carte ou faites glisser le repère
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
