import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, Package, ChevronRight, X } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { AdminTable } from './AdminPrimitives';

// Distinct, accessible palette (HSL) for the top-10 brands. Picked to read
// well in light & dark mode and to be distinguishable for color-vision
// deficient users (no adjacent red/green pairs).
const PALETTE = [
  'hsl(22 100% 50%)', 'hsl(210 90% 55%)', 'hsl(160 70% 42%)',
  'hsl(280 65% 58%)', 'hsl(45 95% 50%)',  'hsl(340 80% 58%)',
  'hsl(190 75% 45%)', 'hsl(15 80% 55%)',  'hsl(260 60% 60%)',
  'hsl(120 50% 45%)',
];

type Trends = {
  days: number;
  top: { brand: string; visits: number }[];
  series: Array<Record<string, string | number>>;
  all: { brand: string; visits: number }[];
};

export const BrandTrendsPanel: React.FC = () => {
  const [days] = useState(30);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery<Trends>({
    queryKey: ['admin', 'brand-trends', days],
    queryFn: ({ signal }) => adminApi.getBrandTrends(days, signal),
    staleTime: 60_000,
  });

  const modelsQuery = useQuery({
    queryKey: ['admin', 'brand-models', selectedBrand],
    queryFn: ({ signal }) => adminApi.getBrandModelsBreakdown(selectedBrand!, signal),
    enabled: !!selectedBrand,
    staleTime: 60_000,
  });

  const brandColors = useMemo(() => {
    const map: Record<string, string> = {};
    (data?.top || []).forEach((t, i) => { map[t.brand] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [data?.top]);

  // Compute max daily total across the window for y-axis scaling.
  const { maxDayTotal, totalVisits } = useMemo(() => {
    let max = 0; let total = 0;
    for (const row of data?.series || []) {
      let dayTotal = 0;
      for (const b of data?.top || []) dayTotal += Number(row[b.brand] || 0);
      total += dayTotal;
      if (dayTotal > max) max = dayTotal;
    }
    return { maxDayTotal: max, totalVisits: total };
  }, [data]);

  const series = data?.series || [];
  const topBrands = data?.top || [];

  return (
    <section className="bg-card rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div />
        <div className="text-right">
          <div className="text-2xl font-black text-gray-900">{totalVisits.toLocaleString('fr-FR')}</div>
          <div className="text-xs text-gray-500 font-semibold">visites totales</div>
        </div>
      </header>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          Impossible de charger les tendances. Le backend a-t-il été redéployé&nbsp;?
        </div>
      )}

      {isLoading ? (
        <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
      ) : series.length === 0 || topBrands.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-gray-400 gap-2 bg-gray-50 rounded-lg">
          <BarChart3 size={32} />
          <p className="text-sm font-semibold">Pas encore de données de visite</p>
          <p className="text-xs">Les chiffres apparaîtront dès que des utilisateurs visiteront des fiches marques.</p>
        </div>
      ) : (
        <>
          {/* Stacked bar chart — pure SVG, responsive via viewBox */}
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(series.length * 22, 600)} 240`}
              className="w-full h-64 min-w-[600px]"
              role="img"
              aria-label={`Visites par marque sur ${days} jours`}
            >
              {/* Y-axis grid lines (4 levels) */}
              {[0.25, 0.5, 0.75, 1].map((p) => (
                <g key={p}>
                  <line
                    x1={36} x2={Math.max(series.length * 22, 600) - 8}
                    y1={210 - 180 * p} y2={210 - 180 * p}
                    stroke="hsl(var(--border))" strokeDasharray="2 3"
                  />
                  <text x={32} y={214 - 180 * p} textAnchor="end"
                    className="fill-gray-400" fontSize="10">
                    {Math.round(maxDayTotal * p).toLocaleString('fr-FR')}
                  </text>
                </g>
              ))}

              {/* Stacked bars */}
              {series.map((row, i) => {
                const x = 40 + i * 22;
                let yCursor = 210;
                const barWidth = 16;
                return (
                  <g key={String(row.day)}>
                    {topBrands.map((b) => {
                      const v = Number(row[b.brand] || 0);
                      if (v === 0 || maxDayTotal === 0) return null;
                      const h = (v / maxDayTotal) * 180;
                      yCursor -= h;
                      return (
                        <rect
                          key={b.brand}
                          x={x} y={yCursor} width={barWidth} height={h}
                          fill={brandColors[b.brand]} rx={1}
                        >
                          <title>{`${b.brand} • ${(() => { const p = String(row.day).split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : row.day; })()}: ${v} visites`}</title>
                        </rect>
                      );
                    })}
                    {/* X-axis label every ~5 days */}
                    {(i % Math.ceil(series.length / 8) === 0 || i === series.length - 1) && (
                      <text
                        x={x + barWidth / 2} y={226}
                        textAnchor="middle" className="fill-gray-500" fontSize="9"
                      >
                        {(() => {
                          // Format YYYY-MM-DD → DD/MM (French short date)
                          const s = String(row.day);
                          const parts = s.split('-');
                          return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : s.slice(5);
                        })()}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {topBrands.map((b) => (
              <span
                key={b.brand}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: brandColors[b.brand] }}
                />
                {b.brand}
                <span className="text-gray-400">· {b.visits}</span>
              </span>
            ))}
          </div>
        </>
      )}

      {/* Full table of every brand with visits in the window */}
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-2">
          Toutes les marques visitées
          <span className="ml-2 text-xs font-medium text-gray-400">— cliquez sur une marque pour voir ses modèles</span>
        </h4>
        <AdminTable
          columns={['#', 'Marque', 'Visites', 'Part', '']}
          loading={isLoading}
          rowCount={data?.all?.length || 0}
          empty="Aucune visite enregistrée."
        >
          {(data?.all || []).map((b, i) => {
            const pct = totalVisits > 0 ? (b.visits / totalVisits) * 100 : 0;
            const isSelected = selectedBrand === b.brand;
            return (
              <tr
                key={b.brand}
                onClick={() => setSelectedBrand(isSelected ? null : b.brand)}
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
              >
                <td className="p-3 text-xs text-gray-500 font-bold w-12">{i + 1}</td>
                <td className="p-3 text-sm text-gray-900 font-semibold">{b.brand}</td>
                <td className="p-3 text-sm text-gray-700 tabular-nums">{b.visits.toLocaleString('fr-FR')}</td>
                <td className="p-3 text-sm text-gray-500 w-48">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs">{pct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="p-3 w-8 text-gray-400">
                  <ChevronRight size={16} className={`transition-transform ${isSelected ? 'rotate-90 text-primary-600' : ''}`} />
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </div>

      {/* Drill-down: models breakdown for the selected brand */}
      {selectedBrand && (
        <div className="border-t border-gray-100 pt-5">
          <header className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h4 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Package size={16} className="text-primary-600" />
                Modèles de <span className="text-primary-700">{selectedBrand}</span>
              </h4>
              <p className="text-xs text-gray-500 font-semibold mt-0.5">
                Visites des fiches techniques par les utilisateurs (catalogue)
              </p>
            </div>
            <div className="flex items-center gap-3">
              {modelsQuery.data && (
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-lg font-black text-gray-900 tabular-nums">
                      {modelsQuery.data.total_visits.toLocaleString('fr-FR')}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase">Visites</div>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedBrand(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <AdminTable
            columns={['#', 'Modèle', 'Visites', 'Part']}
            loading={modelsQuery.isLoading}
            rowCount={modelsQuery.data?.models?.length || 0}
            empty="Aucune visite enregistrée pour cette marque."
          >
            {(modelsQuery.data?.models || []).map((m, i) => {
              const totalV = modelsQuery.data?.total_visits || 0;
              const pct = totalV > 0 ? (m.visits / totalV) * 100 : 0;
              return (
                <tr key={m.model} className="hover:bg-gray-50">
                  <td className="p-3 text-xs text-gray-500 font-bold w-12">{i + 1}</td>
                  <td className="p-3 text-sm text-gray-900 font-semibold">{m.model}</td>
                  <td className="p-3 text-sm text-gray-700 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Eye size={12} className="text-primary-500" />
                      {m.visits.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-500 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </div>
      )}
    </section>
  );
};

export default BrandTrendsPanel;
