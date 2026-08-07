/** Construtor de XML minimalista, suficiente para o layout da NF-e 4.00. */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Remove acentos e caracteres não aceitos pela SEFAZ. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ASCII = new RegExp('[^\\x20-\\x7E]', 'g');

export function sanitizeText(value: string, maxLength = 60): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(NON_ASCII, '')
    .trim()
    .slice(0, maxLength);
}

export type XmlNode = string | null | undefined | false;

export function tag(name: string, value: XmlNode): string {
  if (value === null || value === undefined || value === false || value === '') return '';
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

export function group(
  name: string,
  children: string[],
  attributes?: Record<string, string>,
): string {
  const content = children.filter(Boolean).join('');
  if (!content) return '';
  const attrs = attributes
    ? Object.entries(attributes)
        .map(([key, val]) => ` ${key}="${escapeXml(val)}"`)
        .join('')
    : '';
  return `<${name}${attrs}>${content}</${name}>`;
}
