import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { CardImportDialog } from '@app/feature-widgets/card-import';
import { dexieService } from '@app/services';

import { renderFeatureScreen, simulateLoggedIn } from './helpers';

const oracleCardsXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <info>
    <author>Cockatrice 2.9.0</author>
    <createdAt>2026-05-07T14:32:00Z</createdAt>
  </info>
  <sets>
    <set>
      <name>NEO</name>
      <longname>Kamigawa: Neon Dynasty</longname>
    </set>
  </sets>
  <cards>
    <card>
      <name>Counterspell</name>
      <set>LEA</set>
      <token>0</token>
    </card>
    <card>
      <name>Lightning Bolt</name>
      <set>LEA</set>
      <token>0</token>
    </card>
  </cards>
</cockatrice_carddatabase>`;

function fakeFile(name: string, content: string): File {
  return new File([content], name, { type: 'application/xml' });
}

function dropFiles(dropzone: HTMLElement, files: File[]): void {
  fireEvent.drop(dropzone, { dataTransfer: { files } });
}

beforeEach(async () => {
  vi.useRealTimers();
  simulateLoggedIn();
  await Promise.all([
    dexieService.cards.clear(),
    dexieService.sets.clear(),
    dexieService.tokens.clear(),
    dexieService.formats.clear(),
    dexieService.info.clear(),
  ]);
});

describe('CardImport flow (integration)', () => {
  it('parses a dropped cards.xml file and advances to the review step', async () => {
    const { container } = renderFeatureScreen(<CardImportDialog isOpen handleClose={vi.fn()} />);

    const dropzone = container.ownerDocument.querySelector('.cardImportForm-dropzone') as HTMLElement;
    expect(dropzone).not.toBeNull();

    await act(async () => {
      dropFiles(dropzone, [fakeFile('cards.xml', oracleCardsXml)]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'CardImportForm.button.save' }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('CardImportForm.message.acceptedFiles')).toBeInTheDocument();
    expect(screen.getByText(/Kamigawa: Neon Dynasty/)).toBeInTheDocument();
  });

  it('persists the imported cards to Dexie when Save is clicked', async () => {
    const handleClose = vi.fn();
    const { container } = renderFeatureScreen(
      <CardImportDialog isOpen handleClose={handleClose} />,
    );

    const dropzone = container.ownerDocument.querySelector('.cardImportForm-dropzone') as HTMLElement;
    await act(async () => {
      dropFiles(dropzone, [fakeFile('cards.xml', oracleCardsXml)]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'CardImportForm.button.save' }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'CardImportForm.button.save' }));
    });

    await waitFor(() => {
      expect(screen.queryByText('Failed to save imported data')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'CardImportForm.button.done' }),
      ).toBeInTheDocument();
    }, { timeout: 5000 });

    const stored = await dexieService.cards.toArray();
    expect(stored.map((c: { name: { value: string } }) => c.name.value).sort()).toEqual([
      'Counterspell',
      'Lightning Bolt',
    ]);

    const info = await dexieService.info.get('singleton');
    expect(info?.source).toBe('oracle-local-fs');
  });

  it('surfaces an error when a recognized file contains malformed XML', async () => {
    const { container } = renderFeatureScreen(<CardImportDialog isOpen handleClose={vi.fn()} />);

    const dropzone = container.ownerDocument.querySelector('.cardImportForm-dropzone') as HTMLElement;
    await act(async () => {
      dropFiles(dropzone, [fakeFile('cards.xml', '<not closed')]);
    });

    await waitFor(() => {
      expect(screen.getByText('Cockatrice XML is malformed')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: 'CardImportForm.button.save' }),
    ).not.toBeInTheDocument();

    const stored = await dexieService.cards.toArray();
    expect(stored).toEqual([]);
  });

  it('ingests a valid XML while reporting an unrecognized text file as skipped', async () => {
    const { container } = renderFeatureScreen(<CardImportDialog isOpen handleClose={vi.fn()} />);

    const dropzone = container.ownerDocument.querySelector('.cardImportForm-dropzone') as HTMLElement;
    await act(async () => {
      dropFiles(dropzone, [
        fakeFile('cards.xml', oracleCardsXml),
        fakeFile('notes.txt', 'reminder'),
      ]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'CardImportForm.button.save' }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('CardImportForm.message.acceptedFiles')).toBeInTheDocument();
    expect(screen.getByText('CardImportForm.message.skippedFiles')).toBeInTheDocument();
  });
});
