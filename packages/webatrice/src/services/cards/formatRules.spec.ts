import { FormatDTO } from '../dexie';
import { getFormatRules } from './formatRules';

vi.mock('../dexie', () => ({ FormatDTO: { get: vi.fn() } }));

describe('getFormatRules', () => {
  it('looks the trimmed format up in the imported formats', async () => {
    vi.mocked(FormatDTO.get).mockResolvedValue({ formatName: 'Modern' } as never);
    await expect(getFormatRules(' modern ')).resolves.toEqual({ formatName: 'Modern' });
    expect(FormatDTO.get).toHaveBeenCalledWith('modern');
  });

  it('has no rules for an empty format', async () => {
    await expect(getFormatRules('  ')).resolves.toBeUndefined();
    expect(FormatDTO.get).not.toHaveBeenCalled();
  });
});
