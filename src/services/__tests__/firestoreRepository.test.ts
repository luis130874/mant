import { describe, expect, it, vi } from 'vitest';
import {
  checkModuloCapacity,
  estimatePayloadBytes,
  FIRESTORE_HARD_LIMIT_BYTES,
  FIRESTORE_MAX_MODULO_ITEMS,
  FIRESTORE_SOFT_WARN_BYTES,
} from '../firestoreRepository';

describe('firestoreRepository capacity guardrails', () => {
  it('estimates UTF-8 payload sizes accurately', () => {
    const bytes = estimatePayloadBytes([{ nombre: 'Bomba Centrífuga', codigo: 'B-01' }]);
    expect(bytes).toBeGreaterThan(40);
    expect(bytes).toBeLessThan(120);
  });

  it('emits soft warning above FIRESTORE_SOFT_WARN_BYTES without throwing', () => {
    const onWarn = vi.fn();
    const bigString = 'x'.repeat(Math.ceil((FIRESTORE_SOFT_WARN_BYTES + 10_000) / 1));
    checkModuloCapacity([{ payload: bigString }], 'historial', onWarn);
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onWarn.mock.calls[0][0]).toContain('historial');
  });

  it('throws before exceeding the 1 MiB Firestore document limit', () => {
    const tooBig = 'x'.repeat(FIRESTORE_HARD_LIMIT_BYTES + 5_000);
    expect(() => checkModuloCapacity([{ payload: tooBig }], 'equipos')).toThrow(/1 MiB/);
  });

  it('throws when array exceeds FIRESTORE_MAX_MODULO_ITEMS', () => {
    const many = Array.from({ length: FIRESTORE_MAX_MODULO_ITEMS + 1 }, (_, i) => i);
    expect(() => checkModuloCapacity(many, 'movimientosRepuestos')).toThrow(/superó el límite/);
  });
});
