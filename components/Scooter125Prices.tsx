import React, { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Layers, Plus, Tag } from 'lucide-react';
import { useCatalogTechSpecs } from '../hooks/useTechSpecs';
import { Section } from './ui/Section';
import { Skeleton } from './ui/Skeleton';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { TechSpecModelCard } from './tech-specs/TechSpecModelCard';
import { ModelCardSkeleton } from './tech-specs/TechSpecsSkeletons';
import { TechSpecsErrorRetry } from './tech-specs/TechSpecsErrorRetry';
import SEO from './common/SEO';
import { BasePageProps, TechSpec } from '../types';
import { getUrlFromState } from '../utils/urlUtils';
import {
  SCOOTER_125_BREADCRUMB, SCOOTER_125_PATH, Scooter125Row, fmtCh, fmtDt, fmtKg,
  scooter125Advice, scooter125Bands, scooter125Description, scooter125Faq, scooter125Heading,
  scooter125Intro, scooter125Method, scooter125Rows, scooter125Stats, scooter125Title,
} from '../utils/scooter125Guide';

const SITE = 'https://www.moto-scoot.tn';

const S = {
  Wrapper: "min-h-screen bg-[#F8F9F9] md:bg-muted font-sans",
  // Same card, header and table rows as the fiche spec sheet (TechSpecsDetails).
  ContentBlock: "bg-card rounded-2xl border border-border overflow-hidden shadow-sm",
  BlockHeader: "px-6 md:px-8 py-4 border-b border-border",
  BlockTitle: "font-sans text-[15px] font-extrabold uppercase tracking-[0.06em] text-foreground",
  SectionTitle: "text-xl md:text-2xl font-[900] text-slate-900 tracking-tight",
  Lead: "max-w-3xl text-[15px] md:text-[17px] font-medium text-gray-600 leading-relaxed",
  Text: "text-[14px] md:text-[15px] text-gray-600 leading-relaxed",
  Th: "px-4 first:pl-6 md:first:pl-8 last:pr-6 md:last:pr-8 py-3 text-left font-sans text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap",
  Td: "px-4 first:pl-6 md:first:pl-8 last:pr-6 md:last:pr-8 py-3 md:py-4 align-middle font-sans text-[14px] text-foreground whitespace-nowrap",
  // Model column stays visible while the table scrolls sideways on phones.
  Sticky: "sticky left-0 z-10 bg-card",
  Grid: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-5",
  PrimaryBtn: "inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 text-white text-[13px] font-bold rounded-xl hover:bg-primary-700 transition-all duration-300 shadow-md shadow-primary-600/20 active:scale-[0.98]",
  SecondaryBtn: "inline-flex items-center justify-center gap-2 px-5 py-3 bg-card border border-gray-200 text-gray-700 text-[13px] font-bold rounded-xl hover:border-primary-200 hover:text-primary-600 transition-all duration-300 active:scale-[0.98]",
  Chip: "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-gray-100 text-[13px] font-bold text-gray-700 hover:border-primary-200 hover:text-primary-600 transition-colors",
};

const toSource = (spec: TechSpec) => ({
  id: spec.id,
  slug: spec.slug,
  brand: spec.brand,
  model: spec.model,
  year: spec.year,
  category: spec.categoryLabel || spec.category,
  price: spec.priceNew,
  cc: spec.engine?.cc,
  power: spec.engine?.power,
  weight: spec.dimensions?.weight,
  importer: spec.importer?.name ?? null,
  image: spec.image,
});

const ficheUrl = (r: Scooter125Row) =>
  getUrlFromState('tech-specs-details', { id: r.id, specSlug: r.slug, slug: `${r.brand}-${r.model}-${r.year ?? ''}` });

const SectionHeading = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-6 md:mb-8" id={id}>
    <h2 className={S.SectionTitle}>{children}</h2>
    <div className="h-px flex-1 bg-slate-100 mx-8 hidden md:block" />
  </div>
);

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="bg-card rounded-2xl border border-gray-100 flex items-center gap-3 p-3 shadow-sm overflow-hidden">
    <div className="w-9 h-9 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">{icon}</div>
    <div className="flex flex-col min-w-0">
      <span className="font-sans text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="font-sans text-sm font-black text-gray-700 truncate">{value}</span>
    </div>
  </div>
);

