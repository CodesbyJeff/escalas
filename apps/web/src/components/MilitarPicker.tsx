import { useState } from 'react';
import { Autocomplete } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { militaresApi } from '../lib/api/militares';

export function MilitarPicker({ escalaId, value, onChange }: {
  escalaId: number; value: number | null; onChange: (militarId: number | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const [debounced] = useDebouncedValue(busca, 250);
  const { data = [] } = useQuery({
    queryKey: ['militares', escalaId, debounced],
    queryFn: () => militaresApi.listar(escalaId, debounced || undefined),
  });
  const options = data.map((m) => ({
    value: String(m.id),
    label: `${m.posto ?? ''} ${m.nome}${m.matricula ? ` (${m.matricula})` : ''}`.trim(),
  }));
  const selecionado = value ? options.find((o) => o.value === String(value))?.label ?? busca : busca;
  return (
    <Autocomplete
      placeholder="Buscar militar..."
      data={options}
      value={selecionado}
      onChange={setBusca}
      onOptionSubmit={(val) => onChange(Number(val))}
      onClear={() => onChange(null)}
      clearable
    />
  );
}
