import React, { useEffect, useRef } from 'react';
import { RADIUS_OPTIONS, RadiusKm, UserCoords } from '../../hooks/useListingFilters';

interface RadiusSelectorProps {
  value: RadiusKm;
  onChange: (next: RadiusKm) => void;
  /** Visual size variant — desktop sidebar uses sm, mobile sheet uses md. */
  size?: 'sm' | 'md';
  /** When provided, a small map preview renders the user's circle. */
  userLocation?: UserCoords | null;
}

/**
 * Pill-group selector for the proximity search radius (10/25/50/100 km).
 * Only rendered when the proximity toggle is active. Keeps the user in
 * control of how wide the bounding circle is. When `userLocation` is known,
 * a small interactive-free map preview shows where the user is and how
 * wide the chosen radius reaches — much more intuitive than a number alone.
 */
export const RadiusSelector: React.FC<RadiusSelectorProps> = ({ value, onChange, size = 'sm', userLocation }) => {
  const btnBase = size === 'sm'
    ? 'flex-1 h-8 text-[12px]'
    : 'flex-1 h-10 text-[13px]';

  return (
    <div className="mt-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Rayon de recherche
        </span>
        <span className="text-[11px] font-bold text-primary-600">{value} km</span>
      </div>
      <div
        className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl"
        role="radiogroup"
        aria-label="Rayon de recherche autour de moi"
      >
        {RADIUS_OPTIONS.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt)}
              className={`${btnBase} font-bold rounded-lg transition-all ${
                active
                  ? 'bg-card text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 active:scale-95'
              }`}
            >
              {opt} km
            </button>
          );
        })}
      </div>

      {userLocation && (
        <div className="mt-3">
          <RadiusMapPreview center={userLocation} radiusKm={value} />
          <p className="text-[10px] font-semibold text-gray-400 mt-1.5 px-1">
            Aperçu : la zone bleue représente votre rayon de recherche.
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * Tiny non-interactive Leaflet map showing the user's position + radius circle.
 * Loaded lazily so it doesn't bloat the bundle when the proximity toggle stays off.
 */
const RadiusMapPreview: React.FC<{ center: UserCoords; radiusKm: number }> = ({ center, radiusKm }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;

      // Pick an initial zoom that comfortably contains the radius circle.
      const zoomFor = (km: number) => (km <= 10 ? 11 : km <= 25 ? 10 : km <= 50 ? 9 : 8);

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [center.lat, center.lng],
          zoom: zoomFor(radiusKm),
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          keyboard: false,
          attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        markerRef.current = L.circleMarker([center.lat, center.lng], {
          radius: 5,
          color: '#fff',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }).addTo(mapRef.current);
      }

      if (circleRef.current) {
        circleRef.current.remove();
      }
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusKm * 1000,
        color: '#2563eb',
        weight: 1.5,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
      }).addTo(mapRef.current);

      mapRef.current.setView([center.lat, center.lng], zoomFor(radiusKm));
      mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [8, 8] });
    })();

    return () => { cancelled = true; };
  }, [center.lat, center.lng, radiusKm]);

  useEffect(() => {
    return () => {
      try { mapRef.current?.remove?.(); } catch { /* noop */ }
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-[120px] rounded-xl overflow-hidden border border-gray-200 bg-gray-50"
      aria-label={`Aperçu du rayon de ${radiusKm} km autour de votre position`}
    />
  );
};
