import { createContext, useContext, useEffect } from 'react';

export interface BattlefieldGeometry {
  rows: number;
  cols: number;
  colsByWireRow: readonly number[];
}

export interface BattlefieldGeometryRegistry {
  set(playerId: number, geometry: BattlefieldGeometry): void;
  delete(playerId: number): void;
  get(playerId: number): BattlefieldGeometry | undefined;
}

export function createBattlefieldGeometryRegistry(): BattlefieldGeometryRegistry {
  const map = new Map<number, BattlefieldGeometry>();
  return {
    set: (playerId, geometry) => map.set(playerId, geometry),
    delete: (playerId) => map.delete(playerId),
    get: (playerId) => map.get(playerId),
  };
}

export const BattlefieldGeometryContext = createContext<BattlefieldGeometryRegistry | null>(null);

export function useBattlefieldGeometryRegistry(): BattlefieldGeometryRegistry | null {
  return useContext(BattlefieldGeometryContext);
}

export function usePublishBattlefieldGeometry(playerId: number, geometry: BattlefieldGeometry): void {
  const registry = useBattlefieldGeometryRegistry();
  const { rows, cols, colsByWireRow } = geometry;
  const byRow = colsByWireRow.join(',');
  useEffect(() => {
    if (!registry) {
      return undefined;
    }
    registry.set(playerId, { rows, cols, colsByWireRow: byRow.split(',').map(Number) });
    return () => registry.delete(playerId);
  }, [registry, playerId, rows, cols, byRow]);
}
