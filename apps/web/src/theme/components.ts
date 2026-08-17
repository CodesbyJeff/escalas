import {
  Badge, Button, Card, Modal, NumberInput, Select, Table, TextInput, Title,
} from '@mantine/core';

/**
 * Defaults por componente — a alavanca do redesign.
 *
 * NÃO estender `Paper`: Modal.Content, Popover.Dropdown e Menu.Dropdown são
 * construídos sobre Paper internamente, e um `withBorder` global colocaria
 * borda em toda sobreposição do sistema. Card é seguro; Paper não é.
 */
export const componentes = {
  Button: Button.extend({
    defaultProps: { radius: 'sm' },
    styles: { root: { fontWeight: 600 } },
  }),

  Card: Card.extend({
    defaultProps: { withBorder: true, radius: 'sm', shadow: undefined, padding: 'md' },
  }),

  Badge: Badge.extend({
    defaultProps: { variant: 'light', radius: 'sm' },
    styles: { label: { textTransform: 'none', fontWeight: 600 } },
  }),

  Table: Table.extend({
    defaultProps: { highlightOnHover: true, verticalSpacing: 'xs', horizontalSpacing: 'sm' },
  }),

  TextInput: TextInput.extend({ defaultProps: { size: 'sm' } }),
  Select: Select.extend({ defaultProps: { size: 'sm' } }),
  NumberInput: NumberInput.extend({ defaultProps: { size: 'sm' } }),

  Modal: Modal.extend({ defaultProps: { centered: true, radius: 'md' } }),

  Title: Title.extend({ defaultProps: { textWrap: 'balance' } }),
};
