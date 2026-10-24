import { waitFor } from '@testing-library/react';

import { registerModal } from './modalStack';

it('refreshes isolation for sibling additions but not modal descendant changes', async () => {
  const root = document.createElement('main');
  const background = document.createElement('section');
  const layer = document.createElement('div');
  const modal = document.createElement('div');
  const content = document.createElement('div');
  layer.dataset.modalLayer = '';
  modal.append(content);
  layer.append(modal);
  root.append(background, layer);
  document.body.append(root);

  const release = registerModal(modal);
  const setAttribute = vi.spyOn(background, 'setAttribute');
  try {
    content.append(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve));

    expect(setAttribute).not.toHaveBeenCalledWith('inert', '');

    const lateSibling = document.createElement('aside');
    root.append(lateSibling);
    await waitFor(() => expect(lateSibling).toHaveAttribute('inert'));

    expect(background).toHaveAttribute('inert');
    release();
    expect(background).not.toHaveAttribute('inert');
    expect(lateSibling).not.toHaveAttribute('inert');
  } finally {
    release();
    root.remove();
  }
});

it('leaves exempt siblings such as the toast region live and focusable while a modal is open', () => {
  const toasts = document.createElement('section');
  const toastAction = document.createElement('button');
  const background = document.createElement('main');
  const backgroundButton = document.createElement('button');
  const modal = document.createElement('div');
  toasts.setAttribute('data-modal-exempt', '');
  toasts.append(toastAction);
  background.append(backgroundButton);
  modal.tabIndex = -1;
  document.body.append(background, toasts, modal);

  const release = registerModal(modal);
  try {
    expect(background).toHaveAttribute('inert');
    expect(toasts).not.toHaveAttribute('inert');

    toastAction.focus();
    expect(toastAction).toHaveFocus();

    background.removeAttribute('inert');
    backgroundButton.focus();
    expect(modal).toHaveFocus();
  } finally {
    release();
    background.remove();
    toasts.remove();
    modal.remove();
  }
});
