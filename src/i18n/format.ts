import i18n from './index';

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? 'en';

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value);
}

export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  return new Intl.DateTimeFormat(currentLocale(), options).format(value instanceof Date ? value : new Date(value));
}

export function formatDateTime(value: string | number | Date): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatTime(value: string | number | Date): string {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}
