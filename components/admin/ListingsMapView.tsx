import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MapPin, MapPinOff, Pencil, X } from 'lucide-react';
import { AdminListing } from '../../services/adminApi';

/**
 * Read-only map view for the admin Listings tab.
 *
 * Uses leaflet.markercluster directly (instead of react-leaflet-cluster which
 * peers on React 18) so we stay compatible with React 19. Markers are added
 * imperatively to a single L.markerClusterGroup; clusters auto-zoom to their
 * bounds on click and spiderfy at max zoom.
 */

// Leaflet default-icon shim — same as MapPicker (Vite + bundler safe).
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

const STATUS_COLOR: Record<string, string> = {
  active:   '#16a34a',
  pending:  '#d97706',
  rejected: '#dc2626',
  sold:     '#6b7280',
  expired:  '#6b7280',
};

const coloredIcon = (color: string) =>
  L.divIcon({
    className: 'admin-listing-pin',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -18],
  });

/**
 * Cluster icon factory — count + status-colored ring, with hover tooltip
 * showing per-status breakdown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildClusterIcon = (cluster: any) => {
  const children = cluster.getAllChildMarkers() as any[];
  const count = cluster.getChildCount() as number;
  const tally: Record<string, number> = {};
  for (const m of children) {
    const s = (m.options && m.options.listingStatus) || 'pending';
    tally[s] = (tally[s] || 0) + 1;
  }
  const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'pending';
  const ringColor = STATUS_COLOR[dominant] || STATUS_COLOR.pending;
  const size = count < 10 ? 36 : count < 50 ? 44 : count < 200 ? 50 : 56;
  const breakdown = Object.entries(tally).map(([s, n]) => `${s}: ${n}`).join(' · ');
  return L.divIcon({
    className: 'admin-listing-cluster',
    html: `
      <div title="${count} annonces (${breakdown}) — cliquez pour zoomer"
           style="width:${size}px;height:${size}px;border-radius:9999px;
                  background:rgba(255,255,255,0.95);
                  border:3px solid ${ringColor};
                  box-shadow:0 4px 12px rgba(0,0,0,0.25);
                  display:flex;align-items:center;justify-content:center;
                  font-weight:800;font-family:ui-sans-serif,system-ui;
                  color:#111827;font-size:${count < 100 ? 14 : 12}px;
                  line-height:1;cursor:pointer;">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/* -------------------------------------------------------------------------- */
/* Cluster layer (imperative — built directly on leaflet.markercluster)       */
/* -------------------------------------------------------------------------- */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const buildPopupHtml = (l: AdminListing, color: string, withPreview: boolean) => {
  const img = l.images?.[0]
    ? `<img src="${escapeHtml(l.images[0])}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:6px;margin-bottom:6px" />`
    : '';
  const loc = l.address || `${l.city || ''}${l.governorate ? ', ' + l.governorate : ''}` || '—';
  return `
    <div style="min-width:200px;font-family:ui-sans-serif,system-ui;line-height:1.35">
      ${img}
      <p style="font-weight:700;font-size:13px;color:#111827;margin:0 0 2px">${escapeHtml(l.title)}</p>
      <p style="font-size:11px;color:#4b5563;margin:0 0 2px">${escapeHtml(`${l.brand || ''} ${l.model || ''}`.trim())}</p>
      <p style="font-size:11px;color:#374151;font-weight:700;margin:0 0 2px">${Number(l.price).toLocaleString('fr-FR')} TND</p>
      <p style="font-size:10px;color:#6b7280;margin:0 0 2px">${escapeHtml(loc)}</p>
      <p style="font-size:10px;color:#6b7280;margin:0 0 6px">Vendeur : ${escapeHtml(l.seller_name || l.seller_email || '—')}</p>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;background:${color}">${escapeHtml(l.status)}</span>
        ${withPreview ? `<button data-listing-preview="${escapeHtml(String(l.id))}" style="font-size:11px;font-weight:700;color:#ea580c;background:none;border:none;cursor:pointer">Aperçu →</button>` : ''}
      </div>
    </div>`;
};

interface ClusterLayerProps {
  listings: AdminListing[];
  onPreview?: (id: string) => void;
}

