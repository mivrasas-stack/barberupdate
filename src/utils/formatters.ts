import { CurrencyType } from '../types';

export const COLOMBIA_TIMEZONE = 'America/Bogota';

/**
 * Retorna la fecha actual en Colombia en formato YYYY-MM-DD
 */
export const getColombiaDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Retorna las partes de fecha y hora actuales en Colombia
 */
export const getColombiaTimeParts = (date: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const pick = (k: string) => parts.find(p => p.type === k)?.value || '00';
  const hour = parseInt(pick('hour'), 10);
  const minute = parseInt(pick('minute'), 10);
  const second = parseInt(pick('second'), 10);
  const dateStr = `${pick('year')}-${pick('month')}-${pick('day')}`;
  const timeStr = `${pick('hour')}:${pick('minute')}`;

  return {
    date: dateStr,
    time: timeStr,
    hour,
    minute,
    second,
  };
};

/**
 * Formatea la fecha y hora en vivo de Colombia para cabeceras y relojes
 */
export const formatColombiaLiveClock = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

export const formatCurrency = (amount: number, currency: CurrencyType = 'COP'): string => {
  if (currency === 'COP') {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (currency === 'USD') {
    // Demo rate: 1 USD ~ 4,000 COP
    const inUSD = amount / 4000;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(inUSD);
  }

  if (currency === 'EUR') {
    // Demo rate: 1 EUR ~ 4,300 COP
    const inEUR = amount / 4300;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    }).format(inEUR);
  }

  return `$ ${amount.toLocaleString()}`;
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${minutes} ${ampm}`;
};

export const generatePickupCode = (): string => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `PK-${num}`;
};

export const exportToCSV = (filename: string, rows: Record<string, any>[]): void => {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
