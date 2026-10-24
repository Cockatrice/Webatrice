import { fireEvent, render, screen } from '@testing-library/react';

import { DEFAULT_DECK_TAGS } from '../../deckTags';
import { DeckTagsEditor } from './DeckTagsEditor';

function renderEditor(tags: string[] = ['Aggro', 'Burn']) {
  const onChange = vi.fn();
  const view = render(<DeckTagsEditor tags={tags} onChange={onChange} />);
  return { onChange, input: screen.getByRole('combobox', { name: 'DeckTags.add' }), view };
}

describe('DeckTagsEditor', () => {
  it('lists the tags and removes one', () => {
    const { onChange } = renderEditor();
    expect(screen.getByRole('list', { name: 'DeckTags.label' })).toHaveTextContent('AggroBurn');
    fireEvent.click(screen.getAllByRole('button', { name: 'DeckTags.remove' })[0]);
    expect(onChange).toHaveBeenCalledWith(['Burn']);
  });

  it('adds a trimmed tag on submit and clears the field', () => {
    const { onChange, input } = renderEditor();
    fireEvent.change(input, { target: { value: '  Tokens ' } });
    fireEvent.click(screen.getByRole('button', { name: 'DeckTags.add' }));
    expect(onChange).toHaveBeenCalledWith(['Aggro', 'Burn', 'Tokens']);
    expect(input).toHaveValue('');
  });

  it('refuses empty and duplicate tags with desktop’s messages', () => {
    const { onChange, input } = renderEditor();
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('DeckTags.empty');

    fireEvent.change(input, { target: { value: 'Burn' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('DeckTags.duplicate');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('suggests desktop’s default tags', () => {
    const { view } = renderEditor([]);
    const options = Array.from(view.container.querySelectorAll('datalist option')).map((o) => o.getAttribute('value'));
    expect(options).toEqual([...DEFAULT_DECK_TAGS.filter((t, i) => DEFAULT_DECK_TAGS.indexOf(t) === i)]);
  });
});
