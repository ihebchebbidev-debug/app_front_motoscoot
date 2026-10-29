import React, { useState, useCallback, useMemo, memo } from 'react';
import { 
  X, 
  Plus, 
  Search, 
  CheckCircle2, 
  Trash2, 
  ChevronRight, 
  Scale 
} from 'lucide-react';
import { useCatalogTechSpecs } from '../hooks/useTechSpecs';
import { BasePageProps } from '../types';
import SEO from './common/SEO';
import { getOptimizedImageUrl } from '../utils/urlUtils';
import { Reveal } from './ui/Reveal';
import { TechSpecsHero } from './tech-specs/TechSpecsHero';
import { useBikeComparison } from '../hooks/useBikeComparison';
import { COMPARISON_SCHEMA } from '../constants/comparison';
import { getSpecValue } from '../utils/comparisonUtils';
import { ModelCard } from './home/ModelCard';
import type { BikeModel } from '../types';
import { Button } from './ui/Button';

const S = {
  Wrapper: "min-h-screen bg-background font-sans pb-32",
  Container: "max-w-7xl mx-auto px-4 md:px-8 lg:px-12 mt-8 md:mt-12 relative z-10",
  StickyHeader: "bg-card border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden mb-8 md:mb-12",
  HeaderTitleBar: "bg-primary-600 px-6 md:px-8 py-4 flex items-center justify-between border-b border-orange-600",
  HeaderTitleText: "font-sans font-[900] text-[15px] md:text-[18px] leading-tight text-white tracking-tight",
  GridRow: "grid grid-cols-[110px_1fr_1fr] md:grid-cols-[280px_1fr_1fr] divide-x divide-gray-100",
  LabelCell: "bg-gray-50/50 flex items-center px-4 md:px-8 min-h-[72px] py-4",
  LabelText: "font-sans font-bold text-[11px] md:text-[15px] leading-tight text-gray-600 tracking-tight",
  DataCell: (isWinner: boolean) => `flex flex-col items-center justify-center px-2 md:px-8 min-h-[64px] md:min-h-[72px] py-3 md:py-4 transition-all duration-300 ${isWinner ? 'bg-emerald-50/40' : 'bg-card'} hover:bg-gray-50/50`,
  DataText: (isWinner: boolean) => `font-sans font-medium md:font-bold text-[11px] md:text-[15px] leading-tight tracking-tight text-center ${isWinner ? 'text-emerald-700' : 'text-gray-900'}`,
  ModelInfoCell: "flex flex-col items-center justify-center p-4 md:p-8 relative min-w-0 bg-card",
  ModelThumb: "w-full aspect-[4/3] max-w-[120px] md:max-w-[180px] mx-auto mb-0 overflow-hidden group-hover:scale-105 transition-transform duration-500",
  ModelName: "font-sans font-[900] text-[12px] md:text-[15px] leading-tight text-gray-900 tracking-tight whitespace-nowrap",
  ModelBrand: "text-[9px] md:text-[11px] font-black text-primary-600 uppercase tracking-widest leading-none",
  SectionCard: "bg-card border border-gray-100 rounded-[2rem] shadow-sm overflow-hidden mb-8 md:mb-12",
  EmptySlot: "flex flex-col items-center justify-center gap-3 cursor-pointer group h-full w-full py-8 bg-card border border-dashed border-gray-200 rounded-2xl hover:border-primary-600/40 hover:bg-orange-50/50 transition-all",
  AddIcon: "w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm border border-gray-100",
  Switcher: "flex bg-gray-100 p-1.5 rounded-xl",
  SwitcherBtn: (active: boolean) => `px-4 py-2 text-[13px] font-[800] tracking-tight rounded-lg transition-all ${active ? 'bg-card text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`,
};

