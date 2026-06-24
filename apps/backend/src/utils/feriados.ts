export type FeriadoNacionalTipo = 'nacional' | 'facultativo';

export interface FeriadoNacional {
  data: Date;
  descricao: string;
  tipo: FeriadoNacionalTipo;
}

/** Calcula a data da Páscoa pelo algoritmo de Meeus/Jones/Butcher (Gregoriano). */
function calcularPascoa(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/** Adiciona (ou subtrai, se negativo) dias a uma data UTC. */
function addDias(date: Date, dias: number): Date {
  return new Date(date.getTime() + dias * 86_400_000);
}

/**
 * Retorna os feriados nacionais brasileiros do ano, ordenados por data ascendente.
 * Inclui fixos + móveis (derivados da Páscoa). Não inclui feriados estaduais/municipais.
 */
export function feriadosBrasil(year: number): FeriadoNacional[] {
  const feriados: FeriadoNacional[] = [];

  const add = (mes: number, dia: number, descricao: string, tipo: FeriadoNacionalTipo) => {
    feriados.push({ data: new Date(Date.UTC(year, mes - 1, dia)), descricao, tipo });
  };

  // Feriados fixos — nacionais
  add(1, 1, 'Confraternização Universal', 'nacional');
  add(4, 21, 'Tiradentes', 'nacional');
  add(5, 1, 'Dia do Trabalho', 'nacional');
  add(9, 7, 'Independência do Brasil', 'nacional');
  add(10, 12, 'Nossa Senhora Aparecida', 'nacional');
  add(11, 2, 'Finados', 'nacional');
  add(11, 15, 'Proclamação da República', 'nacional');

  // Dia da Consciência Negra — nacional apenas a partir de 2024 (Lei 14.759/2023)
  if (year >= 2024) {
    add(11, 20, 'Dia da Consciência Negra', 'nacional');
  }

  add(12, 25, 'Natal', 'nacional');

  // Feriados móveis — derivados da Páscoa
  const pascoa = calcularPascoa(year);

  feriados.push({
    data: addDias(pascoa, -48),
    descricao: 'Segunda-feira de Carnaval',
    tipo: 'facultativo',
  });
  feriados.push({
    data: addDias(pascoa, -47),
    descricao: 'Terça-feira de Carnaval',
    tipo: 'facultativo',
  });
  feriados.push({
    data: addDias(pascoa, -2),
    descricao: 'Sexta-feira Santa',
    tipo: 'nacional',
  });
  feriados.push({
    data: addDias(pascoa, 60),
    descricao: 'Corpus Christi',
    tipo: 'facultativo',
  });

  // Ordena por data ascendente
  feriados.sort((a, b) => a.data.getTime() - b.data.getTime());

  return feriados;
}