const ClusterLayer: React.FC<ClusterLayerProps> = ({ listings, onPreview }) => {
  const map = useMap();
  // `L.MarkerClusterGroup` isn't part of the base @types/leaflet typings —
  // it's added by the `leaflet.markercluster` plugin which we load at runtime
  // via `(L as any).markerClusterGroup(...)`. Keep the ref loosely typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupRef = useRef<any>(null);
  // Stable ref so the popup-button delegated click handler always sees the
  // latest onPreview without re-binding the listener.
  const onPreviewRef = useRef(onPreview);
  useEffect(() => { onPreviewRef.current = onPreview; }, [onPreview]);

  // Create the cluster group once.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const group = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      showCoverageOnHover: false,
      iconCreateFunction: buildClusterIcon,
    });
    groupRef.current = group;
    map.addLayer(group);

    // Delegated click for "Aperçu →" buttons inside popup HTML.
    const onMapClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('[data-listing-preview]') as HTMLElement | null;
      if (btn) {
        const id = btn.getAttribute('data-listing-preview');
        if (id && onPreviewRef.current) onPreviewRef.current(id);
      }
    };
    map.getContainer().addEventListener('click', onMapClick);

    return () => {
      map.getContainer().removeEventListener('click', onMapClick);
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  // Sync markers whenever the listings list changes.
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    const markers: L.Marker[] = [];
    for (const l of listings) {
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const color = STATUS_COLOR[l.status] || STATUS_COLOR.pending;
      const m = L.marker([lat, lng], {
        icon: coloredIcon(color),
        // Custom option read by buildClusterIcon for status tally.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ listingStatus: l.status } as any),
      });
      m.bindPopup(buildPopupHtml(l, color, !!onPreviewRef.current), { maxWidth: 260 });
      markers.push(m);
    }
    group.addLayers(markers);
  }, [listings]);

  return null;
};

/* -------------------------------------------------------------------------- */
/* Public component                                                           */
/* -------------------------------------------------------------------------- */

interface Props {
  listings: AdminListing[];
  onPreview?: (id: string) => void;
}

const TUNIS_CENTER: [number, number] = [34.0, 9.5];

export const ListingsMapView: React.FC<Props> = ({ listings, onPreview }) => {
  const [showNoGpsModal, setShowNoGpsModal] = useState(false);

  const { withCoords, withoutCoords } = useMemo(() => {
    const w: AdminListing[] = [];
    const wo: AdminListing[] = [];
    for (const l of listings) {
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
        w.push(l);
      } else {
        wo.push(l);
      }
    }
    return { withCoords: w, withoutCoords: wo };
  }, [listings]);

  const center: [number, number] = withCoords.length
    ? [Number(withCoords[0].latitude), Number(withCoords[0].longitude)]
    : TUNIS_CENTER;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR.active }} /> Active</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR.pending }} /> En attente</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR.rejected }} /> Rejetée</span>

        <button
          type="button"
          onClick={() => setShowNoGpsModal(true)}
          disabled={withoutCoords.length === 0}
          className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition ${
            withoutCoords.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
          }`}
          title="Voir toutes les annonces sans coordonnées GPS"
        >
          <MapPinOff size={14} />
          Sans GPS ({withoutCoords.length})
        </button>
        <span className="text-gray-500 font-medium">
          {withCoords.length}/{listings.length} géolocalisées
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 520 }}>
        <MapContainer
          center={center}
          zoom={withCoords.length ? 11 : 7}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClusterLayer listings={withCoords} onPreview={onPreview} />
        </MapContainer>
      </div>

      {withoutCoords.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-center gap-2">
          <MapPin size={14} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-900 flex-1">
            <strong>{withoutCoords.length}</strong> annonce{withoutCoords.length > 1 ? 's' : ''} sans GPS ne sont pas visibles sur la carte.
          </p>
          <button
            onClick={() => setShowNoGpsModal(true)}
            className="text-xs font-bold text-amber-800 hover:underline flex-shrink-0"
          >
            Voir la liste →
          </button>
        </div>
      )}

      {showNoGpsModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setShowNoGpsModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <MapPinOff size={18} className="text-amber-600" />
                <h3 className="text-base font-extrabold text-gray-900">
                  Annonces sans coordonnées GPS ({withoutCoords.length})
                </h3>
              </div>
              <button
                onClick={() => setShowNoGpsModal(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs text-amber-900">
                Ces annonces n'apparaissent pas sur la carte. Cliquez sur <strong>Modifier</strong> pour
                ouvrir l'annonce et ajouter une adresse ou un point GPS.
              </p>
            </div>

            <ul className="flex-1 overflow-auto divide-y divide-gray-100">
              {withoutCoords.map((l) => (
                <li key={l.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  {l.images?.[0] ? (
                    <img src={l.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{l.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[l.brand, l.model].filter(Boolean).join(' ') || '—'} ·{' '}
                      <span className="text-amber-700 font-semibold">
                        {l.city || l.governorate || 'Aucune ville'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {l.seller_name || l.seller_email || '—'}
                    </p>
                  </div>
                  {onPreview && (
                    <button
                      onClick={() => {
                        onPreview(l.id);
                        setShowNoGpsModal(false);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 flex-shrink-0"
                    >
                      <Pencil size={12} />
                      Modifier
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowNoGpsModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingsMapView;
