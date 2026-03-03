/**
 * In-memory database for DEMO mode
 * Replaces Firebase Firestore when DEMO_MODE=true
 * Full CRUD with query support
 */

type Doc = Record<string, any>;

class InMemoryCollection {
  private docs: Map<string, Doc> = new Map();
  private autoIdCounter = 0;

  doc(id?: string): InMemoryDocRef {
    const docId = id || `auto_${++this.autoIdCounter}_${Date.now()}`;
    return new InMemoryDocRef(this, docId);
  }

  add(data: Doc): InMemoryDocRef {
    const id = `auto_${++this.autoIdCounter}_${Date.now()}`;
    this.docs.set(id, { ...data, _id: id });
    return new InMemoryDocRef(this, id);
  }

  _get(id: string): Doc | undefined {
    return this.docs.get(id);
  }

  _set(id: string, data: Doc) {
    this.docs.set(id, { ...data });
  }

  _update(id: string, data: Partial<Doc>) {
    const existing = this.docs.get(id);
    if (existing) {
      this.docs.set(id, { ...existing, ...data });
    }
  }

  _delete(id: string) {
    this.docs.delete(id);
  }

  _all(): Array<{ id: string; data: Doc }> {
    return Array.from(this.docs.entries()).map(([id, data]) => ({ id, data }));
  }

  where(field: string, op: string, value: any): InMemoryQuery {
    return new InMemoryQuery(this).where(field, op, value);
  }

  orderBy(field: string, direction: string = 'asc'): InMemoryQuery {
    return new InMemoryQuery(this).orderBy(field, direction);
  }

  limit(n: number): InMemoryQuery {
    return new InMemoryQuery(this).limit(n);
  }

  async get(): Promise<InMemorySnapshot> {
    return new InMemoryQuery(this).get();
  }
}

class InMemoryDocRef {
  constructor(private collection: InMemoryCollection, public id: string) {}

  async get(): Promise<{ exists: boolean; data: () => Doc | undefined; id: string }> {
    const doc = this.collection._get(this.id);
    return {
      exists: !!doc,
      data: () => doc ? { ...doc } : undefined,
      id: this.id,
    };
  }

  async set(data: Doc) {
    this.collection._set(this.id, data);
  }

  async update(data: Partial<Doc>) {
    this.collection._update(this.id, data);
  }

  async delete() {
    this.collection._delete(this.id);
  }
}

class InMemoryQuery {
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private ordering: Array<{ field: string; direction: string }> = [];
  private limitCount: number = Infinity;

  constructor(private collection: InMemoryCollection) {}

  where(field: string, op: string, value: any): InMemoryQuery {
    this.filters.push({ field, op, value });
    return this;
  }

  orderBy(field: string, direction: string = 'asc'): InMemoryQuery {
    this.ordering.push({ field, direction });
    return this;
  }

  limit(n: number): InMemoryQuery {
    this.limitCount = n;
    return this;
  }

  async get(): Promise<InMemorySnapshot> {
    let results = this.collection._all();

    // Apply filters
    for (const filter of this.filters) {
      results = results.filter(({ data }) => {
        const fieldValue = getNestedField(data, filter.field);
        switch (filter.op) {
          case '==': return fieldValue === filter.value;
          case '!=': return fieldValue !== filter.value;
          case '>': return fieldValue > filter.value;
          case '>=': return fieldValue >= filter.value;
          case '<': return fieldValue < filter.value;
          case '<=': return fieldValue <= filter.value;
          case 'in': return Array.isArray(filter.value) && filter.value.includes(fieldValue);
          default: return true;
        }
      });
    }

    // Apply ordering
    for (const order of this.ordering) {
      results.sort((a, b) => {
        const aVal = getNestedField(a.data, order.field) || 0;
        const bVal = getNestedField(b.data, order.field) || 0;
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return order.direction === 'desc' ? -cmp : cmp;
      });
    }

    // Apply limit
    results = results.slice(0, this.limitCount);

    return new InMemorySnapshot(results);
  }
}

