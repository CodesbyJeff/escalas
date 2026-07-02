import { useState } from 'react';
import { Autocomplete, Badge, Group } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import type { MilitarDTO } from '@escalas/shared-types';
import { militaresApi } from '../lib/api/militares';

export function MilitarPicker({ escalaId, value, onChange, patentesEsperadas }: {
  escalaId: number; value: number | null; onChange: (militarId: number | null) => void;
  patentesEsperadas?: number[] | null;
}) {
  const [busca, setBusca] = useState('');
  const [debounced] = useDebouncedValue(busca, 250);
  const { data = [] } = useQuery({
    queryKey: ['militares', escalaId, debounced],
    queryFn: () => militaresApi.listar(escalaId, debounced || undefined),
  });
  const regra = patentesEsperadas ?? null;
  const inelegivel = (m: MilitarDTO) =>
    !!regra && regra.length > 0 && (m.patente_id == null || !regra.includes(m.patente_id));
  const options = [...data]
    .sort((a, b) => Number(inelegivel(a)) - Number(inelegivel(b)))
    .map((m) => ({
      value: String(m.id),
      label: `${inelegivel(m) ? '⚠ ' : ''}${m.patente_sigla ?? ''} ${m.nome}${m.matricula ? ` (${m.matricula})` : ''}`.trim(),
    }));
  const selecionado = value ? options.find((o) => o.value === String(value))?.label ?? busca : busca;
  const militarSelecionado = value ? data.find((m) => m.id === value) : undefined;
  const mostrarAviso = !!militarSelecionado && inelegivel(militarSelecionado);
  return (
    <Group gap="xs" wrap="nowrap">
      <Autocomplete
        placeholder="Buscar militar..."
        data={options}
        value={selecionado}
        onChange={setBusca}
        onOptionSubmit={(val) => onChange(Number(val))}
        onClear={() => onChange(null)}
        clearable
      />
      {mostrarAviso && <Badge color="yellow" variant="light">Patente divergente</Badge>}
    </Group>
  );
}
