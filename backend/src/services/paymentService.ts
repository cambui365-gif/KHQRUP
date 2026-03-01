import { MOCK_PAYMENT_DELAY_MS } from '../config/constants.js';
import { PartnerPaymentRequest, PartnerPaymentResponse } from '../types/index.js';

const PARTNER_URL = process.env.PARTNER_PAYMENT_URL || '';
const PARTNER_API_KEY = process.env.PARTNER_PAYMENT_API_KEY || '';

/**
 * Send payment to partner API
 * Currently uses mock - replace with real partner API when docs available
 */
export async function sendToPartner(request: PartnerPaymentRequest): Promise<PartnerPaymentResponse> {
  // If no partner URL configured or it points to mock, use mock
  if (!PARTNER_URL || PARTNER_URL.includes('mock')) {
    return mockPayment(request);
  }

  // Real partner API call (future implementation)
  try {
    const response = await fetch(PARTNER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PARTNER_API_KEY}`,
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();
    return {
      success: data.success || data.status === 'SUCCESS',
      partnerTxId: data.transactionId || data.txId,
      responseCode: data.code || data.responseCode,
      message: data.message,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Partner API error: ${error.message}`,
    };
  }
}

/**
 * Mock payment - simulates success after delay
 */
async function mockPayment(request: PartnerPaymentRequest): Promise<PartnerPaymentResponse> {
  console.log(`[MockPayment] Processing payment ${request.transactionId}...`);
  console.log(`  QR Type: ${request.qrType}`);
  console.log(`  Bank: ${request.bankCode}`);
  console.log(`  Account: ${request.accountNumber}`);
  console.log(`  Amount: ${request.amount} ${request.currency}`);

  await new Promise(resolve => setTimeout(resolve, MOCK_PAYMENT_DELAY_MS));

  console.log(`[MockPayment] Payment ${request.transactionId} completed (mock)`);

  return {
    success: true,
    partnerTxId: `MOCK_${Date.now()}`,
    responseCode: '00',
    message: 'Payment successful (mock)',
  };
}