class InMemorySnapshot {
  docs: Array<{ id: string; data: () => Doc; ref: { id: string } }>;
  size: number;
  empty: boolean;

  constructor(results: Array<{ id: string; data: Doc }>) {
    this.docs = results.map(r => ({
      id: r.id,
      data: () => ({ ...r.data }),
      ref: { id: r.id },
    }));
    this.size = results.length;
    this.empty = results.length === 0;
  }

  forEach(callback: (doc: { id: string; data: () => Doc; ref: { id: string } }) => void) {
    this.docs.forEach(callback);
  }
}

function getNestedField(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

// --- Transaction support (simplified) ---
class InMemoryTransaction {
  private reads: Map<string, { collection: InMemoryCollection; id: string; data: Doc | undefined }> = new Map();
  private writes: Array<{ type: 'set' | 'update' | 'delete'; collection: InMemoryCollection; id: string; data?: any }> = [];

  async get(ref: InMemoryDocRef): Promise<{ exists: boolean; data: () => Doc | undefined }> {
    const result = await ref.get();
    return result;
  }

  set(ref: InMemoryDocRef, data: Doc) {
    this.writes.push({ type: 'set', collection: (ref as any).collection, id: ref.id, data });
  }

  update(ref: InMemoryDocRef, data: Partial<Doc>) {
    this.writes.push({ type: 'update', collection: (ref as any).collection, id: ref.id, data });
  }

  delete(ref: InMemoryDocRef) {
    this.writes.push({ type: 'delete', collection: (ref as any).collection, id: ref.id });
  }

  _commit() {
    for (const write of this.writes) {
      switch (write.type) {
        case 'set': write.collection._set(write.id, write.data); break;
        case 'update': write.collection._update(write.id, write.data); break;
        case 'delete': write.collection._delete(write.id); break;
      }
    }
  }
}

// --- Main DB class ---
class InMemoryDB {
  private collections: Map<string, InMemoryCollection> = new Map();

  collection(name: string): InMemoryCollection {
    if (!this.collections.has(name)) {
      this.collections.set(name, new InMemoryCollection());
    }
    return this.collections.get(name)!;
  }

  async runTransaction<T>(fn: (transaction: InMemoryTransaction) => Promise<T>): Promise<T> {
    const tx = new InMemoryTransaction();
    const result = await fn(tx);
    tx._commit();
    return result;
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      set: (ref: InMemoryDocRef, data: Doc) => {
        ops.push(() => (ref as any).collection._set(ref.id, data));
      },
      update: (ref: InMemoryDocRef, data: Partial<Doc>) => {
        ops.push(() => (ref as any).collection._update(ref.id, data));
      },
      delete: (ref: InMemoryDocRef) => {
        ops.push(() => (ref as any).collection._delete(ref.id));
      },
      commit: async () => { ops.forEach(op => op()); },
    };
  }
}

export const demoDB = new InMemoryDB();

// Seed demo config
demoDB.collection('config').doc('main').set({
  exchangeRates: { USDT: 1, KHR: 4100, USD: 1, VND: 25000 },
  maintenanceMode: false,
  globalWithdrawEnable: true,
  autoApproveLimit: 50,
  motherWalletAddress: 'TDemoMotherWalletAddress1234567890',
  telegramBotToken: '',
  telegramAdminChatId: '',
  consolidationThreshold: 5,
  interestConfig: {
    isEnabled: true,
    minBalanceToEarn: 10,
    dailyPayoutCap: 1000,
    tiers: [
      { minBalance: 0, maxBalance: 1000, apy: 8.0 },
      { minBalance: 1000, maxBalance: 10000, apy: 4.0 },
      { minBalance: 10000, maxBalance: 999999999, apy: 1.0 },
    ],
  },
});

console.log('📦 Demo in-memory database initialized');
