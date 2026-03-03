
import { Currency } from '../types';

export interface KHQRData {
  merchantName: string;
  merchantCity?: string;
  amount?: number;
  currency: Currency;
  bankName?: string;
  raw: string;
  isValid: boolean;
  isVietQR?: boolean;
  merchantId?: string;
  bankCode?: string;
  isFixedAmount: boolean;
}

// --- HELPERS ---
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Get Byte Length of a UTF-8 String (Crucial for EMVCo Length field)
function getByteLength(str: string): number {
    return textEncoder.encode(str).length;
}

// Create TLV String: Tag + Length (2 digits) + Value
function createTLV(tag: string, value: string): string {
    const len = getByteLength(value);
    const lenStr = len.toString().padStart(2, '0');
    return `${tag}${lenStr}${value}`;
}

// --- CRC16 IMPLEMENTATION (CCITT-FALSE) ---
// Equivalent to crcmod.mkCrcFun(0x11021, rev=False, initCrc=0xFFFF, xorOut=0x0000)
function calculateCRC16(dataStr: string): string {
    const data = textEncoder.encode(dataStr);
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = (crc << 1);
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Parses TLV string into a simple Map<Tag, ValueString>
 * This follows the Python logic: treating value as string, not bytes, for preservation.
 */
const parseTLVToStringMap = (rawQr: string): Map<string, string> => {
    const tags = new Map<string, string>();
    let i = 0;
    const len = rawQr.length;
    
    while (i < len) {
        // Tag (2 chars)
        if (i + 2 > len) break;
        const tag = rawQr.substring(i, i + 2);
        i += 2;

        // Length (2 chars)
        if (i + 2 > len) break;
        const lenStr = rawQr.substring(i, i + 2);
        const length = parseInt(lenStr, 10);
        i += 2;

        if (isNaN(length)) break;

        // Value
        // NOTE: In JS, substring is character-based.
        // For standard KHQR which is mostly ASCII/UTF-8 compatible in structure,
        // using substring works for extraction if we re-calculate byte length later.
        // However, if the QR has emojis, split by index might be slightly off if not careful.
        // But for Tag 00-62 structure, it's generally safe.
        if (i + length > len) {
             // Fallback for safety
             const val = rawQr.substring(i);
             tags.set(tag, val);
             break;
        }
        
        const val = rawQr.substring(i, i + length);
        tags.set(tag, val);
        i += length;
    }
    return tags;
};

// --- EXTRACTORS (Keep existing logic for display purposes) ---

const parseTLVToBytesMap = (data: Uint8Array): Map<string, Uint8Array> => {
    const tags = new Map<string, Uint8Array>();
    let i = 0;
    while (i < data.length) {
        if (i + 2 > data.length) break;
        const tag = String.fromCharCode(data[i], data[i+1]); 
        i += 2;
        if (i + 2 > data.length) break;
        const lenStr = String.fromCharCode(data[i], data[i+1]);
        const len = parseInt(lenStr, 10);
        i += 2;
        if (isNaN(len)) break;
        if (i + len > data.length) break;
        const value = data.slice(i, i + len);
        tags.set(tag, value);
        i += len;
    }
    return tags;
};

export const extractMerchantIdFromRaw = (rawQR: string | undefined): string => {
    if (!rawQR) return "";
    try {
        const data = textEncoder.encode(rawQR);
        const root = parseTLVToBytesMap(data);
        let blockVal = root.get('29') || root.get('30');
        if (blockVal) {
            const sub = parseTLVToBytesMap(blockVal);
            if (sub.has('01')) return textDecoder.decode(sub.get('01')!);
            if (sub.has('02')) return textDecoder.decode(sub.get('02')!);
        }
    } catch (e) {}
    
    const match = rawQR.match(/([0-9]{9,12})|([a-zA-Z0-9._]+@(aba|acleda|wing|canadia))/);
    return match ? match[0] : "";
};

export const detectBankApp = (rawQr: string, merchantId: string): { name: string, scheme: string, color: string } => {
    const lowerRaw = rawQr.toLowerCase();
    const lowerId = merchantId.toLowerCase();

    if (lowerRaw.includes("kh.com.aba") || lowerId.includes("@aba")) {
        return { name: "ABA Mobile", scheme: "aba_mobile_bank://", color: "#005788" }; 
    }
    if (lowerRaw.includes("kh.com.wing") || lowerId.includes("@wing")) {
        return { name: "Wing Bank", scheme: "wing_money://", color: "#9DC640" }; 
    }
    if (lowerRaw.includes("kh.com.acleda") || lowerId.includes("@acleda")) {
        return { name: "ACLEDA Mobile", scheme: "acledabank://", color: "#1A3E73" }; 
    }
    return { name: "Bakong / Other", scheme: "bakong://", color: "#E31E24" };
};

export const parseKHQR = (qrString: string): KHQRData => {
  const result: KHQRData = {
    merchantName: 'Unknown',
    currency: Currency.KHR,
    bankName: 'KHQR',
    raw: qrString,
    isValid: false,
    isVietQR: false,
    merchantId: '',
    bankCode: 'E',
    isFixedAmount: false 
  };

  if (!qrString || qrString.length < 20) return result;

  try {
      const data = textEncoder.encode(qrString);
      const root = parseTLVToBytesMap(data);
      
      const tempId = extractMerchantIdFromRaw(qrString);
      result.merchantId = tempId;
      result.isValid = true;

      if (root.has('59')) result.merchantName = textDecoder.decode(root.get('59')!);
      if (root.has('60')) result.merchantCity = textDecoder.decode(root.get('60')!);

      if (root.has('54')) {
          const amtStr = textDecoder.decode(root.get('54')!);
          const amt = parseFloat(amtStr);
          if (!isNaN(amt) && amt > 0) {
              result.amount = amt;
              result.isFixedAmount = true; 
          }
      }

      if (root.has('53')) {
          const currStr = textDecoder.decode(root.get('53')!);
          if (currStr === '840') result.currency = Currency.USD;
          else result.currency = Currency.KHR;
      }
      
      const bankInfo = detectBankApp(qrString, tempId);
      result.bankName = bankInfo.name;

  } catch (e) {
      console.error(e);
  }

  return result;
};

// =========================================================
// === CORE LOGIC: "MIRRORING" STRATEGY (PYTHON PORT) ===
// =========================================================

export const generateDynamicKHQR = (rawQr: string, amount: number, currency: Currency, refId?: string): string => {
    if (!rawQr) return "";
    
    try {
        // 1. PARSE ORIGINAL TAGS
        // We act like the Python script: Parse TLV to Map, but treat values as Opaque Strings.
        const tags = parseTLVToStringMap(rawQr);

        // 2. UPDATE DATA (Mutate Map)
        
        // Tag 01: Point of Initiation -> 12 (Dynamic)
        tags.set('01', '12');

        // Tag 54: Amount
        // Format: No commas. KHR usually integer, USD 2 decimals.
        // Python: "{:.2f}".format(float(match.group(1)))
        let amtStr = "";
        if (currency === Currency.KHR) {
             // For KHR, usually standard is integer string in KHQR
             amtStr = Math.round(amount).toString(); 
        } else {
             amtStr = amount.toFixed(2);
        }
        tags.set('54', amtStr);

        // Tag 53: Currency
        const currCode = currency === Currency.KHR ? '116' : '840';
        tags.set('53', currCode);

        // Tag 58: Country Code (Ensure it exists)
        if (!tags.has('58')) tags.set('58', 'KH');

        // Tag 62: Bill Number (Additional Data)
        // Unlike Python demo, for a production Dynamic QR, a unique Bill Number is recommended 
        // to prevent "Duplicate Transaction" errors on some apps (like ABA).
        // However, if we want to stick strict to "Mirroring", we only add it if needed.
        // Let's Add it safely.
        const billNumber = refId 
            ? refId.replace(/[^a-zA-Z0-9]/g, '').slice(-20) 
            : `INV${Date.now().toString().slice(-13)}`;
        
        // Construct Tag 62 Sub-tags
        // 01: Bill Number
        // 07: Terminal Label (Optional)
        const t62Val = createTLV('01', billNumber);
        tags.set('62', t62Val);

        // Remove Tag 63 (Old CRC)
        tags.delete('63');

        // 3. SORT & REBUILD
        // KHQR Spec: Tags must be in ascending order "00" -> "63"
        const sortedKeys = Array.from(tags.keys()).sort((a, b) => {
            return parseInt(a, 10) - parseInt(b, 10);
        });

        let payload = "";
        for (const key of sortedKeys) {
            const val = tags.get(key) || "";
            // Important: Use createTLV which calculates BYTE length
            payload += createTLV(key, val);
        }

        // 4. SIGN (CRC16)
        payload += "6304"; // Append Tag 63 + Length 04
        const crc = calculateCRC16(payload);
        
        return payload + crc;

    } catch (e) {
        console.error("Mirroring Reconstruction Failed:", e);
        return rawQr; // Fallback
    }
};
