import { downloadBlob } from './downloadBlob';

describe('downloadBlob', () => {
  it('clicks a temporary download link for the data and releases its URL', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:replay');
    const revokeObjectURL = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function assertLink(this: HTMLAnchorElement) {
      expect(this.download).toBe('replay_7.cor');
      expect(this.href).toBe('blob:replay');
      expect(this.isConnected).toBe(true);
    });

    downloadBlob(new Uint8Array([1, 2]), 'replay_7.cor', 'application/octet-stream');

    expect(click).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('application/octet-stream');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:replay');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
