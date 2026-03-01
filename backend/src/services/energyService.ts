import TronWeb from 'tronweb';
import { db } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';

const TRON_API_URL = process.env.TRON_API_URL || 'https://api.trongrid.io';
const TRON_API_KEY = process.env.TRON_API_KEY || '';
const MOTHER_PRIVATE_KEY = process.env.TRON_MOTHER_PRIVATE_KEY || '';

// Energy needed for 1 USDT TRC-20 transfer
const ENERGY_PER_TRANSFER = 65_000;
// Bandwidth needed
const BANDWIDTH_PER_TRANSFER = 350;

function getMotherTronWeb() {
  return new TronWeb({
    fullHost: TRON_API_URL,
    headers: TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {},
    privateKey: MOTHER_PRIVATE_KEY,
  });
}

export interface EnergyStatus {
  motherAddress: string;
  totalTRX: number;
  stakedForEnergy: number;
  stakedForBandwidth: number;
  availableEnergy: number;
  totalEnergy: number;
  availableBandwidth: number;
  totalBandwidth: number;
  delegatedEnergy: number;
  canConsolidate: number; // How many wallets can be consolidated with current energy
}

/**
 * Get mother wallet energy/resource status
 */
export async function getEnergyStatus(): Promise<EnergyStatus> {
  const tw = getMotherTronWeb();
  const motherAddress = tw.defaultAddress.base58 as string;

  const account = await tw.trx.getAccount(motherAddress);
  const accountResources = await tw.trx.getAccountResources(motherAddress);

  const totalTRX = (account.balance || 0) / 1e6;
  const stakedForEnergy = (account.frozenV2?.find((f: any) => f.type === 'ENERGY')?.amount || 0) / 1e6;
  const stakedForBandwidth = (account.frozenV2?.find((f: any) => !f.type || f.type === 'BANDWIDTH')?.amount || 0) / 1e6;

  const totalEnergy = accountResources.EnergyLimit || 0;
  const usedEnergy = accountResources.EnergyUsed || 0;
  const availableEnergy = totalEnergy - usedEnergy;

  const totalBandwidth = accountResources.freeNetLimit || 0 + (accountResources.NetLimit || 0);
  const usedBandwidth = (accountResources.freeNetUsed || 0) + (accountResources.NetUsed || 0);
  const availableBandwidth = totalBandwidth - usedBandwidth;

  // Count delegated energy
  const delegatedEnergy = accountResources.tronPowerLimit || 0;

  return {
    motherAddress,
    totalTRX,
    stakedForEnergy,
    stakedForBandwidth,
    availableEnergy,
    totalEnergy,
    availableBandwidth,
    totalBandwidth,
    delegatedEnergy,
    canConsolidate: Math.floor(availableEnergy / ENERGY_PER_TRANSFER),
  };
}

/**
 * Stake TRX for energy on mother wallet
 */
