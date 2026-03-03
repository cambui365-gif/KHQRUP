export const formatNumber = (val: string): string => {
    let raw = val.replace(/,(?!\d{3})/g, '.');
    raw = raw.replace(/,/g, '');
    raw = raw.replace(/[^0-9.]/g, '');
    if (!raw) return '';
    const parts = raw.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : parts[0];
};

export const formatMoney = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
