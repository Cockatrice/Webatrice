import { FormatDTO, type Format } from '../dexie';

export async function getFormatRules(formatName: string): Promise<Format | undefined> {
  if (!formatName.trim()) {
    return undefined;
  }
  return FormatDTO.get(formatName.trim());
}
