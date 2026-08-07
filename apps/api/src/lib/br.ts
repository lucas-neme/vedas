/** Utilidades brasileiras: documentos, dígitos verificadores e formatação. */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number): number => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (length: number): number => {
    let position = length - 7;
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(cnpj[i]) * position;
      position -= 1;
      if (position < 2) position = 9;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function isValidDocument(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

/** Dígito verificador da chave de acesso da NF-e (módulo 11, pesos 2..9). */
export function accessKeyCheckDigit(key43: string): number {
  let weight = 2;
  let sum = 0;
  for (let i = key43.length - 1; i >= 0; i -= 1) {
    sum += Number(key43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const digit = 11 - rest;
  return digit >= 10 ? 0 : digit;
}

export function pad(value: string | number, length: number): string {
  return String(value).replace(/\D+/g, '').padStart(length, '0').slice(-length);
}