const PriceTable = ({ rows }: { rows: Scooter125Row[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[680px] border-collapse">
      <caption className="sr-only">Prix des scooters 125 neufs en Tunisie</caption>
      <thead className="border-b border-border">
        <tr>
          <th scope="col" className={`${S.Th} ${S.Sticky}`}>Modèle</th>
          <th scope="col" className={S.Th}>Année</th>
          <th scope="col" className={`${S.Th} text-right`}>Prix neuf</th>
          <th scope="col" className={`${S.Th} text-right`}>Puissance</th>
          <th scope="col" className={`${S.Th} text-right`}>Poids</th>
          <th scope="col" className={S.Th}>Importateur</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.slug || r.id || r.name)} className="border-b border-border/50 last:border-0">
            <th scope="row" className={`${S.Td} ${S.Sticky} text-left`}>
              <Link to={ficheUrl(r)} className="font-extrabold hover:text-primary-600 transition-colors">{r.name}</Link>
            </th>
            <td className={`${S.Td} text-muted-foreground`}>{r.year ?? '—'}</td>
            <td className={`${S.Td} text-right font-[900] text-primary-600`}>{fmtDt(r.price)}</td>
            <td className={`${S.Td} text-right font-extrabold`}>{fmtCh(r.powerCh)}</td>
            <td className={`${S.Td} text-right font-extrabold`}>{fmtKg(r.weightKg)}</td>
            <td className={`${S.Td} text-muted-foreground`}>{r.importer || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FaqItem = ({ question, answer, open, onToggle }: { question: string; answer: string; open: boolean; onToggle: () => void }) => (
  <div className={`bg-card rounded-3xl border transition-all ${open ? 'border-primary-200 shadow-lg' : 'border-gray-100 shadow-sm'}`}>
    <h3>
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-4 p-6 text-left focus:outline-none">
        <span className="text-base md:text-lg font-bold text-gray-900">{question}</span>
        <Plus size={16} className={`shrink-0 ${open ? 'rotate-45' : ''} transition-transform`} />
      </button>
    </h3>
    {/* Answers stay in the DOM (hidden when closed) so crawlers read them. */}
    <div className={`${open ? '' : 'hidden '}px-6 pb-6 pt-0 animate-fade-in-up`}>
      <p className="text-gray-600 leading-relaxed font-medium pl-4 border-l-2 border-primary-100">{answer}</p>
    </div>
  </div>
);

const Scooter125Prices: React.FC<BasePageProps> = ({ onNavigate }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { data: specs = [], isLoading, isError, isFetching, refetch } = useCatalogTechSpecs({ availableInTunisia: true });

  const now = useMemo(() => new Date(), []);
  const rows = useMemo(() => scooter125Rows(specs.map(toSource)), [specs]);
  const specById = useMemo(() => new Map(specs.map((s) => [String(s.id), s])), [specs]);
  const bands = useMemo(() => scooter125Bands(rows), [rows]);
  const faq = useMemo(() => scooter125Faq(rows), [rows]);
  const advice = useMemo(() => scooter125Advice(rows), [rows]);
  const stats = useMemo(() => scooter125Stats(rows), [rows]);
  const brands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort((a, b) => a.localeCompare(b, 'fr')), [rows]);
  const ready = !isLoading && rows.length > 0;

  const schema = useMemo(() => [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Fiches techniques', item: `${SITE}/fiches-techniques` },
        { '@type': 'ListItem', position: 3, name: SCOOTER_125_BREADCRUMB, item: `${SITE}${SCOOTER_125_PATH}` },
      ],
    },
    ...(rows.length ? [{
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: scooter125Heading(now),
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.name, url: `${SITE}${ficheUrl(r)}` })),
    }] : []),
  ], [rows, now]);

  return (
    <main className={S.Wrapper}>
      <SEO
        title={scooter125Title(now)}
        description={scooter125Description(rows, now)}
        url={SCOOTER_125_PATH}
        schema={schema}
      />

      <TechSpecsHero
        title={scooter125Heading(now)}
        titleOnMobile
        subtitle="Prix du neuf, puissance et poids des scooters 125 vendus en Tunisie, comparés modèle par modèle."
        onBack={() => onNavigate?.('tech-specs-brands')}
        backText="Retour au catalogue"
        onNavigateHome={() => onNavigate?.('home')}
        breadcrumbCurrent={SCOOTER_125_BREADCRUMB}
      />

      <Section variant="none" className="bg-[#F8F9F9] md:bg-card pt-4 md:pt-16 pb-20 md:pb-32">
        {isError && specs.length === 0 ? (
          <TechSpecsErrorRetry
            title="Prix indisponibles"
            description="Les fiches techniques n'ont pas pu être chargées. Vérifiez votre connexion et réessayez."
            onRetry={() => refetch()}
            isRetrying={isFetching}
          />
        ) : (
          <div className="flex flex-col gap-14 md:gap-20">
            {/* Direct answer + key figures */}
            <div className="flex flex-col gap-6">
              {ready ? <p className={S.Lead}>{scooter125Intro(rows, now)}</p> : <Skeleton className="h-20 w-full max-w-3xl rounded-xl" />}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
                <Stat icon={<Tag size={18} />} label="À partir de" value={stats.min !== null ? fmtDt(stats.min) : '—'} />
                <Stat icon={<BarChart3 size={18} />} label="Prix médian" value={stats.median !== null ? fmtDt(stats.median) : '—'} />
                <Stat icon={<Layers size={18} />} label="Modèles comparés" value={ready ? `${stats.count} modèles, ${stats.brands} marques` : '—'} />
              </div>
            </div>

            {/* Full price table */}
            <div>
              <div className={S.ContentBlock}>
                <div className={S.BlockHeader}>
                  <h2 className={S.BlockTitle}>Tous les prix des scooters 125 neufs</h2>
                </div>
                {ready ? <PriceTable rows={rows} /> : (
                  <div className="p-6 md:p-8 flex flex-col gap-3">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-5">
                <Link to={getUrlFromState('comparator')} className={S.PrimaryBtn}>Comparer 2 modèles <ArrowRight size={16} /></Link>
                <Link to={getUrlFromState('search', { type: 'Scooter', maxCC: 125 })} className={S.SecondaryBtn}>Voir les scooters 125 d'occasion</Link>
              </div>
            </div>

            {/* Price bands */}
            {bands.map((band) => (
              <div key={band.id}>
                <SectionHeading id={band.id}>{band.title}</SectionHeading>
                <p className={`${S.Text} max-w-3xl mb-6`}>{ready ? band.intro : ''}</p>
                <div className={S.Grid}>
                  {isLoading
                    ? Array.from({ length: 4 }).map((_, i) => <ModelCardSkeleton key={i} />)
                    : band.rows.map((r) => {
                      const spec = specById.get(String(r.id));
                      return spec ? <TechSpecModelCard key={String(r.id)} spec={spec} /> : null;
                    })}
                </div>
              </div>
            ))}

            {/* How to choose */}
            <div>
              <SectionHeading>Comment choisir son scooter 125 en Tunisie</SectionHeading>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {advice.map((a) => (
                  <div key={a.title} className="bg-card rounded-2xl border border-gray-100 p-5 md:p-6 shadow-sm">
                    <h3 className="font-sans text-[12px] font-extrabold uppercase tracking-[0.08em] text-foreground border-b-2 border-primary-600 pb-2 mb-3">{a.title}</h3>
                    <p className={S.Text}>{a.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* New or used */}
            <div className={`${S.ContentBlock} p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 md:gap-8`}>
              <div className="flex-1">
                <h2 className={`${S.SectionTitle} mb-2`}>Neuf ou occasion ?</h2>
                <p className={S.Text}>
                  Un scooter 125 d'occasion coûte moins cher qu'un neuf, mais vérifiez l'entretien, le kilométrage et les papiers avant d'acheter.
                  Les annonces Moto-Scoot.tn regroupent les scooters vendus par des particuliers et des professionnels partout en Tunisie.
                </p>
              </div>
              <Link to={getUrlFromState('search', { type: 'Scooter', maxCC: 125 })} className={`${S.PrimaryBtn} shrink-0`}>Voir les annonces <ArrowRight size={16} /></Link>
            </div>

            {/* FAQ */}
            {faq.length > 0 && (
              <div>
                <SectionHeading>Questions fréquentes</SectionHeading>
                <div className="flex flex-col gap-4 max-w-4xl">
                  {faq.map((f, i) => (
                    <FaqItem key={f.question} question={f.question} answer={f.answer} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
                  ))}
                </div>
              </div>
            )}

            {/* Method + related pages */}
            <div className="flex flex-col gap-6">
              <div>
                <h2 className={`${S.BlockTitle} mb-2`}>Comment ces prix sont établis</h2>
                <p className={`${S.Text} max-w-4xl`}>{scooter125Method(now)}</p>
              </div>
              {brands.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {brands.map((b) => (
                    <Link key={b} to={getUrlFromState('tech-specs-models', { brand: b })} className={S.Chip}>Fiches techniques {b}</Link>
                  ))}
                  <Link to={getUrlFromState('tech-specs-brands')} className={S.Chip}>Toutes les marques</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>
    </main>
  );
};

export default memo(Scooter125Prices);
