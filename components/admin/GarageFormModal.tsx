/**
 * GarageFormModal — admin-only "create a new garage" form.
 *
 * Lets an admin spin up a complete professional garage profile with all
 * the fields the public garage page displays: identity, contact, location
 * (incl. coordinates), gallery, specialties, weekly hours, services and
 * status. The garage can optionally be attached to an existing user as
 * `owner_id`, and admins can choose to mark it verified on creation.
 */
import React, { useMemo, useState } from 'react';
import { z } from 'zod';
import {
  X, Loader2, Plus, Trash2, MapPin, Building2, Phone, Mail, Globe,
  Tag, Clock, Wrench, ShieldCheck, User as UserIcon,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useCreateAdminGarage } from '../../hooks/useAdmin';
import { useGarageSpecialties } from '../../hooks/useReferenceData';
import { tunisianCities } from '../../constants/reference';
import { AdminImageUpload } from './AdminImageUpload';
import { AdminGalleryUpload } from './AdminGalleryUpload';
import type { AdminGarageCreatePayload } from '../../services/adminApi';

const WEEKDAYS = [
  { key: 'monday',    label: 'Lundi'    },
  { key: 'tuesday',   label: 'Mardi'    },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday',  label: 'Jeudi'    },
  { key: 'friday',    label: 'Vendredi' },
  { key: 'saturday',  label: 'Samedi'   },
  { key: 'sunday',    label: 'Dimanche' },
] as const;

// Zod schema — mirrors backend validation. Defensive max lengths to match
// VARCHAR caps in the schema (name 200, city/governorate 100, etc.).
const garageSchema = z.object({
  name: z.string().trim().min(2, 'Nom requis').max(200, 'Trop long (200 max)'),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  email: z.string().trim().email('Email invalide').max(255).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  website: z.string().trim().url('URL invalide').max(500).optional().or(z.literal('')),
  address: z.string().trim().max(500).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  governorate: z.string().trim().max(100).optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  owner_id: z.string().uuid('UUID invalide').optional().or(z.literal('')),
});

interface ServiceRow { name: string; price: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export const GarageFormModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const { addToast } = useToast();
  const create = useCreateAdminGarage();
  const { data: specialtiesRef = [] } = useGarageSpecialties();

  // ---------- form state ----------
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [logo, setLogo] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [openingHours, setOpeningHours] = useState<Record<string, string>>({});
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [status, setStatus] = useState<'active' | 'pending' | 'suspended' | 'closed'>('active');
  const [isVerified, setIsVerified] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const specialtyNames = useMemo(
    () => specialtiesRef.map((s: any) => s.name).filter(Boolean),
    [specialtiesRef],
  );

  const reset = () => {
    setName(''); setDescription(''); setEmail(''); setPhone(''); setWebsite('');
    setAddress(''); setCity(''); setGovernorate(''); setLatitude(''); setLongitude('');
    setLogo(''); setCoverImage(''); setImages([]); setSpecialties([]);
    setOpeningHours({}); setServices([]); setStatus('active'); setIsVerified(false);
    setOwnerId(''); setErrors({});
  };

  const handleClose = () => { reset(); onClose(); };

