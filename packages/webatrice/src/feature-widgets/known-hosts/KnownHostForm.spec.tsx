import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../__test-utils__';
import { makeHost } from './__mocks__/useKnownHosts';
import { DefaultHosts } from '@app/utils';
import KnownHostForm from './KnownHostForm';
import { buildKnownHostFormSchema } from './knownHostFormSchema';
import type { TFunction } from 'i18next';

const schema = buildKnownHostFormSchema(((key: string) => key) as TFunction);

describe('KnownHostForm desktop port', () => {
  it.each(['', '1', '4747', '65535'])('accepts optional TCP port %s', (desktopPort) => {
    const values = { name: 'Test', host: 'server.example', port: '443', desktopPort };
    expect(schema.parse(values)).toEqual(values);
  });

  it.each(['0', '65536', '-1', '4.5', 'abc', '1e3', ' '])('rejects invalid TCP port %s', (desktopPort) => {
    expect(schema.safeParse({ name: 'Test', host: 'server.example', port: '443', desktopPort }).success).toBe(false);
  });

  it('leaves desktop ports unset on built-in hosts', () => {
    expect(DefaultHosts.every(host => host.desktopPort === undefined)).toBe(true);
  });

  it('loads, edits and clears a saved desktop port on submit', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<KnownHostForm host={makeHost({ desktopPort: '4747', editable: true })} onSubmit={onSubmit} onRemove={vi.fn()} />);
    const field = screen.getByRole('spinbutton', { name: 'KnownHostForm.label.desktopPort' });
    expect(field).toHaveValue(4747);
    expect(field).toHaveAccessibleDescription('KnownHostForm.desktopPortHelp');
    fireEvent.change(field, { target: { value: '5747' } });
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Common.label.saveChanges' })));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ desktopPort: '5747' });
    fireEvent.change(field, { target: { value: '' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Common.label.saveChanges' })));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ desktopPort: '' });
  });
});
