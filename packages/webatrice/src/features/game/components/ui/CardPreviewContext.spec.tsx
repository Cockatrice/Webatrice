import { act, fireEvent, render, screen } from '@testing-library/react';

import { BigCardPreview } from './BigCardPreview/BigCardPreview';
import {
  CardPreviewProvider,
  createCardPreviewStore,
  useBigPreviewCard,
  useCardInfoRequest,
  useCardPreview,
  useCardPreviewActions,
  type CardPreviewStore,
} from './CardPreviewContext';

const BOLT = { name: 'Lightning Bolt', scryfallId: 'bolt-id' };
const OGRE = { name: 'Gray Ogre', pt: '2/2' };

describe('createCardPreviewStore', () => {
  it('shows the focused card over the hovered one and falls back when focus clears', () => {
    const store = createCardPreviewStore();
    store.setHoveredCard(BOLT);
    expect(store.getPreviewCard()).toBe(BOLT);

    store.setFocusedCard(OGRE);
    expect(store.getPreviewCard()).toBe(OGRE);

    store.setHoveredCard(null);
    expect(store.getPreviewCard()).toBe(OGRE);

    store.setFocusedCard(null);
    store.setHoveredCard(BOLT);
    expect(store.getPreviewCard()).toBe(BOLT);
  });

  it('notifies subscribers only when a card actually changes', () => {
    const store = createCardPreviewStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setHoveredCard(BOLT);
    store.setHoveredCard(BOLT);
    store.closeBigPreview();
    expect(listener).toHaveBeenCalledTimes(1);

    store.openBigPreview(OGRE);
    expect(store.getBigPreviewCard()).toBe(OGRE);
    store.closeBigPreview();
    expect(store.getBigPreviewCard()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    store.setHoveredCard(null);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('keeps the hovered card for the pane when the pointer leaves, but drops its zoom anchor', () => {
    const store = createCardPreviewStore();
    const anchor = { left: 10, top: 20, right: 82, bottom: 122 };
    store.setHoveredCard(BOLT, anchor);
    expect(store.getHoverZoom()).toEqual({ card: BOLT, anchor });

    store.endHover();
    expect(store.getHoverZoom()).toBeNull();
    expect(store.getPreviewCard()).toBe(BOLT);

    store.setHoveredCard(OGRE);
    expect(store.getHoverZoom()).toBeNull();
  });

  it('remembers where a zoom was opened from until it closes', () => {
    const store = createCardPreviewStore();
    const anchor = { left: 10, top: 20, right: 82, bottom: 122 };
    store.openBigPreview(BOLT, anchor);
    expect(store.getBigPreviewAnchor()).toBe(anchor);
    store.closeBigPreview();
    expect(store.getBigPreviewAnchor()).toBeNull();
    store.openBigPreview(OGRE);
    expect(store.getBigPreviewAnchor()).toBeNull();
  });

  it('publishes each showCardInfo call as a new request', () => {
    const store = createCardPreviewStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getCardInfoRequest()).toBeNull();

    store.showCardInfo(BOLT);
    const first = store.getCardInfoRequest();
    expect(first?.card).toBe(BOLT);

    store.showCardInfo(BOLT);
    expect(store.getCardInfoRequest()).not.toBe(first);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('hands each card-info request to the pane once, so a remount does not replay it', () => {
    const store = createCardPreviewStore();
    const onRequest = vi.fn();
    function Pane() {
      useCardInfoRequest(onRequest);
      return null;
    }
    const mount = () => render(<CardPreviewProvider store={store}><Pane /></CardPreviewProvider>);

    const first = mount();
    act(() => store.showCardInfo(BOLT));
    expect(onRequest).toHaveBeenCalledWith(BOLT);
    expect(store.getCardInfoRequest()).toBeNull();
    first.unmount();

    mount();
    expect(onRequest).toHaveBeenCalledTimes(1);
  });

});

describe('CardPreviewContext hooks', () => {
  function Publisher({ renders }: { renders: { count: number } }) {
    renders.count += 1;
    const { setHoveredCard } = useCardPreviewActions();
    return <button onMouseEnter={() => setHoveredCard(BOLT)}>publisher</button>;
  }

  function Reader() {
    const card = useCardPreview();
    return <div data-testid="preview">{card?.name ?? 'none'}</div>;
  }

  function renderWithStore(store: CardPreviewStore, renders: { count: number }) {
    return render(
      <CardPreviewProvider store={store}>
        <Publisher renders={renders} />
        <Reader />
      </CardPreviewProvider>,
    );
  }

  it('updates readers on hover without re-rendering the publishing cards', () => {
    const store = createCardPreviewStore();
    const renders = { count: 0 };
    renderWithStore(store, renders);
    expect(screen.getByTestId('preview')).toHaveTextContent('none');

    fireEvent.mouseEnter(screen.getByText('publisher'));
    expect(screen.getByTestId('preview')).toHaveTextContent('Lightning Bolt');

    for (const card of [OGRE, BOLT, OGRE, null]) {
      act(() => store.setHoveredCard(card));
    }
    expect(screen.getByTestId('preview')).toHaveTextContent('none');
    expect(renders.count).toBe(1);
  });

  it('is inert outside a provider so isolated leaves still render', () => {
    function Isolated() {
      const actions = useCardPreviewActions();
      const card = useCardPreview();
      const big = useBigPreviewCard();
      actions.setHoveredCard(BOLT);
      actions.openBigPreview(BOLT);
      return <div data-testid="isolated">{`${card?.name ?? 'none'}/${big?.name ?? 'none'}`}</div>;
    }
    render(<Isolated />);
    expect(screen.getByTestId('isolated')).toHaveTextContent('none/none');
  });

  it('drops every reader subscription on unmount', () => {
    const store = createCardPreviewStore();
    const live = new Set<() => void>();
    const subscribe = store.subscribe;
    store.subscribe = (listener) => {
      live.add(listener);
      const unsubscribe = subscribe(listener);
      return () => {
        live.delete(listener);
        unsubscribe();
      };
    };
    const { unmount } = renderWithStore(store, { count: 0 });
    expect(live.size).toBeGreaterThan(0);

    unmount();
    expect(live.size).toBe(0);
  });
});

describe('BigCardPreview', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws the zoom for the card in the store and removes it on close', () => {
    const store = createCardPreviewStore();
    render(
      <CardPreviewProvider store={store}>
        <BigCardPreview />
      </CardPreviewProvider>,
    );
    expect(screen.queryByText('Lightning Bolt')).not.toBeInTheDocument();

    act(() => store.openBigPreview(BOLT));
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();
    expect(screen.getByText('CardPreviewPane.loading')).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/bolt-id',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    act(() => store.closeBigPreview());
    expect(screen.queryByText('Lightning Bolt')).not.toBeInTheDocument();
  });

  it('opens the zoom beside the card it came from rather than over it', () => {
    const store = createCardPreviewStore();
    render(
      <CardPreviewProvider store={store}>
        <BigCardPreview />
      </CardPreviewProvider>,
    );
    const anchor = { left: 40, top: 300, right: 112, bottom: 402 };
    act(() => store.openBigPreview(BOLT, anchor));
    const zoom = screen.getByTestId('big-card-preview');
    expect(parseFloat(zoom.style.left)).toBeGreaterThan(anchor.right);
  });
});