const Comparator: React.FC<BasePageProps> = ({ ids, onNavigate }) => {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const { data: allSpecs = [], isLoading: catalogLoading, isError: catalogError, refetch: reloadCatalog } = useCatalogTechSpecs();

  // Derive "popular models" cards from the same tech-specs dataset.
  const popularModels = useMemo<BikeModel[]>(
    () =>
      allSpecs.slice(0, 4).map((s) => ({
        id: s.id,
        name: s.model,
        brand: s.brand,
        image: s.cardImage || s.image,
        price: s.priceNew,
      })),
    [allSpecs],
  );

  const {
    selectedBikes,
    isLoading: selectionLoading,
    isError: selectionError,
    refetch: reloadSelection,
    slots,
    addBike,
    removeBike,
    clearAll,
    getWinnerId,
    isRowIdentical
  } = useBikeComparison({ initialIds: ids, onNavigate, maxSlots: 2 });

  const handleAddBikeSelect = useCallback((bikeId: number | string) => {
    if (activeSlot !== null) {
      addBike(activeSlot, bikeId);
      setActiveSlot(null);
      setSearch("");
    }
  }, [activeSlot, addBike]);

  const availableSpecs = useMemo(() => allSpecs.filter(spec =>
    !slots.some((id, index) => index !== activeSlot && id !== null && String(id) === String(spec.id)) &&
    (!search.trim() || `${spec.brand} ${spec.model}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')))
  ), [allSpecs, slots, activeSlot, search]);

  return (
    <div className={S.Wrapper}>
      <SEO 
        title="Comparateur Expert" 
        description="L'analyse technique point par point pour un choix sans compromis." 
      />
      
      <TechSpecsHero 
        title="Le Match Technique."
        subtitle="Comparez les spécifications constructeurs en détail."
        onNavigateHome={() => onNavigate?.('home')}
        breadcrumbCurrent="Comparateur"
        onBack={() => onNavigate?.('home')}
      />

      <div className={S.Container} role="table" aria-label="Tableau comparatif technique">
        {selectionLoading && <p role="status" className="mb-4 text-muted-foreground">Chargement des modèles sélectionnés…</p>}
        {selectionError && <div role="alert" className="mb-4"><p>Les modèles sélectionnés sont indisponibles.</p><Button onClick={() => reloadSelection()}>Réessayer</Button></div>}
        {/* PREMIER TABLEAU : COMPARATIF AVEC MINIATURES */}
        <div className={S.StickyHeader}>
           <div className={S.HeaderTitleBar}>
              <div className="flex items-center gap-2.5 md:gap-3">
                <Scale size={16} className="text-white hidden md:block" />
                <span className={S.HeaderTitleText}>Comparatif</span>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="flex bg-orange-700/30 p-1.5 rounded-xl" role="group" aria-label="Filtres d'affichage">
                  <button 
                    onClick={() => setShowOnlyDiff(false)} 
                    className={`px-4 py-2 text-[13px] font-[800] tracking-tight rounded-lg transition-all ${!showOnlyDiff ? 'bg-card text-primary-600 shadow-sm' : 'text-orange-100 hover:text-white'}`}
                    aria-pressed={!showOnlyDiff}
                  >Tout</button>
                  <button 
                    onClick={() => setShowOnlyDiff(true)} 
                    className={`px-4 py-2 text-[13px] font-[800] tracking-tight rounded-lg transition-all ${showOnlyDiff ? 'bg-card text-primary-600 shadow-sm' : 'text-orange-100 hover:text-white'}`}
                    aria-pressed={showOnlyDiff}
                  >Diffs</button>
                </div>
                <button onClick={clearAll} className="p-2 text-orange-100 hover:text-white transition-colors" title="Vider la comparaison"><Trash2 size={16}/></button>
              </div>
           </div>

           <div className="grid grid-cols-2 divide-x divide-gray-100" role="row">
              {/* COLONNES : IMAGES + NOMS */}
              {selectedBikes.map((bike, i) => (
                <div key={i} className={S.ModelInfoCell} role="columnheader">
                  {bike ? (
                    <div className="animate-fade-in relative text-center w-full group flex flex-col items-center">
                      <button onClick={() => removeBike(i)} className="absolute -top-2 -right-0 md:-right-2 p-1.5 bg-card text-gray-400 hover:text-red-500 rounded-full shadow-md border border-gray-100 z-10 active:scale-95 transition-all opacity-0 group-hover:opacity-100" aria-label="Retirer ce modèle"><X size={12} strokeWidth={3}/></button>
                      
                      <div className={S.ModelThumb}>
                        <img src={getOptimizedImageUrl(bike.image, 400, 300, 80, undefined, `${bike.brand} ${bike.model}`)} className="w-full h-full object-contain" alt={bike.model} loading="lazy" />
                      </div>

                      <div className="mt-4 md:mt-6 flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                          <span className={S.ModelBrand}>{bike.brand}</span>
                          <span className={S.ModelName}>{bike.model}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={S.EmptySlot} onClick={() => { setActiveSlot(i); setVisibleCount(30); }} aria-label="Ajouter un modèle pour comparer">
                      <div className={S.AddIcon}><Plus size={12} strokeWidth={4} /></div>
                      <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Choisir</span>
                    </button>
                  )}
                </div>
              ))}
           </div>
        </div>

        {/* DONNÉES TECHNIQUES PAR SECTION */}
        <div className="flex flex-col">
           {COMPARISON_SCHEMA.map((section, sIdx) => (
             <Reveal key={sIdx} animation="fade-in-up" delay={sIdx * 50}>
                <div className={S.SectionCard}>
                  {/* EN-TÊTE DE SECTION : TITRE + NOMS DES MOTOS DANS LES COLONNES 2 ET 3 */}
                  <div className={`${S.GridRow} bg-primary-600 border-b border-orange-600 divide-x divide-orange-600/30`} role="row">
                     <div className="flex items-center gap-2 md:gap-3 px-4 md:px-8 py-4 md:py-5 min-h-[56px] md:min-h-[64px]">
                       <div className="p-1.5 md:p-2 bg-white/10 rounded-lg md:rounded-xl backdrop-blur-sm border border-white/20 hidden md:block">
                         <section.icon size={18} className="text-white shrink-0" />
                       </div>
                       <span className={S.HeaderTitleText}>{section.group}</span>
                     </div>
                     {selectedBikes.map((bike, bIdx) => (
                        <div key={bIdx} className="flex items-center justify-center px-4 py-5 bg-orange-700/10">
                           <span className="font-sans font-[800] text-[13px] md:text-[15px] text-orange-50 text-center">{bike?.model || "—"}</span>
                        </div>
                     ))}
                  </div>
                  
                  <div className="flex flex-col divide-y divide-gray-100">
                    {/* LIGNES TECHNIQUES */}
                    {section.rows.map((row, rIdx) => {
                      const identical = isRowIdentical(row);
                      const winnerId = getWinnerId(row);
                      if (showOnlyDiff && identical) return null;

                      return (
                        <div key={rIdx} className={S.GridRow} role="row">
                           <div className={S.LabelCell}>
                              <span className={S.LabelText}>{row.label}</span>
                              {identical && <CheckCircle2 size={14} className="text-gray-300 ml-2 hidden md:block" aria-label="Identique" />}
                           </div>
                           
                           {selectedBikes.map((bike, bIdx) => {
                              const val = bike ? getSpecValue(bike, row) : "-";
                              const isWinner = bike != null && winnerId != null && String(bike.id) === String(winnerId);
                              return (
                                <div key={bIdx} className={S.DataCell(isWinner)} role="cell">
                                   <span className={S.DataText(isWinner)}>{val || "—"}</span>
                                </div>
                              );
                           })}
                        </div>
                      );
                    })}
                  </div>
               </div>
             </Reveal>
           ))}
        </div>

        {/* MODÈLES SIMILAIRES */}
        <div className="mt-20 px-2 md:px-6 pb-24">
           <div className="flex items-center justify-between mb-8 md:mb-12 px-4 md:px-0">
              <div className="flex flex-col">
                 <h3 className="text-[24px] md:text-[32px] font-[900] text-gray-900 tracking-tight italic uppercase">Modèles Similaires</h3>
                 <p className="text-[12px] md:text-[14px] font-black text-primary-600 uppercase tracking-[0.2em] mt-1">D'autres experts pourraient vous intéresser</p>
              </div>
              <button 
                onClick={() => onNavigate?.('tech-specs-brands')}
                className="hidden md:flex items-center gap-2 text-[13px] font-black uppercase tracking-widest text-gray-400 hover:text-primary-600 transition-colors"
              >
                Tout voir <ChevronRight size={16} />
              </button>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {popularModels.slice(0, 4).map((model, index) => (
                <Reveal key={model.id} animation="fade-in-up" delay={index * 100}>
                  <ModelCard 
                    model={model} 
                    onClick={() => onNavigate?.('tech-specs-details', { id: model.id, name: model.name })} 
                  />
                </Reveal>
              ))}
           </div>
        </div>
      </div>

      {/* SELECTEUR BOTTOM SHEET */}
      {activeSlot !== null && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in" onClick={() => setActiveSlot(null)}>
          <div role="dialog" aria-modal="true" aria-label="Sélectionner un modèle" className="bg-card w-full max-w-xl rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setActiveSlot(null); }}>
            <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
               <div>
                 <h2 className="text-2xl font-[900] text-slate-900 tracking-[0] italic leading-none">Sélectionner</h2>
                 <p className="text-slate-400 font-bold uppercase text-[12px] tracking-[0] mt-2">Choisissez votre combattant</p>
               </div>
               <button onClick={() => setActiveSlot(null)} className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all active:scale-90" aria-label="Fermer"><X size={24} strokeWidth={2.5}/></button>
            </div>
            <div className="p-6 md:p-8 overflow-y-auto no-scrollbar">
               <div className="relative mb-6 sticky top-0 bg-card z-10 pb-2">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Chercher par marque ou modèle..." 
                    aria-label="Chercher par marque ou modèle"
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:bg-card focus:border-primary-600 transition-all pr-14 text-lg placeholder:text-slate-300 shadow-none tracking-[0]"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setVisibleCount(30); }}
                  />
                  <div className="absolute right-5 top-[22px] text-primary-600">
                    <Search size={24} strokeWidth={3} />
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-2 pb-10">
                  {catalogLoading && <p role="status">Chargement du catalogue…</p>}
                  {catalogError && <div role="alert"><p>Le catalogue est indisponible.</p><Button onClick={() => reloadCatalog()}>Réessayer</Button></div>}
                  {!catalogLoading && !catalogError && availableSpecs.length === 0 && <p role="status">Aucun modèle trouvé.</p>}
                  {availableSpecs.slice(0, visibleCount).map(bike => (
                    <button 
                      key={bike.id} 
                      onClick={() => handleAddBikeSelect(bike.id)}
                      className="flex items-center gap-5 p-4 rounded-2xl hover:bg-orange-50 border-2 border-transparent hover:border-orange-100 transition-all group text-left"
                    >
                       <div className="w-16 h-12 overflow-hidden shrink-0">
                          <img src={getOptimizedImageUrl(bike.image, 100, 80, 80, undefined, `${bike.brand} ${bike.model}`)} className="w-full h-full object-cover" alt={bike.model} loading="lazy" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <span className="block text-primary-600 font-bold text-[12px] tracking-[0] mb-0.5 uppercase">{bike.brand}</span>
                          <span className="block text-slate-900 text-[15px] font-bold truncate leading-none tracking-[0]">{bike.model}</span>
                       </div>
                       <div className="p-2 bg-slate-50 rounded-lg text-slate-300 group-hover:bg-primary-600 group-hover:text-white transition-all">
                          <Plus size={16} strokeWidth={3} />
                       </div>
                    </button>
                  ))}
                  {availableSpecs.length > visibleCount && <Button onClick={() => setVisibleCount(count => count + 30)}>Afficher plus</Button>}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Comparator);
