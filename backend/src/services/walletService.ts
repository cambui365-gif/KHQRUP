import TronWeb from 'tronweb';
import * as bip39 from 'bip39';
import HDKey from 'hdkey';
import { db } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';
import { WalletRecord } from '../types/index.js';

const TRON_API_URL = process.env.TRON_API_URL || 'https://api.trongrid.io';
const TRON_API_KEY = process.env.TRON_API_KEY || '';
const MASTER_MNEMONIC = process.env.TRON_MASTER_MNEMONIC || '';

// USDT-TRC20 Contract Address (Mainnet)
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// HD Derivation path: m/44'/195'/0'/0/{index}
// 195 = TRON coin type
const HD_PATH = "m/44'/195'/0'/0";

const tronWeb = new TronWeb({
  fullHost: TRON_API_URL,
  headers: TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {},
});

/**
 * Derive child wallet from master mnemonic
 */
export function deriveChildWallet(index: number): { address: string; privateKey: string } {
  if (!MASTER_MNEMONIC) {
    throw new Error('TRON_MASTER_MNEMONIC not configured');
  }

  const seed = bip39.mnemonicToSeedSync(MASTER_MNEMONIC);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive(`${HD_PATH}/${index}`);
  const privateKey = child.privateKey!.toString('hex');
  const address = tronWeb.address.fromPrivateKey(privateKey);

  return { address, privateKey };
}

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
  try {
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const balance = await contract.methods.balanceOf(address).call();
    // USDT has 6 decimals
    return Number(balance) / 1e6;
  } catch (error) {
    console.error(`Failed to get balance for ${address}:`, error);
    return 0;
  }
}

/**
 * Consolidate (sweep) USDT from child wallet to mother wallet
 */
export async function consolidateWallet(
  childAddress: string,
  motherAddress: string,
  amount: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Get child wallet private key
    const walletDoc = await db.collection(COLLECTIONS.WALLETS).doc(childAddress).get();
    if (!walletDoc.exists) return { success: false, error: 'Wallet not found' };

    const walletData = walletDoc.data() as WalletRecord;
    const { privateKey } = deriveChildWallet(walletData.index);

    // Create TronWeb instance with child's private key
    const childTronWeb = new TronWeb({
      fullHost: TRON_API_URL,
      headers: TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {},
      privateKey,
    });

    const contract = await childTronWeb.contract().at(USDT_CONTRACT);
    const amountSun = Math.floor(amount * 1e6);

    const tx = await contract.methods.transfer(motherAddress, amountSun).send({
      feeLimit: 100_000_000, // 100 TRX max fee
    });

    // Update wallet record
    await db.collection(COLLECTIONS.WALLETS).doc(childAddress).update({
      isConsolidated: true,
      lastChecked: Date.now(),
    });

    return { success: true, txHash: tx };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all child wallets with balances
 */
export async function getAllWallets(): Promise<WalletRecord[]> {
  const snapshot = await db.collection(COLLECTIONS.WALLETS).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => doc.data() as WalletRecord);
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
  const balance = await getUSDTBalance(address);
  await db.collection(COLLECTIONS.WALLETS).doc(address).update({
    balanceOnChain: balance,
    lastChecked: Date.now(),
  });
  return balance;
}
