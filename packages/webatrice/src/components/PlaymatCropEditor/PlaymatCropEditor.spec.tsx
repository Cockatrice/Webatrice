import { fireEvent, render, screen } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';

import PlaymatCropEditor from './PlaymatCropEditor';

vi.mock('../PlaymatImage/PlaymatImage', () => ({ default: () => null }));

it('exposes all four desktop crop parameters and commits only the changed parameter', () => {
  const onChange = vi.fn();
  render(<PlaymatCropEditor playmat={{ cardName: 'Island', cardProviderId: 'id', params: games.DEFAULT_PLAYMAT_PARAMS }}
    onChange={onChange} />);
  expect(screen.getAllByRole('slider')).toHaveLength(4);
  const zoom = screen.getByRole('slider', { name: 'PlaymatSettings.crop.zoom' });
  expect(zoom).toHaveAttribute('min', '0.1');
  expect(zoom).toHaveAttribute('max', '4');
  fireEvent.change(zoom, { target: { value: '2' } });
  expect(onChange).toHaveBeenCalledWith({ ...games.DEFAULT_PLAYMAT_PARAMS, zoom: 2 });
});