  const toggleSpecialty = (s: string) =>
    setSpecialties((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const addService = () => setServices((prev) => [...prev, { name: '', price: '' }]);
  const updateService = (idx: number, key: keyof ServiceRow, val: string) =>
    setServices((prev) => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  const removeService = (idx: number) =>
    setServices((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = latitude.trim() === '' ? null : Number(latitude);
    const lng = longitude.trim() === '' ? null : Number(longitude);

    const parsed = garageSchema.safeParse({
      name, description, email, phone, website, address, city, governorate,
      latitude: lat, longitude: lng, owner_id: ownerId,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] || 'form');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      addToast('Vérifiez les champs en rouge', 'error');
      return;
    }
    setErrors({});

    const payload: AdminGarageCreatePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      governorate: governorate.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      website: website.trim() || undefined,
      logo: logo || undefined,
      cover_image: coverImage || undefined,
      image: coverImage || undefined,
      images,
      specialties,
      latitude: lat,
      longitude: lng,
      opening_hours: openingHours,
      services: services
        .map((s) => ({ name: s.name.trim(), price: s.price.trim() || undefined }))
        .filter((s) => s.name.length > 0),
      status,
      is_verified: isVerified,
      owner_id: ownerId.trim() || undefined,
    };

    try {
      await create.mutateAsync(payload);
      addToast('Garage créé avec succès', 'success');
      onCreated?.();
      handleClose();
    } catch (err: any) {
      addToast(err?.message || 'Échec de la création', 'error');
    }
  };

  if (!open) return null;

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary';
  const errCls = (k: string) => errors[k] ? 'border-destructive' : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <form
        onSubmit={submit}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <Building2 size={20} className="text-primary" /> Nouveau garage professionnel
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Créez un profil garage complet — visible immédiatement sur le site.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* IDENTITY */}
          <Section icon={Building2} title="Identité">
            <Field label="Nom du garage *" error={errors.name}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputCls} ${errCls('name')}`}
                maxLength={200}
                placeholder="Ex. Garage Ben Ali Motos"
                required
              />
            </Field>
            <Field label="Description" error={errors.description}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                className={`${inputCls} ${errCls('description')}`}
                placeholder="Présentation, savoir-faire, années d'expérience…"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Logo">
                <AdminImageUpload value={logo} onChange={setLogo} label="" />
              </Field>
              <Field label="Photo de couverture">
                <AdminImageUpload value={coverImage} onChange={setCoverImage} label="" />
              </Field>
            </div>
            <Field label="Galerie d'images">
              <AdminGalleryUpload value={images} onChange={setImages} label="" />
            </Field>
          </Section>

          {/* CONTACT */}
          <Section icon={Phone} title="Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Téléphone" error={errors.phone}>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`${inputCls} pl-9 ${errCls('phone')}`}
                    placeholder="+216 …"
                    maxLength={20}
                  />
                </div>
              </Field>
              <Field label="Email" error={errors.email}>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputCls} pl-9 ${errCls('email')}`}
                    placeholder="contact@garage.tn"
                    maxLength={255}
                  />
                </div>
              </Field>
              <Field label="Site web" error={errors.website}>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className={`${inputCls} pl-9 ${errCls('website')}`}
                    placeholder="https://…"
                  />
                </div>
              </Field>
              <Field label="ID utilisateur propriétaire (UUID, optionnel)" error={errors.owner_id}>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className={`${inputCls} pl-9 font-mono text-xs ${errCls('owner_id')}`}
                    placeholder="laissez vide pour aucun"
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* LOCATION */}
          <Section icon={MapPin} title="Localisation">
            <Field label="Adresse" error={errors.address}>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`${inputCls} ${errCls('address')}`}
                placeholder="Rue, numéro…"
                maxLength={500}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Ville">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                  maxLength={100}
                />
              </Field>
              <Field label="Gouvernorat">
                <select
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Sélectionner —</option>
                  {tunisianCities.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Latitude" error={errors.latitude}>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className={`${inputCls} ${errCls('latitude')}`}
                  placeholder="36.8065"
                />
              </Field>
              <Field label="Longitude" error={errors.longitude}>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className={`${inputCls} ${errCls('longitude')}`}
                  placeholder="10.1815"
                />
              </Field>
            </div>
          </Section>

          {/* SPECIALTIES */}
          <Section icon={Tag} title="Spécialités">
            {specialtyNames.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune spécialité configurée. Ajoutez-en dans <strong>Données de référence → Spécialités garages</strong>.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {specialtyNames.map((s: string) => {
                  const active = specialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          {/* HOURS */}
          <Section icon={Clock} title="Horaires d'ouverture">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {WEEKDAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-bold text-foreground">{d.label}</label>
                  <input
                    value={openingHours[d.key] || ''}
                    onChange={(e) => setOpeningHours((prev) => ({ ...prev, [d.key]: e.target.value }))}
                    placeholder="08:00 - 18:00 ou Fermé"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* SERVICES */}
          <Section icon={Wrench} title="Services & tarifs">
            <div className="space-y-2">
              {services.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s.name}
                    onChange={(e) => updateService(i, 'name', e.target.value)}
                    placeholder="Nom du service (ex. Vidange)"
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    value={s.price}
                    onChange={(e) => updateService(i, 'price', e.target.value)}
                    placeholder="Prix (ex. 50 DT)"
                    className={`${inputCls} w-40`}
                  />
                  <button
                    type="button"
                    onClick={() => removeService(i)}
                    className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addService}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-bold hover:bg-muted/80"
              >
                <Plus size={14} /> Ajouter un service
              </button>
            </div>
          </Section>

          {/* PUBLISHING */}
          <Section icon={ShieldCheck} title="Statut & vérification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Statut">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="active">Actif</option>
                  <option value="pending">En attente</option>
                  <option value="suspended">Suspendu</option>
                  <option value="closed">Fermé</option>
                </select>
              </Field>
              <Field label="Vérification">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isVerified}
                    onChange={(e) => setIsVerified(e.target.checked)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm font-medium text-foreground">
                    Marquer comme garage vérifié
                  </span>
                </label>
              </Field>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border px-6 py-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-foreground bg-muted hover:bg-muted/80 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {create.isPending && <Loader2 size={14} className="animate-spin" />}
            Créer le garage
          </button>
        </div>
      </form>
    </div>
  );
};

/* ---------- Local UI helpers ---------- */

const Section: React.FC<React.PropsWithChildren<{ icon: React.ElementType; title: string }>> = ({
  icon: Icon, title, children,
}) => (
  <section className="space-y-4">
    <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
      <Icon size={14} className="text-primary" /> {title}
    </h3>
    <div className="space-y-3">{children}</div>
  </section>
);

const Field: React.FC<React.PropsWithChildren<{ label: string; error?: string }>> = ({
  label, error, children,
}) => (
  <div>
    <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
      {label}
    </label>
    {children}
    {error && <p className="mt-1 text-[11px] font-bold text-destructive">{error}</p>}
  </div>
);

export default GarageFormModal;
