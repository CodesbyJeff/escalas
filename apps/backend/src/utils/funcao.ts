// Normaliza uma função para comparação: caixa alta, sem acento, espaços colapsados.
export function normalizeFuncao(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}
