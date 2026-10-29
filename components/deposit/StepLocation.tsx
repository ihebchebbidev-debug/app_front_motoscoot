import React, { memo, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { Control, useWatch, UseFormSetValue, UseFormRegister, FieldErrors } from 'react-hook-form';
import { ListingFormData } from '../../types/listing';
import { Input } from '../ui/Input';
import MapPicker, { LatLng } from '../common/MapPicker';
import { useUser } from '../../context/UserContext';

interface StepLocationProps {
  register: UseFormRegister<ListingFormData>;
  errors: FieldErrors<ListingFormData>;
  control: Control<ListingFormData>;
  setValue: UseFormSetValue<ListingFormData>;
}

const S = {
  HeaderSection: 'text-center md:text-left mb-10',
  Title: 'text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight',
  Subtitle: 'text-gray-500 font-medium',
  Label: 'text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block',
};

/**
 * Last wizard step: pinpoint where the bike/scooter/accessory is located.
 *
 * - The free-text "Adresse" field is optional but recommended; the map
 *   picker reverse-geocodes the dropped pin and prefills it automatically.
 * - Coordinates (latitude / longitude) are persisted on the listing row so
 *   buyers can filter by radius / distance from their own position.
 * - On first render we seed the map with the user's saved profile address /
 *   coordinates (if any) so sellers don't have to repeat themselves.
 */
export const StepLocation = memo(({ register, errors, control, setValue }: StepLocationProps) => {
  const { user } = useUser();
  const lat = useWatch({ control, name: 'latitude' }) as number | null | undefined;
  const lng = useWatch({ control, name: 'longitude' }) as number | null | undefined;
  const address = useWatch({ control, name: 'address' }) as string | undefined;

  // Seed coords + address from the user profile the first time we mount and
  // the form has nothing yet. We only set fields that are still empty so we
  // never clobber a draft the user already populated.
  useEffect(() => {
    if (!user) return;
    if ((lat == null || lng == null) && user.latitude != null && user.longitude != null) {
      setValue('latitude', user.latitude, { shouldValidate: false, shouldDirty: false });
      setValue('longitude', user.longitude, { shouldValidate: false, shouldDirty: false });
    }
    if (!address && user.address) {
      setValue('address', user.address, { shouldValidate: false, shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mapValue: LatLng | null =
    typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;

  const handleMapChange = (coords: LatLng, addr?: string) => {
    setValue('latitude', coords.lat, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', coords.lng, { shouldValidate: true, shouldDirty: true });
    if (addr) {
      setValue('address', addr, { shouldValidate: false, shouldDirty: true });
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={S.HeaderSection}>
        <h2 className={S.Title}>
          <span className="inline-flex items-center gap-2">
            <MapPin size={26} className="text-primary-600" />
            Localisation de l'annonce
          </span>
        </h2>
        <p className={S.Subtitle}>
          Indiquez où se trouve votre véhicule. Les acheteurs pourront vous trouver par
          recherche de proximité.
        </p>
      </div>

      <div>
        <label className={S.Label}>ADRESSE (OPTIONNELLE)</label>
        <Input
          placeholder="Ex: 12 Avenue Habib Bourguiba, Tunis"
          {...register('address')}
          error={(errors as any).address?.message}
          leftIcon={<MapPin size={18} />}
        />
        <p className="text-[11px] font-medium text-gray-400 mt-2 ml-1">
          L'adresse exacte n'est jamais affichée publiquement — seul un repère approximatif
          apparaît sur la carte de l'annonce.
        </p>
      </div>

      <div>
        <label className={S.Label}>POSITION SUR LA CARTE</label>
        <MapPicker
          value={mapValue}
          onChange={handleMapChange}
          defaultAddressQuery={address || ''}
        />
        {(errors as any).latitude?.message && (
          <p className="text-red-500 text-[12px] font-bold mt-2">
            {(errors as any).latitude?.message}
          </p>
        )}
      </div>
    </div>
  );
});

export default StepLocation;
