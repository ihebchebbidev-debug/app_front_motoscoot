import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteSettingsApi, SOCIAL_NETWORKS, SocialLinks } from '../../services/siteSettingsApi';
import { useToast } from '../../context/ToastContext';

/** Backoffice: footer social network links. Empty = icon hidden on the site. */
const SocialLinksSection: React.FC = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { data } = useQuery({
    queryKey: ['site-settings', 'social-links'],
    queryFn: ({ signal }) => siteSettingsApi.getSocialLinks(signal),
  });
  const [form, setForm] = useState<SocialLinks>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: (payload: SocialLinks) => siteSettingsApi.updateSocialLinks(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['site-settings', 'social-links'] });
      addToast('Réseaux sociaux enregistrés', 'success');
    },
    onError: (e: any) => addToast(e?.message || 'Enregistrement impossible', 'error'),
  });

  return (
    <section className="bg-card rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-black text-gray-900">Réseaux sociaux (pied de page)</h3>
        <p className="text-sm text-gray-500">Laissez un champ vide pour masquer l'icône. Les liens doivent commencer par https://</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SOCIAL_NETWORKS.map(({ key, label, placeholder }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-xs font-bold text-gray-600">{label}</span>
            <input
              type="url"
              value={form[key] || ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={placeholder}
              className="h-10 px-3 rounded-lg border border-gray-200 bg-card text-sm"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate(form)}
        className="px-5 h-10 rounded-lg bg-primary-600 text-white text-sm font-bold disabled:opacity-50"
      >
        {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </section>
  );
};

export default SocialLinksSection;