export async function stakeForEnergy(amountTRX: number): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const tw = getMotherTronWeb();
    const amountSun = Math.floor(amountTRX * 1e6);

    const tx = await tw.transactionBuilder.freezeBalanceV2(amountSun, 'ENERGY');
    const signed = await tw.trx.sign(tx);
    const result = await tw.trx.sendRawTransaction(signed);

    if (result.result) {
      await logEnergyAction('STAKE', amountTRX, result.txid);
      return { success: true, txId: result.txid };
    }
    return { success: false, error: 'Transaction failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Unstake TRX (recover staked TRX)
 */
export async function unstakeEnergy(amountTRX: number): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const tw = getMotherTronWeb();
    const amountSun = Math.floor(amountTRX * 1e6);

    const tx = await tw.transactionBuilder.unfreezeBalanceV2(amountSun, 'ENERGY');
    const signed = await tw.trx.sign(tx);
    const result = await tw.trx.sendRawTransaction(signed);

    if (result.result) {
      await logEnergyAction('UNSTAKE', amountTRX, result.txid);
      return { success: true, txId: result.txid };
    }
    return { success: false, error: 'Transaction failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Delegate energy from mother wallet to child wallet
 */
export async function delegateEnergy(
  childAddress: string,
  energyAmount: number = ENERGY_PER_TRANSFER,
  lockPeriodMs: number = 0
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const tw = getMotherTronWeb();
    const motherAddress = tw.defaultAddress.base58 as string;

    const tx = await tw.transactionBuilder.delegateResource(
      energyAmount,
      childAddress,
      'ENERGY',
      motherAddress,
      lockPeriodMs > 0, // lock
      lockPeriodMs
    );
    const signed = await tw.trx.sign(tx);
    const result = await tw.trx.sendRawTransaction(signed);

    if (result.result) {
      await logEnergyAction('DELEGATE', energyAmount, result.txid, childAddress);
      return { success: true, txId: result.txid };
    }
    return { success: false, error: 'Delegation failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Reclaim delegated energy from child wallet
 */
export async function reclaimEnergy(
  childAddress: string,
  energyAmount: number = ENERGY_PER_TRANSFER
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    const tw = getMotherTronWeb();
    const motherAddress = tw.defaultAddress.base58 as string;

    const tx = await tw.transactionBuilder.undelegateResource(
      energyAmount,
      childAddress,
      'ENERGY',
      motherAddress
    );
    const signed = await tw.trx.sign(tx);
    const result = await tw.trx.sendRawTransaction(signed);

    if (result.result) {
      await logEnergyAction('RECLAIM', energyAmount, result.txid, childAddress);
      return { success: true, txId: result.txid };
    }
    return { success: false, error: 'Reclaim failed' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Full consolidation flow: delegate energy → transfer USDT → reclaim energy
 */
export async function consolidateWithEnergy(
  childAddress: string,
  usdtAmount: number,
  motherAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; steps: string[] }> {
  const steps: string[] = [];

  try {
    // Step 1: Delegate energy to child
    steps.push('Delegating energy to child wallet...');
    const delegateResult = await delegateEnergy(childAddress, ENERGY_PER_TRANSFER);
    if (!delegateResult.success) {
      return { success: false, error: `Delegate failed: ${delegateResult.error}`, steps };
    }
    steps.push(`Energy delegated (tx: ${delegateResult.txId})`);

    // Wait for delegation to take effect
    await sleep(3000);

    // Step 2: Transfer USDT from child → mother
    steps.push('Transferring USDT from child to mother...');
    const { deriveChildWallet } = await import('./walletService.js');

    const walletDoc = await db.collection(COLLECTIONS.WALLETS).doc(childAddress).get();
    if (!walletDoc.exists) {
      return { success: false, error: 'Wallet record not found', steps };
    }
    const walletData = walletDoc.data()!;
    const { privateKey } = deriveChildWallet(walletData.index);

    const childTronWeb = new TronWeb({
      fullHost: TRON_API_URL,
      headers: TRON_API_KEY ? { 'TRON-PRO-API-KEY': TRON_API_KEY } : {},
      privateKey,
    });

    const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const contract = await childTronWeb.contract().at(USDT_CONTRACT);
    const amountSun = Math.floor(usdtAmount * 1e6);

    const transferTx = await contract.methods.transfer(motherAddress, amountSun).send({
      feeLimit: 100_000_000,
    });
    steps.push(`USDT transferred (tx: ${transferTx})`);

    // Wait for transfer confirmation
    await sleep(5000);

    // Step 3: Reclaim energy
    steps.push('Reclaiming energy...');
    const reclaimResult = await reclaimEnergy(childAddress, ENERGY_PER_TRANSFER);
    if (reclaimResult.success) {
      steps.push(`Energy reclaimed (tx: ${reclaimResult.txId})`);
    } else {
      steps.push(`Energy reclaim failed (will retry later): ${reclaimResult.error}`);
    }

    // Update wallet record
    await db.collection(COLLECTIONS.WALLETS).doc(childAddress).update({
      balanceOnChain: 0,
      isConsolidated: true,
      lastChecked: Date.now(),
    });

    steps.push('Consolidation complete!');
    return { success: true, txHash: transferTx, steps };
  } catch (error: any) {
    steps.push(`Error: ${error.message}`);

    // Try to reclaim energy even if transfer failed
    try {
      await reclaimEnergy(childAddress, ENERGY_PER_TRANSFER);
      steps.push('Energy reclaimed after error');
    } catch { }

    return { success: false, error: error.message, steps };
  }
}

/**
 * Batch consolidation with energy rotation
 */
export async function batchConsolidate(
  wallets: Array<{ address: string; amount: number }>,
  motherAddress: string,
  onProgress?: (msg: string) => void
): Promise<{
  results: Array<{ address: string; success: boolean; txHash?: string; error?: string }>;
  totalConsolidated: number;
}> {
  const results: Array<{ address: string; success: boolean; txHash?: string; error?: string }> = [];
  let totalConsolidated = 0;

  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const msg = `[${i + 1}/${wallets.length}] Consolidating ${wallet.address} (${wallet.amount} USDT)`;
    onProgress?.(msg);

    const result = await consolidateWithEnergy(wallet.address, wallet.amount, motherAddress);
    results.push({
      address: wallet.address,
      success: result.success,
      txHash: result.txHash,
      error: result.error,
    });

    if (result.success) {
      totalConsolidated += wallet.amount;
    }

    // Wait between consolidations for energy recovery
    if (i < wallets.length - 1) {
      onProgress?.('Waiting for energy recovery...');
      await sleep(5000);
    }
  }

  return { results, totalConsolidated };
}

// --- Helpers ---

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function logEnergyAction(action: string, amount: number, txId: string, targetAddress?: string) {
  try {
    await db.collection('energy_logs').add({
      action,
      amount,
      txId,
      targetAddress: targetAddress || null,
      timestamp: Date.now(),
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log energy action:', error);
  }
}
