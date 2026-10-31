import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  className?: string;
};

export default function PasswordInput({ id, label, value, onChange, autoComplete, minLength = 8, maxLength = 128, required = true, className = '' }: Props) {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();
  return <div className={className}>
    <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#334c3a]">{label}</label>
    <div className="relative">
      <input id={id} className="field-input pr-12" type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" onClick={() => setVisible((shown) => !shown)} aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} title={t(visible ? 'auth.hidePassword' : 'auth.showPassword')} className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-[#607366] hover:bg-[#eef3ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#537d50]">
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  </div>;
}
