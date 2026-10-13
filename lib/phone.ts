// Telefonos con clave de pais. Se guardan como "+52 9611234567".
// Los telefonos anteriores (solo digitos) se interpretan como Mexico.

export interface Country {
  code: string; // ISO (MX, US...)
  name: string;
  dial: string; // sin "+"
  flag: string;
  min: number; // digitos del numero nacional
  max: number;
}

export const COUNTRIES: Country[] = [
  { code: 'MX', name: 'México', dial: '52', flag: '🇲🇽', min: 10, max: 10 },
  { code: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸', min: 10, max: 10 },
  { code: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦', min: 10, max: 10 },
  { code: 'GT', name: 'Guatemala', dial: '502', flag: '🇬🇹', min: 8, max: 8 },
  { code: 'SV', name: 'El Salvador', dial: '503', flag: '🇸🇻', min: 8, max: 8 },
  { code: 'HN', name: 'Honduras', dial: '504', flag: '🇭🇳', min: 8, max: 8 },
  { code: 'NI', name: 'Nicaragua', dial: '505', flag: '🇳🇮', min: 8, max: 8 },
  { code: 'CR', name: 'Costa Rica', dial: '506', flag: '🇨🇷', min: 8, max: 8 },
  { code: 'PA', name: 'Panamá', dial: '507', flag: '🇵🇦', min: 8, max: 8 },
  { code: 'BZ', name: 'Belice', dial: '501', flag: '🇧🇿', min: 7, max: 7 },
  { code: 'CU', name: 'Cuba', dial: '53', flag: '🇨🇺', min: 8, max: 8 },
  { code: 'DO', name: 'República Dominicana', dial: '1', flag: '🇩🇴', min: 10, max: 10 },
  { code: 'PR', name: 'Puerto Rico', dial: '1', flag: '🇵🇷', min: 10, max: 10 },
  { code: 'CO', name: 'Colombia', dial: '57', flag: '🇨🇴', min: 10, max: 10 },
  { code: 'VE', name: 'Venezuela', dial: '58', flag: '🇻🇪', min: 10, max: 10 },
  { code: 'EC', name: 'Ecuador', dial: '593', flag: '🇪🇨', min: 9, max: 9 },
  { code: 'PE', name: 'Perú', dial: '51', flag: '🇵🇪', min: 9, max: 9 },
  { code: 'BO', name: 'Bolivia', dial: '591', flag: '🇧🇴', min: 8, max: 8 },
  { code: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱', min: 9, max: 9 },
  { code: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷', min: 10, max: 10 },
  { code: 'UY', name: 'Uruguay', dial: '598', flag: '🇺🇾', min: 8, max: 8 },
  { code: 'PY', name: 'Paraguay', dial: '595', flag: '🇵🇾', min: 9, max: 9 },
  { code: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷', min: 10, max: 11 },
  { code: 'ES', name: 'España', dial: '34', flag: '🇪🇸', min: 9, max: 9 },
  { code: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹', min: 9, max: 9 },
  { code: 'FR', name: 'Francia', dial: '33', flag: '🇫🇷', min: 9, max: 9 },
  { code: 'IT', name: 'Italia', dial: '39', flag: '🇮🇹', min: 9, max: 10 },
  { code: 'DE', name: 'Alemania', dial: '49', flag: '🇩🇪', min: 10, max: 11 },
  { code: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧', min: 10, max: 10 },
  { code: 'NL', name: 'Países Bajos', dial: '31', flag: '🇳🇱', min: 9, max: 9 },
  { code: 'CH', name: 'Suiza', dial: '41', flag: '🇨🇭', min: 9, max: 9 },
  { code: 'CN', name: 'China', dial: '86', flag: '🇨🇳', min: 11, max: 11 },
  { code: 'JP', name: 'Japón', dial: '81', flag: '🇯🇵', min: 10, max: 10 },
  { code: 'KR', name: 'Corea del Sur', dial: '82', flag: '🇰🇷', min: 9, max: 10 },
  { code: 'IN', name: 'India', dial: '91', flag: '🇮🇳', min: 10, max: 10 },
  { code: 'AU', name: 'Australia', dial: '61', flag: '🇦🇺', min: 9, max: 9 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

export function countryByCode(code: string | null | undefined) {
  return COUNTRIES.find((c) => c.code === code) ?? DEFAULT_COUNTRY;
}

/**
 * "+52 9611234567" -> { country: MX, national: "9611234567" }.
 * Sin "+" (telefonos anteriores): se toma como Mexico.
 * `prefer` decide entre paises que comparten clave (+1: EE. UU., Canada...).
 */
export function parsePhone(value: string | null | undefined, prefer?: string): { country: Country; national: string } {
  const raw = (value ?? '').trim();
  if (!raw.startsWith('+')) {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
    return { country: DEFAULT_COUNTRY, national: digits };
  }
  const digits = raw.replace(/\D/g, '');
  // Clave mas larga que coincida (502 antes que 5...)
  const matches = COUNTRIES.filter((c) => digits.startsWith(c.dial)).sort((a, b) => b.dial.length - a.dial.length);
  if (!matches.length) return { country: DEFAULT_COUNTRY, national: digits };
  const dial = matches[0].dial;
  const sameDial = matches.filter((c) => c.dial === dial);
  const country = sameDial.find((c) => c.code === prefer) ?? sameDial[0];
  return { country, national: digits.slice(dial.length) };
}

/** Valor a guardar: "+52 9611234567" (o "" si no hay numero). */
export function formatPhone(country: Country, national: string) {
  const digits = national.replace(/\D/g, '').slice(0, country.max);
  return digits ? `+${country.dial} ${digits}` : '';
}

/** Mensaje si el numero esta incompleto (o null si esta bien / vacio). */
export function phoneError(value: string | null | undefined): string | null {
  if (!value) return null;
  const { country, national } = parsePhone(value);
  if (national.length < country.min) {
    const missing = country.min - national.length;
    return `Faltan ${missing} dígito${missing === 1 ? '' : 's'} (${country.name} usa ${country.min})`;
  }
  if (national.length > country.max) return `Máximo ${country.max} dígitos para ${country.name}`;
  return null;
}
