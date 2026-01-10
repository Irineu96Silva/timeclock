/**
 * Utilitários para validação e normalização de CNPJ (Cadastro Nacional de Pessoa Jurídica)
 * CNPJ brasileiro tem 14 dígitos: XX.XXX.XXX/XXXX-XX
 */

/**
 * Remove formatação do CNPJ (pontos, barras, hífens)
 * @param cnpj CNPJ formatado ou não
 * @returns CNPJ apenas com números
 */
export function normalizeCnpj(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  // Remove tudo que não for número
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned || null;
}

/**
 * Valida se o CNPJ tem 14 dígitos (apenas números)
 * @param cnpj CNPJ normalizado (apenas números)
 * @returns true se válido, false caso contrário
 */
export function isValidCnpjLength(cnpj: string | null): boolean {
  if (!cnpj) return false;
  // CNPJ deve ter exatamente 14 dígitos
  return /^\d{14}$/.test(cnpj);
}

/**
 * Valida CNPJ completo (tamanho + dígitos verificadores)
 * @param cnpj CNPJ normalizado (apenas números)
 * @returns true se válido, false caso contrário
 */
export function isValidCnpj(cnpj: string | null): boolean {
  if (!isValidCnpjLength(cnpj)) return false;

  // Remove caracteres não numéricos
  const numbers = cnpj!.replace(/\D/g, "");

  // Verifica se tem 14 dígitos
  if (numbers.length !== 14) return false;

  // Verifica se todos os dígitos são iguais (CNPJs inválidos conhecidos)
  if (/^(\d)\1+$/.test(numbers)) return false;

  // Calcula dígitos verificadores
  let size = numbers.length - 2;
  let sequence = numbers.substring(0, size);
  const digits = numbers.substring(size);
  let sum = 0;
  let pos = size - 7;

  // Primeiro dígito verificador
  for (let i = size; i >= 1; i--) {
    sum += parseInt(sequence.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  // Segundo dígito verificador
  size = size + 1;
  sequence = numbers.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(sequence.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

/**
 * Formata CNPJ para exibição: XX.XXX.XXX/XXXX-XX
 * @param cnpj CNPJ normalizado (apenas números)
 * @returns CNPJ formatado ou null se inválido
 */
export function formatCnpj(cnpj: string | null): string | null {
  if (!cnpj || !isValidCnpjLength(cnpj)) return null;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
