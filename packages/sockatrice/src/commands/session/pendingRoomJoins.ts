export const pendingRoomJoins = new Map<number, boolean>();

export function _resetPendingRoomJoins(): void {
  pendingRoomJoins.clear();
}
