import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase-Client
vi.mock('./supabase', () => ({
  default: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import supabase from './supabase';
import {
  getAllProducts,
  addProduct,
  getLastEndstandForFridge,
} from './db';

describe('getAllProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt leeres Array zurück wenn keine Produkte', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const result = await getAllProducts();
    expect(result).toEqual([]);
  });

  it('gibt Produkte als camelCase zurück', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 1, name: 'Bier', gebinde: [{ label: '24er', units: 24 }] }],
          error: null,
        }),
      }),
    });
    const result = await getAllProducts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bier');
    expect(result[0].gebinde).toHaveLength(1);
  });
});

describe('addProduct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt die neue ID zurück', async () => {
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 42, name: 'Wein', gebinde: [] },
            error: null,
          }),
        }),
      }),
    });
    const id = await addProduct({ name: 'Wein', gebinde: [] });
    expect(id).toBe(42);
  });
});

describe('getLastEndstandForFridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gibt null zurück wenn keine Sessions', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });
    const result = await getLastEndstandForFridge(1);
    expect(result).toBeNull();
  });

  it('gibt letzte Session mit label=Endstand zurück', async () => {
    const sessionRow = {
      id: 10,
      event_id: 5,
      fridge_id: 1,
      timestamp: 1700000000000,
      label: 'Endstand',
      entries: [],
    };
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [sessionRow], error: null }),
            }),
          }),
        }),
      }),
    });
    const result = await getLastEndstandForFridge(1);
    expect(result).not.toBeNull();
    expect(result.id).toBe(10);
    expect(result.label).toBe('Endstand');
    expect(result.fridgeId).toBe(1);
    expect(result.eventId).toBe(5);
  });
});
