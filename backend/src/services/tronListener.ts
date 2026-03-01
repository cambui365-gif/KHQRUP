import { db } from '../config/firebase.js';
import { COLLECTIONS, TransactionStatus, TransactionType, Currency } from '../config/constants.js';
import { WalletRecord } from '../types/index.js';
import { getUSDTBalance } from './walletService.js';

const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

let isRunning = false;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Start listening for USDT deposits on all child wallets
 * Uses polling strategy - checks balances periodically
 * 
 * Production upgrade: Use TronGrid event API or webhooks for real-time detection
 */
export function startTronListener() {
  if (isRunning) return;
  isRunning = true;
  console.log('[TronListener] Started - polling every', POLL_INTERVAL_MS / 1000, 'seconds');
  poll();
}

export function stopTronListener() {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log('[TronListener] Stopped');
}

async function poll() {
  if (!isRunning) return;

  try {
    await checkAllWallets();
  } catch (error) {
    console.error('[TronListener] Poll error:', error);
  }

  pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
}

async function checkAllWallets() {
  const snapshot = await db.collection(COLLECTIONS.WALLETS).get();
  if (snapshot.empty) return;

  const wallets = snapshot.docs.map(doc => doc.data() as WalletRecord);

  for (const wallet of wallets) {
    try {
      const currentBalance = await getUSDTBalance(wallet.address);
      const previousBalance = wallet.balanceOnChain || 0;

      if (currentBalance > previousBalance) {
        const depositAmount = currentBalance - previousBalance;
        console.log(`[TronListener] Deposit detected: ${depositAmount} USDT to ${wallet.address} (User ${wallet.userId})`);

        // Credit user balance
        await creditUserDeposit(wallet.userId, depositAmount, wallet.address);
      }

      // Update on-chain balance
      await db.collection(COLLECTIONS.WALLETS).doc(wallet.address).update({
        balanceOnChain: currentBalance,
        lastChecked: Date.now(),
      });
    } catch (error) {
      console.error(`[TronListener] Error checking wallet ${wallet.address}:`, error);
    }
  }
}

/**
 * Credit USDT deposit to user's internal balance
 */
async function creditUserDeposit(userId: number, amount: number, walletAddress: string) {
  const userRef = db.collection(COLLECTIONS.USERS).doc(userId.toString());
  const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      console.error(`[TronListener] User ${userId} not found`);
      return;
    }

    const userData = userDoc.data()!;
    const newBalance = (userData.balance || 0) + amount;

    transaction.update(userRef, {
      balance: newBalance,
      updatedAt: Date.now(),
    });

    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: TransactionType.DEPOSIT,
      amount,
      currency: Currency.USDT,
      date: new Date().toLocaleString('en-US'),
      timestamp: Date.now(),
      status: TransactionStatus.COMPLETED,
      description: `Auto deposit ${amount} USDT via ${walletAddress}`,
      beforeBalance: userData.balance || 0,
      afterBalance: newBalance,
    });
  });

  console.log(`[TronListener] Credited ${amount} USDT to User ${userId}`);
}
