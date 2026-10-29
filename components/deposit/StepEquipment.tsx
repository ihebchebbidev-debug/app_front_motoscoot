import React, { memo, useMemo } from 'react';
import { ShieldCheck, Coffee, Package, Laptop, CheckCircle2, Plus } from 'lucide-react';
import { useEquipment } from '../../hooks/useReferenceData';

interface StepEquipmentProps {
  selectedEquipment: string[];
  onToggle: (item: string) => void;
  /** When set (Accessoires path), only show equipment tagged with this type. */
  accessoryType?: string;
}

const S = {
  HeaderSection: "text-center md:text-left mb-10",
  Title: "text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight",
  Subtitle: "text-gray-500 font-medium",
};

const CATEGORY_META: Record<string, { title: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  securite:  { title: 'Sécurité / Aides',  Icon: ShieldCheck },
  confort:   { title: 'Confort / Voyage',   Icon: Coffee      },
  praticite: { title: 'Praticité',          Icon: Package     },
  tech:      { title: 'Tech',               Icon: Laptop      },
};

const CATEGORY_ORDER = ['securite', 'confort', 'praticite', 'tech'];

export const StepEquipment = memo(({ selectedEquipment, onToggle, accessoryType }: StepEquipmentProps) => {
  const { data: equipmentData = [] } = useEquipment(accessoryType);

  const equipmentGroups = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    equipmentData.forEach((eq) => {
      const cat = eq.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(eq.name);
    });

    return CATEGORY_ORDER
      .filter((cat) => grouped[cat]?.length)
      .map((cat) => ({
        category: cat,
        title: CATEGORY_META[cat]?.title ?? cat,
        Icon:  CATEGORY_META[cat]?.Icon  ?? Package,
        items: grouped[cat],
      }));
  }, [equipmentData]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>Options & Équipements</h2>
        <p className={S.Subtitle}>Valorisez votre véhicule en cochant les options incluses.</p>
      </div>

      <div className="space-y-12">
        {equipmentGroups.map(({ category, title, Icon, items }) => (
          <div key={category} className="space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-50">
              <Icon size={20} className="text-primary-600" />
              <h3 className="text-[12px] font-[900] text-gray-500 uppercase tracking-[0.1em]">{title}</h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {items.map((item) => {
                const isActive = selectedEquipment.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onToggle(item)}
                    className={`group flex items-center gap-2.5 px-5 py-3 rounded-full border-2 transition-all active:scale-95 ${
                      isActive
                        ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-sm'
                        : 'border-gray-100 bg-card text-gray-500 hover:border-primary-200 hover:text-gray-900'
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle2 size={16} className="text-primary-600" />
                    ) : (
                      <Plus size={16} className="text-gray-300 group-hover:text-primary-400" />
                    )}
                    <span className="text-xs font-bold tracking-tight">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {equipmentGroups.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Chargement des équipements…</p>
        )}
      </div>
    </div>
  );
});
