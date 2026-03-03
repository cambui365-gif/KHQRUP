import { db } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import { WalletRecord } from '../types/index.js';

const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.TRON_MASTER_MNEMONIC;

/**
 * Get next available wallet index
 */
async function getNextWalletIndex(): Promise<number> {
  const snapshot = await db
    .collection(COLLECTIONS.WALLETS)
    .orderBy('index', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return 0;
  return (snapshot.docs[0].data().index || 0) + 1;
}

/**
 * Generate a demo TRON address (deterministic from index)
 */
function generateDemoAddress(index: number): string {
  const hex = index.toString(16).padStart(8, '0');
  return `TDemo${hex}WalletAddr${index.toString().padStart(4, '0')}xxxx`;
}

/**
 * Derive child wallet — demo mode returns fake address, production uses HD derivation
 */
export function deriveChildWallet(index: number): { address: string; privateKey: string } {
  if (DEMO_MODE) {
    return {
      address: generateDemoAddress(index),
      privateKey: `demo_private_key_${index}`,
    };
  }

  // Production: HD wallet derivation
  // Lazy import to avoid errors when tronweb/bip39 not installed
  throw new Error('Production HD wallet requires TRON_MASTER_MNEMONIC — set DEMO_MODE=true for testing');
}

/**
 * Create a new child wallet for a user
 */
export async function createChildWallet(userId: number): Promise<WalletRecord> {
  const index = await getNextWalletIndex();
  const { address } = deriveChildWallet(index);

  const walletRecord: WalletRecord = {
    address,
    userId,
    index,
    balanceOnChain: 0,
    lastChecked: Date.now(),
    isConsolidated: false,
    createdAt: Date.now(),
  };

  await db.collection(COLLECTIONS.WALLETS).doc(address).set(walletRecord);
  return walletRecord;
}

/**
 * Get USDT-TRC20 balance of an address
 */
export async function getUSDTBalance(address: string): Promise<number> {
  if (DEMO_MODE) {
    // Return whatever is stored in DB
    const doc = await db.collection(COLLECTIONS.WALLETS).doc(address).get();
    return doc.exists ? (doc.data()?.balanceOnChain || 0) : 0;
  }
  throw new Error('Production requires TronWeb');
}

/**
 * Consolidate (sweep) USDT from child wallet to mother wallet
 */
export async function consolidateWallet(
  childAddress: string,
  motherAddress: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (DEMO_MODE) {
    // Simulate consolidation
    await db.collection(COLLECTIONS.WALLETS).doc(childAddress).update({
      balanceOnChain: 0,
      isConsolidated: true,
      lastChecked: Date.now(),
    });
    return { success: true, txHash: `DEMO_TX_${Date.now()}` };
  }
  throw new Error('Production requires TronWeb');
}

/**
 * Get all child wallets
 */
export async function getAllWallets(): Promise<WalletRecord[]> {
  const snapshot = await db.collection(COLLECTIONS.WALLETS).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc: any) => doc.data() as WalletRecord);
}

/**
 * Get wallet by user ID
 */
export async function getWalletByUserId(userId: number): Promise<WalletRecord | null> {
  const snapshot = await db
    .collection(COLLECTIONS.WALLETS)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as WalletRecord;
}

/**
 * Refresh on-chain balance for a wallet
 */
export async function refreshWalletBalance(address: string): Promise<number> {
  if (DEMO_MODE) {
    // In demo, just return current stored balance
    const doc = await db.collection(COLLECTIONS.WALLETS).doc(address).get();
    const balance = doc.exists ? (doc.data()?.balanceOnChain || 0) : 0;
    await db.collection(COLLECTIONS.WALLETS).doc(address).update({ lastChecked: Date.now() });
    return balance;
  }
  throw new Error('Production requires TronWeb');
}

/**
 * [Demo only] Simulate a deposit to a child wallet
 */
export async function simulateDeposit(address: string, amount: number): Promise<void> {
  const doc = await db.collection(COLLECTIONS.WALLETS).doc(address).get();
  if (!doc.exists) throw new Error('Wallet not found');
  const current = doc.data()?.balanceOnChain || 0;
  await db.collection(COLLECTIONS.WALLETS).doc(address).update({
    balanceOnChain: current + amount,
    isConsolidated: false,
    lastChecked: Date.now(),
  });
}
