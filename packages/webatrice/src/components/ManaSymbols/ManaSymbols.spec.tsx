import { render, screen } from '@testing-library/react';

import { ManaSymbols, SymbolText } from './ManaSymbols';

describe('ManaSymbols', () => {
  it('draws each symbol of a cost at the given size', () => {
    render(<ManaSymbols cost="{2}{W/U}" size={11} className="extra" />);
    const symbols = screen.getAllByRole('img');
    expect(symbols.map((img) => img.getAttribute('src'))).toEqual([
      'https://svgs.scryfall.io/card-symbols/2.svg',
      'https://svgs.scryfall.io/card-symbols/WU.svg',
    ]);
    expect(symbols[0]).toHaveStyle({ width: '11px', height: '11px' });
    expect(symbols[0].parentElement).toHaveClass('extra');
  });

  it('renders nothing for an empty cost', () => {
    const { container } = render(<ManaSymbols cost="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SymbolText', () => {
  it('inlines symbols within rules text', () => {
    const { container } = render(<p><SymbolText text="{T}: Add {G}." /></p>);
    expect(container.textContent).toBe(': Add .');
    expect(screen.getAllByRole('img').map((img) => img.getAttribute('alt'))).toEqual(['{T}', '{G}']);
  });
});
