import { QRType } from '../config/constants.js';

/**
 * EMV QR Code Parser
 * Supports both KHQR (Cambodia) and VietQR (Vietnam) standards
 */

interface TLV {
  tag: string;
  length: number;
  value: string;
}

interface ParsedQR {
  type: QRType;
  bankCode: string;
  accountNumber: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  currency: string;
  countryCode: string;
  raw: string;
}

function parseTLV(data: string): TLV[] {
  const result: TLV[] = [];
  let i = 0;
  while (i < data.length - 3) {
    const tag = data.substring(i, i + 2);
    const length = parseInt(data.substring(i + 2, i + 4), 10);
    if (isNaN(length) || length <= 0) break;
    const value = data.substring(i + 4, i + 4 + length);
    result.push({ tag, length, value });
    i += 4 + length;
  }
  return result;
}

/**
 * Detect QR type from raw data
 */
function detectQRType(tlvs: TLV[]): QRType {
  // Tag 29 = Bakong/KHQR, Tag 38 = VietQR/NAPAS
  const merchantAccountTags = tlvs.filter(t => 
    parseInt(t.tag) >= 26 && parseInt(t.tag) <= 51
  );

  for (const mat of merchantAccountTags) {
    const subTlvs = parseTLV(mat.value);
    const guid = subTlvs.find(s => s.tag === '00')?.value || '';
    
    if (guid.includes('bakong') || guid.includes('nbc.org.kh')) return QRType.KHQR;
    if (guid.includes('napas') || guid.includes('vietqr')) return QRType.VIETQR;
  }

  // Fallback: check country code (tag 58)
  const countryCode = tlvs.find(t => t.tag === '58')?.value?.toUpperCase();
  if (countryCode === 'KH') return QRType.KHQR;
  if (countryCode === 'VN') return QRType.VIETQR;

  return QRType.UNKNOWN;
}

/**
 * Extract bank code and account from merchant account info
 */
function extractBankInfo(tlvs: TLV[]): { bankCode: string; accountNumber: string } {
  const merchantAccountTags = tlvs.filter(t => 
    parseInt(t.tag) >= 26 && parseInt(t.tag) <= 51
  );

  for (const mat of merchantAccountTags) {
    const subTlvs = parseTLV(mat.value);
    // Sub-tag 01 = bank identifier/acquirer ID
    // Sub-tag 02 = merchant account / account number
    const bankCode = subTlvs.find(s => s.tag === '01')?.value || '';
    const accountNumber = subTlvs.find(s => s.tag === '02')?.value || '';
    
    if (bankCode || accountNumber) {
      return { bankCode, accountNumber };
    }
  }
  return { bankCode: '', accountNumber: '' };
}

/**
 * Parse EMV QR code data (KHQR or VietQR)
 */
export function parseQRCode(rawData: string): ParsedQR {
  const tlvs = parseTLV(rawData);
  const qrType = detectQRType(tlvs);
  const { bankCode, accountNumber } = extractBankInfo(tlvs);

  // Tag 54 = Transaction Amount
  const amountStr = tlvs.find(t => t.tag === '54')?.value || '0';
  const amount = parseFloat(amountStr) || 0;

  // Tag 53 = Transaction Currency (356=KHR, 840=USD, 704=VND)
  const currencyCode = tlvs.find(t => t.tag === '53')?.value || '';

  // Tag 59 = Merchant Name
  const merchantName = tlvs.find(t => t.tag === '59')?.value || 'Unknown';

  // Tag 60 = Merchant City
  const merchantCity = tlvs.find(t => t.tag === '60')?.value || '';

  // Tag 58 = Country Code
  const countryCode = tlvs.find(t => t.tag === '58')?.value || '';

  return {
    type: qrType,
    bankCode,
    accountNumber,
    merchantName,
    merchantCity,
    amount,
    currency: currencyCode,
    countryCode,
    raw: rawData,
  };
}

/**
 * Map ISO 4217 numeric currency codes
 */
export function mapCurrencyCode(code: string): string {
  const map: Record<string, string> = {
    '116': 'KHR',
    '840': 'USD',
    '704': 'VND',
  };
  return map[code] || code;
}
