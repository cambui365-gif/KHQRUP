import { db } from '../config/firebase.js';
import { COLLECTIONS } from '../config/constants.js';

const DEMO_MODE = process.env.DEMO_MODE === 'true' || !process.env.TRON_MOTHER_PRIVATE_KEY;
const ENERGY_PER_TRANSFER = 65_000;

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
  canConsolidate: number;
}

// Demo state
let demoState = {
  totalTRX: 5000,
  stakedForEnergy: 260,
  availableEnergy: 650000,
  totalEnergy: 650000,
};

export async function getEnergyStatus(): Promise<EnergyStatus> {
  if (DEMO_MODE) {
    return {
      motherAddress: 'TDemoMotherWalletAddress1234567890',
      totalTRX: demoState.totalTRX,
      stakedForEnergy: demoState.stakedForEnergy,
      stakedForBandwidth: 0,
      availableEnergy: demoState.availableEnergy,
      totalEnergy: demoState.totalEnergy,
      availableBandwidth: 5000,
      totalBandwidth: 5000,
      delegatedEnergy: 0,
      canConsolidate: Math.floor(demoState.availableEnergy / ENERGY_PER_TRANSFER),
    };
  }
  throw new Error('Production requires TronWeb');
}

export async function stakeForEnergy(amountTRX: number): Promise<{ success: boolean; txId?: string; error?: string }> {
  if (DEMO_MODE) {
    if (amountTRX > demoState.totalTRX) return { success: false, error: 'Insufficient TRX' };
    demoState.totalTRX -= amountTRX;
    demoState.stakedForEnergy += amountTRX;
    demoState.availableEnergy += Math.floor(amountTRX * 2500);
    demoState.totalEnergy += Math.floor(amountTRX * 2500);
    await logEnergyAction('STAKE', amountTRX, `DEMO_STAKE_${Date.now()}`);
    return { success: true, txId: `DEMO_STAKE_${Date.now()}` };
  }
  throw new Error('Production requires TronWeb');
}

export async function unstakeEnergy(amountTRX: number): Promise<{ success: boolean; txId?: string; error?: string }> {
  if (DEMO_MODE) {
    if (amountTRX > demoState.stakedForEnergy) return { success: false, error: 'Insufficient staked TRX' };
    demoState.totalTRX += amountTRX;
    demoState.stakedForEnergy -= amountTRX;
    const energyToRemove = Math.floor(amountTRX * 2500);
    demoState.availableEnergy = Math.max(0, demoState.availableEnergy - energyToRemove);
    demoState.totalEnergy = Math.max(0, demoState.totalEnergy - energyToRemove);
    await logEnergyAction('UNSTAKE', amountTRX, `DEMO_UNSTAKE_${Date.now()}`);
    return { success: true, txId: `DEMO_UNSTAKE_${Date.now()}` };
  }
  throw new Error('Production requires TronWeb');
}

export async function delegateEnergy(childAddress: string, energyAmount: number = ENERGY_PER_TRANSFER, lockPeriodMs: number = 0) {
  if (DEMO_MODE) {
    demoState.availableEnergy = Math.max(0, demoState.availableEnergy - energyAmount);
    await logEnergyAction('DELEGATE', energyAmount, `DEMO_DEL_${Date.now()}`, childAddress);
    return { success: true, txId: `DEMO_DEL_${Date.now()}` };
  }
  throw new Error('Production requires TronWeb');
}

export async function reclaimEnergy(childAddress: string, energyAmount: number = ENERGY_PER_TRANSFER) {
  if (DEMO_MODE) {
    demoState.availableEnergy += energyAmount;
    await logEnergyAction('RECLAIM', energyAmount, `DEMO_RCL_${Date.now()}`, childAddress);
    return { success: true, txId: `DEMO_RCL_${Date.now()}` };
  }
  throw new Error('Production requires TronWeb');
}

export async function consolidateWithEnergy(
  childAddress: string, usdtAmount: number, motherAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; steps: string[] }> {
  const steps: string[] = [];

  if (DEMO_MODE) {
    steps.push('Delegating energy to child wallet...');
    await delegateEnergy(childAddress);
    steps.push('Energy delegated ✓');

    steps.push('Transferring USDT from child to mother...');
    await new Promise(r => setTimeout(r, 1000)); // Simulate delay
    const { consolidateWallet } = await import('./walletService.js');
    const result = await consolidateWallet(childAddress, motherAddress, usdtAmount);
    steps.push(`USDT transferred (${result.txHash}) ✓`);

    steps.push('Reclaiming energy...');
    await reclaimEnergy(childAddress);
    steps.push('Energy reclaimed ✓');

    steps.push('Consolidation complete!');
    return { success: true, txHash: result.txHash, steps };
  }
  throw new Error('Production requires TronWeb');
}

export async function batchConsolidate(
  wallets: Array<{ address: string; amount: number }>,
  motherAddress: string,
  onProgress?: (msg: string) => void
) {
  const results: Array<{ address: string; success: boolean; txHash?: string; error?: string }> = [];
  let totalConsolidated = 0;

  for (const wallet of wallets) {
    onProgress?.(`Consolidating ${wallet.address}...`);
    const result = await consolidateWithEnergy(wallet.address, wallet.amount, motherAddress);
    results.push({ address: wallet.address, success: result.success, txHash: result.txHash, error: result.error });
    if (result.success) totalConsolidated += wallet.amount;
  }

  return { results, totalConsolidated };
}

async function logEnergyAction(action: string, amount: number, txId: string, targetAddress?: string) {
  try {
    await db.collection('energy_logs').add({
      action, amount, txId,
      targetAddress: targetAddress || null,
      timestamp: Date.now(),
      date: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log energy action:', error);
  }
}
