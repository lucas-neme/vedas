const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

export function currency(value: number | string | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

export function decimal(value: number | string | null | undefined): string {
  return numberFormatter.format(Number(value ?? 0));
}

export function percent(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits).replace('.', ',')}%`;
}

export function date(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('pt-BR');
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

/** Máscara de CPF (11) ou CNPJ (14). */
export function formatDocument(value: string | null | undefined): string {
  const digits = onlyDigits(value ?? '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return value ?? '';
}

export function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value ?? '');
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return value ?? '';
}

export function formatZip(value: string | null | undefined): string {
  const digits = onlyDigits(value ?? '');
  if (digits.length === 8) return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
  return value ?? '';
}

/** Chave de acesso da NF-e em blocos de 4 dígitos. */
export function formatAccessKey(value: string): string {
  return (value.match(/.{1,4}/g) ?? []).join(' ');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function whatsappLink(phone: string, message: string): string {
  const digits = onlyDigits(phone);
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
