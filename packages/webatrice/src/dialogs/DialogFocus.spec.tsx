import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../__test-utils__';
import { DialogReturnFocusContext } from '../hooks/useDialogFocus';
import ConfirmDialog from './ConfirmDialog/ConfirmDialog';
import PromptDialog from './PromptDialog/PromptDialog';
import DialogShell from './DialogShell/DialogShell';

it.each(['confirm', 'prompt'])('returns the %s dialog to the loading dialog opener', async (kind) => {
  function Flow() {
    const [stage, setStage] = useState('idle');
    const close = () => setStage('idle');
    return <>
      <button onClick={() => setStage('loading')}>Open</button>
      {stage === 'loading' && <DialogShell isOpen title="Loading">
        <button onClick={() => setStage('ready')}>Complete</button>
      </DialogShell>}
      {kind === 'confirm'
        ? <ConfirmDialog isOpen={stage === 'ready'} title="Confirm" message="Ready" onConfirm={close} onCancel={close} />
        : <PromptDialog isOpen={stage === 'ready'} title="Prompt" label="Value" onSubmit={close} onCancel={close} />}
    </>;
  }
  const user = userEvent.setup();
  renderWithProviders(<Flow />);
  const opener = screen.getByRole('button', { name: 'Open' });
  await user.click(opener);
  await user.click(screen.getByRole('button', { name: 'Complete' }));
  await user.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
});

it.each(['confirm', 'prompt'])('uses the shared return-focus fallback when the %s opener disappears', async (kind) => {
  function Flow({ showOpener = true }: { showOpener?: boolean }) {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    return <DialogReturnFocusContext.Provider value={opener => opener.closest('section')}>
      <section aria-label="Origin">
        {showOpener && <button onClick={() => setOpen(true)}>Open</button>}
      </section>
      {kind === 'confirm'
        ? <ConfirmDialog isOpen={open} title="Confirm" message="Ready" onConfirm={close} onCancel={close} />
        : <PromptDialog isOpen={open} title="Prompt" label="Value" onSubmit={close} onCancel={close} />}
    </DialogReturnFocusContext.Provider>;
  }
  const user = userEvent.setup();
  const { rerender } = renderWithProviders(<Flow />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  rerender(<Flow showOpener={false} />);
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.getByRole('region', { name: 'Origin' })).toHaveFocus());
});
