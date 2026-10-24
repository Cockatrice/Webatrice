import { vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../__test-utils__';
import LogSearchForm from './LogSearchForm';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

function renderForm(developer = false) {
  const onSubmit = vi.fn();
  renderWithProviders(<LogSearchForm onSubmit={onSubmit} developer={developer} />, { preloadedState: disconnectedState });
  return onSubmit;
}

async function type(label: string, value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'LogSearchForm.button.search' }));
  });
  await flush();
}

describe('LogSearchForm', () => {
  it('renders desktop\'s filters, locations, date range and maximum', () => {
    renderForm();
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'LogSearchForm.button.clear' })).toBeInTheDocument();
  });

  it('completes an under-specified search the way desktop does', async () => {
    const onSubmit = renderForm();
    await type('LogSearchForm.label.userName', 'searchUser');
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      userName: 'searchUser',
      dateRange: 'pastDays',
      pastDays: 20,
      logLocation: { room: true, game: true, chat: true },
      maximumResults: 1000,
    });
    expect(screen.getByLabelText('LogSearchForm.label.days')).toHaveValue(20);
    expect(screen.getByRole('radio', { name: 'LogSearchForm.label.pastDays' })).toBeChecked();
  });

  it('hides the IP filter and Private Chat for the developer family, as desktop TabLog does', async () => {
    const onSubmit = renderForm(true);
    expect(screen.queryByLabelText('LogSearchForm.label.ipAddress')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);

    await type('LogSearchForm.label.userName', 'searchUser');
    await submit();

    expect(onSubmit.mock.calls[0][0].logLocation).toEqual({ room: true, game: true, chat: false });
  });

  it('keeps an explicit location, range and maximum', async () => {
    const onSubmit = renderForm();
    await type('LogSearchForm.label.gameId', '42');
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'LogSearchForm.label.games' }));
      fireEvent.click(screen.getByRole('radio', { name: 'LogSearchForm.label.lastHour' }));
    });
    await type('LogSearchForm.label.maximumResults', '25');
    await submit();

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      gameId: '42',
      dateRange: 'lastHour',
      logLocation: { room: false, game: true, chat: false },
      maximumResults: 25,
    });
  });

  it('refuses a search without any filter', async () => {
    const onSubmit = renderForm();
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('LogSearchForm.error.noFilter');
  });

  it('refuses "past X days" with zero days', async () => {
    const onSubmit = renderForm();
    await type('LogSearchForm.label.message', 'hello');
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'LogSearchForm.label.pastDays' }));
    });
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('LogSearchForm.error.noDays');
  });

  it('clamps the spin boxes to desktop\'s ranges', async () => {
    renderForm();
    await type('LogSearchForm.label.days', '99');
    await type('LogSearchForm.label.maximumResults', '5000');
    expect(screen.getByLabelText('LogSearchForm.label.days')).toHaveValue(20);
    expect(screen.getByLabelText('LogSearchForm.label.maximumResults')).toHaveValue(1000);
  });

  it('clears every filter', async () => {
    renderForm();
    await type('LogSearchForm.label.userName', 'someone');
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'LogSearchForm.label.today' }));
      fireEvent.click(screen.getByRole('button', { name: 'LogSearchForm.button.clear' }));
    });
    expect(screen.getByLabelText('LogSearchForm.label.userName')).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'LogSearchForm.label.today' })).not.toBeChecked();
  });
});
