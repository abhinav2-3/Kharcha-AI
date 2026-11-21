import { AnyCategory, EntryType, PaymentMode } from '../constants';
import { todayIST } from '../format';
import type { Entry } from '../types';

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

const HINDI_NUMBER_WORDS: Record<string, number> = {
  'ek sau': 100,
  sau: 100,
  'sawa sau': 125,
  'dedh sau': 150,
  'paune do sau': 175,
  'do sau': 200,
  'dhai sau': 250,
  'adhai sau': 250,
  'teen sau': 300,
  'chaar sau': 400,
  'paanch sau': 500,
  'chhe sau': 600,
  'che sau': 600,
  'saat sau': 700,
  'aath sau': 800,
  'nau sau': 900,
  'ek hazar': 1000,
  'ek hazaar': 1000,
  'sawa hazar': 1250,
  'dedh hazar': 1500,
  'dedh hazaar': 1500,
  'paune do hazar': 1750,
  'do hazar': 2000,
  'dhai hazar': 2500,
  'paanch hazar': 5000,
  'dus hazar': 10000,
  'dedh lakh': 150000,
  'dhai lakh': 250000,
  'dus rupaye': 10,
  'bees rupaye': 20,
  'pachaas rupaye': 50,
};

const CATEGORY_KEYWORDS: Record<string, AnyCategory> = {
  // Food
  chai: 'food',
  tea: 'food',
  coffee: 'food',
  samosa: 'food',
  kachori: 'food',
  biscuit: 'food',
  breakfast: 'food',
  lunch: 'food',
  dinner: 'food',
  dosa: 'food',
  biryani: 'food',
  burger: 'food',
  pizza: 'food',
  swiggy: 'food',
  zomato: 'food',
  eatclub: 'food',
  restaurant: 'food',
  dhaba: 'food',
  snack: 'food',
  snacks: 'food',
  momo: 'food',
  momos: 'food',
  paneer: 'food',

  // Transport
  petrol: 'transport',
  diesel: 'transport',
  cng: 'transport',
  fuel: 'transport',
  auto: 'transport',
  rickshaw: 'transport',
  cab: 'transport',
  taxi: 'transport',
  uber: 'transport',
  ola: 'transport',
  rapido: 'transport',
  metro: 'transport',
  bus: 'transport',
  toll: 'transport',
  parking: 'transport',
  challan: 'transport',

  // Groceries
  milk: 'groceries',
  doodh: 'groceries',
  curd: 'groceries',
  dahi: 'groceries',
  bread: 'groceries',
  egg: 'groceries',
  eggs: 'groceries',
  anda: 'groceries',
  sabzi: 'groceries',
  vegetables: 'groceries',
  fruits: 'groceries',
  rashan: 'groceries',
  kirana: 'groceries',
  blinkit: 'groceries',
  zepto: 'groceries',
  instamart: 'groceries',
  bigbasket: 'groceries',

  // Bills
  recharge: 'bills',
  jio: 'bills',
  airtel: 'bills',
  vi: 'bills',
  wifi: 'bills',
  broadband: 'bills',
  electricity: 'bills',
  bijli: 'bills',
  light: 'bills',
  cylinder: 'bills',
  gas: 'bills',
  water: 'bills',
  paani: 'bills',

  // Shopping
  shopping: 'shopping',
  clothes: 'shopping',
  kapde: 'shopping',
  shirt: 'shopping',
  pant: 'shopping',
  shoes: 'shopping',
  joota: 'shopping',
  amazon: 'shopping',
  flipkart: 'shopping',
  myntra: 'shopping',
  meesho: 'shopping',

  // Health
  medicine: 'health',
  medicines: 'health',
  dawai: 'health',
  doctor: 'health',
  hospital: 'health',
  chemist: 'health',
  pharmacy: 'health',
  tablet: 'health',
  tablets: 'health',

  // Rent
  rent: 'rent',
  kiraya: 'rent',
  flat: 'rent',
  room: 'rent',

  // Entertainment
  movie: 'entertainment',
  cinema: 'entertainment',
  theatre: 'entertainment',
  pvr: 'entertainment',
  inox: 'entertainment',
  netflix: 'entertainment',
  prime: 'entertainment',
  hotstar: 'entertainment',
  party: 'entertainment',
  beer: 'entertainment',
  drinks: 'entertainment',

  // Salary / Income
  salary: 'salary',
  stipend: 'salary',
  bonus: 'salary',
};

