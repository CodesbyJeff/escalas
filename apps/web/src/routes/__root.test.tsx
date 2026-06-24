import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test/render';
import { AppTitle } from './__root';

it('renderiza o título do app', () => {
  renderWithProviders(<AppTitle />);
  expect(screen.getByText('Escalas CBMRN')).toBeInTheDocument();
});
