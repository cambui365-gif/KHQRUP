
// Utility for number and currency formatting

export const formatNumber = (val: string): string => {
    // 1. Convert "decimal-like" commas to dots.
    // A comma is considered a decimal separator if it is NOT followed by exactly 3 digits.
    let raw = val.replace(/,(?!\d{3})/g, '.');

    // 2. Remove all existing thousands separators (commas)
    raw = raw.replace(/,/g, '');

    // 3. Remove non-numeric and non-dot characters
    raw = raw.replace(/[^0-9.]/g, '');
    
    if (!raw) return '';

    // 4. Split integer and fraction
    const parts = raw.split('.');
    
    // 5. Add thousands separators to integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    // 6. Rejoin. Limit to one decimal point.
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
};

export const formatMoney = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
