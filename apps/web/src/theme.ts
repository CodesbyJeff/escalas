import { createTheme, type MantineColorsTuple } from '@mantine/core';

const cbmrnRed: MantineColorsTuple = [
  '#ffeaea', '#fdd5d5', '#f3acac', '#ea7f7f', '#e35a5a',
  '#df4242', '#de3535', '#c52729', '#b01f24', '#9a141d',
];

export const theme = createTheme({
  primaryColor: 'cbmrn',
  colors: { cbmrn: cbmrnRed },
  fontFamily: 'system-ui, sans-serif',
  defaultRadius: 'md',
});