const MODE_KEYWORDS: Record<string, PaymentMode> = {
  upi: 'upi',
  gpay: 'upi',
  'google pay': 'upi',
  phonepe: 'upi',
  paytm: 'upi',
  bhim: 'upi',
  qr: 'upi',
  scan: 'upi',
  online: 'upi',
  cash: 'cash',
  rokda: 'cash',
  nagad: 'cash',
  khulla: 'cash',
  card: 'card',
  debit: 'card',
  credit: 'card',
  swipe: 'card',
  netbanking: 'bank_transfer',
  neft: 'bank_transfer',
  imps: 'bank_transfer',
  rtgs: 'bank_transfer',
  transfer: 'bank_transfer',
};

const INCOME_TRIGGERS = [
  'salary',
  'stipend',
  'credited',
  'credit',
  'refund',
  'cashback',
  'aayi',
  'aaye',
  'aaya',
  'mila',
  'mile',
  'jama',
  'received',
];

/**
 * Extracts a financial amount from user raw text.
 * Returns amount in Rupees (e.g. 500), or null if not found.
 */
function extractAmountInRupees(text: string): number | null {
  // 1. Convert Devanagari digits to standard digits
  const normalized = text.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d).toLowerCase();

  // 2. Check Hindi number phrases (longest matches first)
  const phrases = Object.keys(HINDI_NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (normalized.includes(phrase)) {
      return HINDI_NUMBER_WORDS[phrase];
    }
  }

  // 3. Check "5k" / "5 k" / "1.5k"
  const kMatch = normalized.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    if (!isNaN(val)) return Math.round(val * 1000);
  }

  // 4. Check "1.5 lakh" / "2 lakh"
  const lakhMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)\b/i);
  if (lakhMatch) {
    const val = parseFloat(lakhMatch[1]);
    if (!isNaN(val)) return Math.round(val * 100000);
  }

  // 5. Check regular digit numbers: e.g. "500", "₹500", "500.50", "rs 500"
  // Prioritize numbers near currency tokens or stand-alone numbers
  const numberTokens = normalized.match(/(?:(?:₹|rs\.?|inr)\s*)?(\d+(?:\.\d+)?)/gi);
  if (numberTokens && numberTokens.length > 0) {
    for (const token of numberTokens) {
      const cleanNum = token.replace(/[^0-9.]/g, '');
      const parsed = parseFloat(cleanNum);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 10_000_000) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Fast client-side heuristic parser for instant, offline expense logging.
 * Returns an optimistic Entry object.
 */
export function parseLocalExpense(
  rawText: string,
  options?: { referenceDate?: Date }
): Partial<Entry> {
  const refDate = options?.referenceDate || new Date();
  const lower = rawText.toLowerCase().trim();

  // 1. Amount Extraction
  const amountRupees = extractAmountInRupees(lower);
  const amountPaise =
    amountRupees !== null && Number.isFinite(amountRupees)
      ? Math.round(amountRupees * 100)
      : null;

  // 2. Entry Type (Expense vs Income)
  let type: EntryType = 'expense';
  for (const trigger of INCOME_TRIGGERS) {
    if (new RegExp(`\\b${trigger}\\b`, 'i').test(lower)) {
      type = 'income';
      break;
    }
  }

  // 3. Category Detection
  let category: AnyCategory = type === 'income' ? 'other_income' : 'other';
  if (type === 'income' && (lower.includes('salary') || lower.includes('stipend'))) {
    category = 'salary';
  } else {
    for (const [kw, cat] of Object.entries(CATEGORY_KEYWORDS)) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
        category = cat;
        break;
      }
    }
  }

  // 4. Payment Mode Detection
  let mode: PaymentMode = 'cash';
  for (const [kw, m] of Object.entries(MODE_KEYWORDS)) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
      mode = m;
      break;
    }
  }

  // 5. Relative Dates
  let spentOn = todayIST();
  if (lower.includes('kal') || lower.includes('yesterday')) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    spentOn = `${y}-${m}-${day}`;
  }

  return {
    rawText,
    amount: amountPaise,
    type,
    category,
    mode,
    spentAt: refDate.toISOString(),
    spentOn,
    parseStatus: amountPaise !== null ? 'ok' : 'failed',
    sync: 'pending',
  };
}
