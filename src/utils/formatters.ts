/**
 * Format revenue values for display.
 * Handles inconsistent DB formats: "13", "22 Crore", "22cr", "25,94,73,192 Cr", "70 Crore", etc.
 */
export function formatRevenue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return 'N/A';

  const str = String(val);
  // Strip trailing Crore/Cr (case-insensitive)
  let cleaned = str.replace(/\s*(crore|cr)\s*$/i, '').trim();

  // Strip commas
  cleaned = cleaned.replace(/,/g, '');

  const num = Number(cleaned);
  if (isNaN(num)) return str; // fallback: return raw value

  // If > 1000, assume absolute rupees → convert to crores
  const croreValue = num > 1000 ? num / 10000000 : num;

  // Format: up to 2 decimal places, trim trailing zeros
  const formatted = parseFloat(croreValue.toFixed(2)).toString();
  return `₹${formatted} Cr`;
}

/**
 * Format employee count for display.
 * Handles: "25", "WC:171, BC:98", "WC:30+, BC:30+"
 */
export function formatEmployees(val: string | number | null | undefined): { total: string; breakdown?: string } {
  if (val === null || val === undefined || val === '') return { total: 'N/A' };

  const trimmed = String(val).trim();

  // Pure number
  if (!isNaN(Number(trimmed))) return { total: trimmed };

  // WC/BC pattern: "WC:171, BC:98" or "WC:30+, BC:30+"
  const wcMatch = trimmed.match(/WC\s*:\s*(\d+)(\+?)/i);
  const bcMatch = trimmed.match(/BC\s*:\s*(\d+)(\+?)/i);

  if (wcMatch && bcMatch) {
    const wcNum = parseInt(wcMatch[1], 10);
    const bcNum = parseInt(bcMatch[1], 10);
    const hasPlus = wcMatch[2] === '+' || bcMatch[2] === '+';
    const total = `${wcNum + bcNum}${hasPlus ? '+' : ''}`;
    const breakdown = `WC: ${wcMatch[1]}${wcMatch[2]}, BC: ${bcMatch[1]}${bcMatch[2]}`;
    return { total, breakdown };
  }

  return { total: trimmed };
}
