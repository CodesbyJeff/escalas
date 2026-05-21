export function diasDoMes(mes: number, ano: number): Date[] {
  const qtd = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dias: Date[] = [];
  for (let d = 1; d <= qtd; d++) {
    dias.push(new Date(Date.UTC(ano, mes - 1, d)));
  }
  return dias;
}
