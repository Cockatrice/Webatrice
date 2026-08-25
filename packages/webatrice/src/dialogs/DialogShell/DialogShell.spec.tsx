import { screen, fireEvent } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import DialogShell from './DialogShell';

describe('DialogShell', () => {
  // @critical Regression: a form submit inside a dialog must not bubble through
  // the React tree to an ancestor <form> on the page behind the modal. The
  // dialog portals to document.body, but React dispatches synthetic submit
  // events along the component tree, so without containment the outer form's
  // onSubmit would fire (the "Add Host auto-logs you in" bug).
  it('does not leak a dialog form submit to an ancestor form', () => {
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const innerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    renderWithProviders(
      <form onSubmit={outerSubmit}>
        <DialogShell isOpen title="Add host">
          <form onSubmit={innerSubmit}>
            <button type="submit">Add Host</button>
          </form>
        </DialogShell>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /add host/i }));

    expect(innerSubmit).toHaveBeenCalledTimes(1);
    expect(outerSubmit).not.toHaveBeenCalled();
  });
});
