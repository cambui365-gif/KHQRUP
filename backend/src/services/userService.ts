import crypto from 'crypto';
import { db } from '../config/firebase.js';
import { COLLECTIONS, PIN_MAX_ATTEMPTS, TransactionStatus, TransactionType, Currency } from '../config/constants.js';
import { UserProfile, Transaction } from '../types/index.js';
import { createChildWallet } from './walletService.js';

/**
 * Hash PIN with SHA-256
 */
export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

/**
 * Get or create user from Telegram data
 */
export async function getOrCreateUser(telegramUser: {
  id: number;
  first_name: string;
  username?: string;
  photo_url?: string;
}): Promise<UserProfile> {
  const userRef = db.collection(COLLECTIONS.USERS).doc(telegramUser.id.toString());
  const doc = await userRef.get();

  if (doc.exists) {
    return doc.data() as UserProfile;
  }

  // Create child wallet
  const wallet = await createChildWallet(telegramUser.id);

  const newUser: UserProfile = {
    id: telegramUser.id,
    username: telegramUser.username || '',
    firstName: telegramUser.first_name,
    walletAddress: wallet.address,
    walletIndex: wallet.index,
    balance: 0,
    lockedBalance: 0,
    isLocked: false,
    isBlocked: false,
    canWithdraw: true,
    dailyWithdrawLimit: 1000,
    autoApprovalLimit: 0,
    pinHash: '',
    pinAttempts: 0,
    photoUrl: telegramUser.photo_url || '',
    lastInterestClaimDate: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await userRef.set(newUser);
  return newUser;
}

/**
 * Verify user PIN
 */
export async function verifyPin(userId: number, pin: string): Promise<{
  valid: boolean;
  error?: string;
  isLocked?: boolean;
  remainingAttempts?: number;
}> {
  const userRef = db.collection(COLLECTIONS.USERS).doc(userId.toString());

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return { valid: false, error: 'User not found' };

    const user = userDoc.data() as UserProfile;

    if (user.isBlocked) return { valid: false, error: 'Account blocked', isLocked: true };
    if (user.isLocked) return { valid: false, error: 'Account locked due to PIN attempts', isLocked: true };

    const attempts = user.pinAttempts || 0;
    if (attempts >= PIN_MAX_ATTEMPTS) {
      transaction.update(userRef, { isLocked: true });
      return { valid: false, error: 'Account locked', isLocked: true };
    }

    const pinHash = hashPin(pin);
    if (pinHash !== user.pinHash) {
      const newAttempts = attempts + 1;
      const updates: any = { pinAttempts: newAttempts };
      if (newAttempts >= PIN_MAX_ATTEMPTS) {
        updates.isLocked = true;
      }
      transaction.update(userRef, updates);
      return {
        valid: false,
        error: 'Incorrect PIN',
        isLocked: newAttempts >= PIN_MAX_ATTEMPTS,
        remainingAttempts: PIN_MAX_ATTEMPTS - newAttempts,
      };
    }

    // Reset attempts on success
    transaction.update(userRef, { pinAttempts: 0 });
    return { valid: true };
  });
}

/**
 * Set user PIN
 */
export async function setUserPin(userId: number, pin: string): Promise<void> {
  const pinHash = hashPin(pin);
  await db.collection(COLLECTIONS.USERS).doc(userId.toString()).update({
    pinHash,
    pinAttempts: 0,
    updatedAt: Date.now(),
  });
}

/**
 * Calculate daily interest for a user
 */
export function calculateDailyInterest(
  balance: number,
  interestConfig: { isEnabled: boolean; minBalanceToEarn: number; dailyPayoutCap: number; tiers: Array<{ minBalance: number; maxBalance: number; apy: number }> }
): { totalInterest: number; highestApy: number } {
  if (!interestConfig.isEnabled || balance < interestConfig.minBalanceToEarn) {
    return { totalInterest: 0, highestApy: 0 };
  }

  let applicableApy = 0;
  for (const tier of interestConfig.tiers) {
    if (balance >= tier.minBalance && balance < tier.maxBalance) {
      applicableApy = tier.apy;
      break;
    }
  }

  if (applicableApy === 0) return { totalInterest: 0, highestApy: 0 };

  let dailyInterest = (balance * (applicableApy / 100)) / 365;
  if (dailyInterest > interestConfig.dailyPayoutCap) {
    dailyInterest = interestConfig.dailyPayoutCap;
  }

  return { totalInterest: dailyInterest, highestApy: applicableApy };
}

/**
 * Claim daily interest
 */
export async function claimDailyInterest(userId: number, interestConfig: any): Promise<{ success: boolean; amount?: number; error?: string }> {
  const today = new Date().toISOString().split('T')[0];
  const userRef = db.collection(COLLECTIONS.USERS).doc(userId.toString());
  const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();

  return db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return { success: false, error: 'User not found' };

    const user = userDoc.data() as UserProfile;
    if (user.lastInterestClaimDate === today) {
      return { success: false, error: 'Already claimed today' };
    }

    const { totalInterest } = calculateDailyInterest(user.balance, interestConfig);
    if (totalInterest <= 0) return { success: false, error: 'No interest to claim' };

    const newBalance = user.balance + totalInterest;
    transaction.update(userRef, {
      balance: newBalance,
      lastInterestClaimDate: today,
      updatedAt: Date.now(),
    });

    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: TransactionType.INTEREST,
      amount: totalInterest,
      currency: Currency.USDT,
      date: new Date().toLocaleString('en-US'),
      timestamp: Date.now(),
      status: TransactionStatus.COMPLETED,
      description: `Daily interest (${today})`,
      beforeBalance: user.balance,
      afterBalance: newBalance,
    });

    return { success: true, amount: totalInterest };
  });
}
