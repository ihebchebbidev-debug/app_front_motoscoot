import React, { forwardRef, useState } from 'react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { BACK_TO_LIST } from './pickerParts';
import { CC_CUSTOM, CC_OPTIONS, cleanCc, isListedCc } from '../../utils/depositOptions';

/**
 * « Cylindrée » for a moto, scooter or quad: the usual sizes in a list, plus
 * « Autre cylindrée (saisir) » that turns the field into a number field in cc
 * (49, 1250, 2458…), with a link back to the list.
 */

interface CylinderFieldProps {
  name: string;
  value: string;
  onChange: (cc: string) => void;
  onBlur?: () => void;
  error?: string;
}

export const CylinderField = forwardRef<HTMLSelectElement | HTMLInputElement, CylinderFieldProps>(({ name, value, onChange, onBlur, error }, ref) => {
  const [typing, setTyping] = useState(false);
  // A size typed earlier (or restored from a draft) that the list does not hold.
  const custom = typing || (!!value && !isListedCc(value));

  if (custom) {
    return (
      <div className="space-y-2 w-full">
        <Input
          ref={ref as React.Ref<HTMLInputElement>}
          name={name}
          label="Cylindrée"
          placeholder="Ex : 1250"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          enterKeyHint="next"
          autoFocus={typing && !value}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onBlur={(e) => { onChange(cleanCc(e.target.value)); onBlur?.(); }}
          rightIcon={<span aria-hidden="true" className="text-[15px] font-medium text-gray-600">cc</span>}
          error={error}
        />
        <button type="button" className={BACK_TO_LIST} onClick={() => { setTyping(false); onChange(''); }}>
          Choisir dans la liste
        </button>
      </div>
    );
  }

  return (
    <Select
      ref={ref as React.Ref<HTMLSelectElement>}
      name={name}
      label="Cylindrée"
      value={value}
      onChange={(e) => {
        if (e.target.value === CC_CUSTOM) { setTyping(true); onChange(''); return; }
        onChange(e.target.value);
      }}
      onBlur={onBlur}
      error={error}
    >
      <option value="">Choisir la cylindrée</option>
      {CC_OPTIONS.map((cc) => <option key={cc} value={cc}>{cc} cc</option>)}
      {/* Both are stored as no cylinder size (listings.cc is a number). */}
      <option value="Électrique">Électrique</option>
      <option value="Autre">Autre</option>
      <option value={CC_CUSTOM}>Autre cylindrée (saisir)</option>
    </Select>
  );
});

CylinderField.displayName = 'CylinderField';
