import type { EscalaDiaDTO } from '@escalas/shared-types';

// Conta as vagas do dia com patente divergente (aviso soft, não bloqueante).
export function contarVagasComAviso(dia: EscalaDiaDTO): number {
  return dia.guarnicoes.flatMap((g) => g.vagas).filter((v) => v.aviso_patente).length;
}
