import { clone } from '@bufbuild/protobuf';

import { ServerInfo_DeckStorage_TreeItemSchema, type ServerInfo_DeckStorage_TreeItem } from '../../generated';

function storedColorIdentity(colorIdentity: string): string {
  let stored = '';
  for (const color of colorIdentity.toUpperCase()) {
    if ('WUBRG'.includes(color) && !stored.includes(color)) {
      stored += color;
    }
  }
  return stored;
}

export function deckUploadedItem(
  newFile: ServerInfo_DeckStorage_TreeItem | undefined,
  colorIdentity: string | undefined,
): ServerInfo_DeckStorage_TreeItem | undefined {
  if (!newFile?.file) {
    return newFile;
  }
  const item = clone(ServerInfo_DeckStorage_TreeItemSchema, newFile);
  item.file!.colorIdentity = storedColorIdentity(colorIdentity ?? '');
  return item;
}
