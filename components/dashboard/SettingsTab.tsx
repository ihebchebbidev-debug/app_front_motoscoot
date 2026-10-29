import React, { memo, useState, useRef } from 'react';
import { 
  User, 
  ShieldCheck, 
  Mail, 
  Smartphone, 
  Lock, 
  Save, 
  UserCircle,
  Camera,
  Calendar,
  UserCheck,
  CheckCircle2,
  KeyRound,
  MapPin,
  Store,
  Building2,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useUser } from '../../context/UserContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../ui/Badge';
import { Reveal } from '../ui/Reveal';
import { uploadsApi } from '../../services/uploadsApi';
import { compressImage } from '../../utils/imageCompression';
import { useGovernorates } from '../../hooks/useReferenceData';
import { isValidTunisiaPhone, TUNISIA_PHONE_ERROR } from '../../utils/phoneUtils';
import { formatMemberSince } from '../../utils/formatUtils';
import { MemberSinceSkeleton } from '../ui/Skeleton';
import MapPicker, { LatLng } from '../common/MapPicker';

// Phone is required, whatsapp is optional but must be a valid Tunisian number
// when provided. Coordinates are validated by the picker; we just keep them
// in form state.
const profileSchema = z.object({
  firstName: z.string().trim().min(2, 'Prénom requis').max(60),
  lastName:  z.string().trim().min(2, 'Nom requis').max(60),
  email:     z.string().email('Email invalide'),
  phone:     z.string().refine(isValidTunisiaPhone, { message: TUNISIA_PHONE_ERROR }),
  whatsapp:  z.string().optional().or(z.literal('')).refine(
    (v) => !v || isValidTunisiaPhone(v),
    { message: 'WhatsApp ' + TUNISIA_PHONE_ERROR },
  ),
  governorate: z.string().min(1, 'Gouvernorat requis').max(60),
  city:        z.string().trim().max(60).optional().or(z.literal('')),
  address:     z.string().trim().max(500, 'Adresse trop longue').optional().or(z.literal('')),
  latitude:    z.number().min(-90).max(90).optional().nullable(),
  longitude:   z.number().min(-180).max(180).optional().nullable(),
  // Pro-only fields. Required at validation time only when the account is Pro
  // (handled below in the resolver via context). Kept optional in the schema
  // so Particulier accounts can submit without filling them in.
  shopName:    z.string().trim().max(120, 'Nom trop long').optional().or(z.literal('')),
  shopAddress: z.string().trim().max(500, 'Adresse trop longue').optional().or(z.literal('')),
  shopLogo:    z.string().optional().or(z.literal('')),
  oldPassword: z.string().optional(),
  newPassword: z.string().min(6, '6 caractères minimum').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => !data.newPassword || data.newPassword === data.confirmPassword,
  { message: 'Les mots de passe ne correspondent pas', path: ['confirmPassword'] },
);

type ProfileFormData = z.infer<typeof profileSchema>;

const WhatsAppIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const SettingsTab: React.FC<{ onUpdate: () => void }> = () => {
  const { user, updateProfile, changePassword, isUpdating } = useUser();
  const { addToast } = useToast();
  const { data: governorates = [] } = useGovernorates();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isPro = user?.memberType === 'Pro';

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setIsUploadingAvatar(true);
    try {
      const file = await compressImage(raw);
      const { url } = await uploadsApi.single(file);
      await updateProfile({ avatar: url } as any);
      addToast('Photo de profil mise à jour', 'success');
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de l'upload de la photo", 'error');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const {
    register, handleSubmit, reset, control, setValue, watch,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      whatsapp: user?.whatsapp || '',
      governorate: user?.governorate || user?.city || '',
      city: '',
      address: user?.address || '',
      latitude: user?.latitude ?? null,
      longitude: user?.longitude ?? null,
      shopName: user?.shopName || '',
      shopAddress: user?.shopAddress || '',
      shopLogo: user?.shopLogo || '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // When the profile finishes loading after the form has mounted with empty
  // defaults, push the freshly fetched user data into the form so the inputs
  // reflect the real account.
  React.useEffect(() => {
    if (!user) return;
    reset({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      whatsapp: user.whatsapp || '',
      governorate: user.governorate || user.city || '',
      city: '',
      address: user.address || '',
      latitude: user.latitude ?? null,
      longitude: user.longitude ?? null,
      shopName: user.shopName || '',
      shopAddress: user.shopAddress || '',
      shopLogo: user.shopLogo || '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [user, reset]);

  // Format the "Membre depuis" label from the real account creation date.
  const memberSinceLabel = React.useMemo(() => {
    return formatMemberSince(user?.createdAt) || '—';
  }, [user?.createdAt]);

  const lat = watch('latitude');
  const lng = watch('longitude');
  const mapValue: LatLng | null = (typeof lat === 'number' && typeof lng === 'number')
    ? { lat, lng }
    : null;

  const shopLogoValue = watch('shopLogo');

  // Pro shop logo upload — sends the file to /uploads/single and stores the
  // returned URL into the form (saved on submit, alongside the rest).
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    if (!raw.type.startsWith('image/')) {
      addToast('Seules les images sont acceptées (JPG, PNG, WebP).', 'error');
      e.target.value = '';
      return;
    }
    setIsUploadingLogo(true);
    try {
      const file = await compressImage(raw);
      const { url } = await uploadsApi.single(file);
      setValue('shopLogo', url, { shouldDirty: true });
      addToast('Logo téléversé — pensez à enregistrer.', 'success');
    } catch (err: any) {
      addToast(err?.message || "Erreur lors de l'upload du logo.", 'error');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      // Pro accounts must have a shop name + address — the backend enforces
      // it at signup, so we mirror the rule here when editing.
      if (isPro && !data.shopName?.trim()) {
        addToast('Le nom de la boutique est requis.', 'error');
        return;
      }

      // Profile update
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        whatsapp: data.whatsapp || '',
        governorate: data.governorate,
        city: data.city || data.governorate,
        address: data.address || '',
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        // Only forward shop fields for Pro accounts so we never accidentally
        // populate them on a Particulier profile.
        ...(isPro ? {
          shopName: data.shopName || '',
          shopAddress: data.shopAddress || '',
          shopLogo: data.shopLogo || '',
        } : {}),
      });

      // Password change (only if all 3 fields filled)
      if (data.oldPassword && data.newPassword && data.confirmPassword) {
        await changePassword({ oldPassword: data.oldPassword, newPassword: data.newPassword });
        setValue('oldPassword', '');
        setValue('newPassword', '');
        setValue('confirmPassword', '');
      }

      addToast('Profil mis à jour avec succès', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Mise à jour impossible.', 'error');
    }
  };

  const S = {
    FullCard: 'bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden w-full',
    SectionHeader: 'px-6 md:px-10 py-5 border-b border-gray-50 bg-gray-50/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4',
    SectionTitle: 'text-lg font-bold text-gray-900 flex items-center gap-3',
    ContentGrid: 'p-6 md:p-10',
    HeaderWrapper: 'relative bg-card px-6 md:px-10 py-6 border-b border-gray-100 flex flex-row items-center gap-6',
    PhotoContainer: 'flex flex-col items-center gap-1.5 shrink-0',
    InfoGroup: 'flex-1 flex flex-col justify-center min-w-0',
    MainHeading: 'text-2xl md:text-3xl font-black text-gray-900 leading-none',
    SubInfo: 'flex flex-col items-start gap-1.5 mt-2',
    SubInfoItem: 'flex items-center gap-2 text-[12px] md:text-[12px] font-bold text-gray-400 uppercase',
  };

  return (
    <div className="animate-fade-in font-['Inter'] max-w-6xl mx-auto pb-20 flex flex-col gap-[21px]" style={{ letterSpacing: '0px' }}>

      {/* SECTION 1: HEADER — hidden on mobile because Dashboard already shows a
          "Bonjour, FirstName" card above the Profil tab on small screens. */}
      <div className={`${S.FullCard} hidden md:block`}>
        <div className={S.HeaderWrapper}>
          <div className={S.PhotoContainer}>
            <div className="relative group">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-[6px] bg-card border border-gray-100 shadow-sm flex items-center justify-center text-primary-600 overflow-hidden cursor-pointer"
                onClick={handleAvatarClick}
                title="Changer la photo de profil"
              >
                {(isPro && shopLogoValue) ? (
                  <img src={shopLogoValue} className="w-full h-full object-cover bg-white" alt="Logo boutique" />
                ) : user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <UserCircle size={40} strokeWidth={1.5} />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isUploadingAvatar ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="text-white" size={18} />
                  )}
                </div>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div className="absolute -bottom-0.5 -right-0.5 bg-card rounded-full p-1 shadow-sm border border-gray-50">
                <ShieldCheck size={14} className="text-emerald-500" strokeWidth={3} />
              </div>
            </div>
          </div>

          <div className={S.InfoGroup}>
            <div className="flex items-center gap-2">
              <h1 className={S.MainHeading}>{user?.firstName} {user?.lastName}</h1>
              <Badge variant="success" size="xs" className="px-2 py-0.5 rounded-md font-extrabold tracking-[1px] text-[8px] hidden sm:inline-flex">
                VÉRIFIÉ
              </Badge>
            </div>

            <div className={S.SubInfo}>
              <div className={S.SubInfoItem}>
                <UserCheck size={12} className="text-orange-50" strokeWidth={2} />
                <span>{user?.memberType}</span>
              </div>
              <div className={S.SubInfoItem}>
                <Calendar size={12} className="text-orange-50" strokeWidth={2} />
                {user?.createdAt ? (
                  <span>Membre depuis {memberSinceLabel}</span>
                ) : (
                  <MemberSinceSkeleton className="bg-white/30" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[21px]">

        {/* SECTION 2: PERSONAL INFO */}
        <Reveal animation="fade-in-up" delay={50}>
          <div className={S.FullCard}>
            <div className={S.SectionHeader}>
              <h2 className={S.SectionTitle}>
                <div className="p-2 bg-orange-50 text-primary-600 rounded-lg"><User size={18} /></div>
                Informations Personnelles
              </h2>
            </div>
            <div className={S.ContentGrid}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <Input
                  label="PRÉNOM"
                  {...register('firstName')}
                  error={errors.firstName?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                />
                <Input
                  label="NOM"
                  {...register('lastName')}
                  error={errors.lastName?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                />
                <Select
                  label="GOUVERNORAT"
                  {...register('governorate')}
                  error={errors.governorate?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm pr-10"
                >
                  <option value="" disabled>Choisir votre gouvernorat</option>
                  {governorates.map((gov) => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </Reveal>

        {/* SECTION 3: CONTACT & SECURITY */}
        <Reveal animation="fade-in-up" delay={100}>
          <div className={S.FullCard}>
            <div className={S.SectionHeader}>
              <h2 className={S.SectionTitle}>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Mail size={18} /></div>
                Coordonnées
              </h2>
            </div>
            <div className={S.ContentGrid}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <div className="relative">
                  <Input
                    label="ADRESSE EMAIL"
                    {...register('email')}
                    error={errors.email?.message}
                    className="bg-gray-50/30 border-gray-100 pr-12 font-bold opacity-60 text-sm"
                    leftIcon={<Mail size={16} className="text-gray-400" />}
                    readOnly
                  />
                  <div className="absolute right-4 top-[40px] text-emerald-500" title="Email vérifié">
                    <CheckCircle2 size={14} />
                  </div>
                </div>
                <Input
                  label="TÉLÉPHONE"
                  {...register('phone')}
                  error={errors.phone?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  leftIcon={<Smartphone size={16} className="text-gray-400" />}
                  placeholder="22 123 456"
                />
                <Input
                  label="NUMÉRO WHATSAPP"
                  {...register('whatsapp')}
                  error={errors.whatsapp?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  leftIcon={<WhatsAppIcon className="w-4 h-4 text-gray-400" />}
                  placeholder="22 123 456 (optionnel)"
                />
              </div>
            </div>
          </div>
        </Reveal>

        {/* SECTION 4: ADDRESS + MAP */}
        <Reveal animation="fade-in-up" delay={120}>
          <div className={S.FullCard}>
            <div className={S.SectionHeader}>
              <h2 className={S.SectionTitle}>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><MapPin size={18} /></div>
                Adresse & Localisation
              </h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Visible sur vos annonces
              </span>
            </div>
            <div className={`${S.ContentGrid} space-y-6`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="VILLE / LOCALITÉ"
                  {...register('city')}
                  error={errors.city?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  placeholder="Ex: La Marsa"
                />
                <Input
                  label="ADRESSE COMPLÈTE"
                  {...register('address')}
                  error={errors.address?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  placeholder="Rue, immeuble, repère…"
                  leftIcon={<MapPin size={16} className="text-gray-400" />}
                />
              </div>

              <Controller
                control={control}
                name="latitude"
                render={() => (
                  <MapPicker
                    value={mapValue}
                    defaultAddressQuery={watch('address') || `${watch('city')} ${watch('governorate')} Tunisie`.trim()}
                    onChange={(coords, addr) => {
                      setValue('latitude', coords.lat,  { shouldDirty: true, shouldValidate: false });
                      setValue('longitude', coords.lng, { shouldDirty: true, shouldValidate: false });
                      // Only auto-fill address when the user hasn't typed one yet,
                      // so we never overwrite their manual input.
                      if (addr && !watch('address')) {
                        setValue('address', addr.slice(0, 500), { shouldDirty: true, shouldValidate: false });
                      }
                    }}
                  />
                )}
              />

              {(typeof lat === 'number' && typeof lng === 'number') && (
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 size={14} /> Position enregistrée
                </p>
              )}
            </div>
          </div>
        </Reveal>

        {/* SECTION 4b: PRO SHOP — only for Pro accounts */}
        {isPro && (
          <Reveal animation="fade-in-up" delay={130}>
            <div className={S.FullCard}>
              <div className={S.SectionHeader}>
                <h2 className={S.SectionTitle}>
                  <div className="p-2 bg-primary-50 text-primary-600 rounded-lg"><Store size={18} /></div>
                  Ma Boutique
                </h2>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Visible sur toutes vos annonces
                </span>
              </div>
              <div className={`${S.ContentGrid} space-y-6`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="NOM DE LA BOUTIQUE"
                    {...register('shopName')}
                    error={errors.shopName?.message}
                    className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                    placeholder="Ex: Tunis Moto Shop"
                    leftIcon={<Building2 size={16} className="text-gray-400" />}
                  />
                  <Input
                    label="ADRESSE BOUTIQUE"
                    {...register('shopAddress')}
                    error={errors.shopAddress?.message}
                    className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                    placeholder="Rue, ville…"
                    leftIcon={<MapPin size={16} className="text-gray-400" />}
                  />
                </div>

                {/* Logo uploader */}
                <div className="space-y-2">
                  <label className="block text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Logo de la boutique
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-2xl border border-gray-100 bg-gray-50/60 flex items-center justify-center overflow-hidden shrink-0">
                      {shopLogoValue ? (
                        <img src={shopLogoValue} alt="Logo boutique" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={28} className="text-gray-300" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        isLoading={isUploadingLogo}
                        leftIcon={!isUploadingLogo ? <Upload size={14} /> : undefined}
                        className="!h-10 !rounded-xl !text-[12px] !font-extrabold"
                      >
                        {shopLogoValue ? 'Changer le logo' : 'Téléverser un logo'}
                      </Button>
                      {shopLogoValue && (
                        <button
                          type="button"
                          onClick={() => setValue('shopLogo', '', { shouldDirty: true })}
                          className="text-[11px] font-bold text-gray-400 hover:text-red-600 self-start"
                        >
                          Retirer le logo
                        </button>
                      )}
                      <p className="text-[11px] font-medium text-gray-400">
                        JPG, PNG ou WebP — visible sur la fiche annonce et les cartes.
                      </p>
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        )}

        {/* SECTION 5: PASSWORD */}
        <Reveal animation="fade-in-up" delay={140}>
          <div className={S.FullCard}>
            <div className={S.SectionHeader}>
              <h2 className={S.SectionTitle}>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Lock size={18} /></div>
                Modifier le mot de passe
              </h2>
            </div>
            <div className={S.ContentGrid}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                <Input
                  label="ANCIEN MOT DE PASSE"
                  type="password"
                  {...register('oldPassword')}
                  error={errors.oldPassword?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  leftIcon={<Lock size={16} className="text-gray-400" />}
                />
                <Input
                  label="NOUVEAU MOT DE PASSE"
                  type="password"
                  {...register('newPassword')}
                  error={errors.newPassword?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  leftIcon={<KeyRound size={16} className="text-gray-400" />}
                />
                <Input
                  label="CONFIRMER LE MOT DE PASSE"
                  type="password"
                  {...register('confirmPassword')}
                  error={errors.confirmPassword?.message}
                  className="bg-gray-50/50 border-gray-100 font-bold text-sm"
                  leftIcon={<CheckCircle2 size={16} className="text-gray-400" />}
                />
              </div>
            </div>
          </div>
        </Reveal>

        {/* SUBMIT */}
        <div className="pb-12 flex flex-col items-start px-2 md:px-0">
          <Button
            variant="primary"
            type="submit"
            isLoading={isUpdating}
            disabled={!isDirty}
            className="px-12 rounded-2xl h-14 shadow-xl min-w-[280px]"
            leftIcon={<Save size={20} />}
          >
            Enregistrer
          </Button>
          {!isDirty && (
            <p className="text-[9px] font-bold text-gray-400 uppercase mt-4 ml-1">
              Aucune modification en attente
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default memo(SettingsTab);
