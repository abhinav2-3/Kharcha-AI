import {
  Banknote,
  Building2,
  Clapperboard,
  Coffee,
  CircleDashed,
  CreditCard,
  Fuel,
  GraduationCap,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Plane,
  QrCode,
  RotateCcw,
  Scissors,
  ShoppingBag,
  ShoppingBasket,
  Store,
  TrendingUp,
  Bus,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AnyCategory, PaymentMode } from './constants';

export const CATEGORY_META: Record<AnyCategory, { label: string; icon: LucideIcon }> = {
  food: { label: 'Food & drinks', icon: Coffee },
  groceries: { label: 'Groceries', icon: ShoppingBasket },
  transport: { label: 'Transport', icon: Bus },
  fuel: { label: 'Fuel', icon: Fuel },
  travel: { label: 'Travel', icon: Plane },
  bills: { label: 'Bills & recharge', icon: Zap },
  rent: { label: 'Rent', icon: House },
  shopping: { label: 'Shopping', icon: ShoppingBag },
  health: { label: 'Health', icon: HeartPulse },
  education: { label: 'Education', icon: GraduationCap },
  entertainment: { label: 'Entertainment', icon: Clapperboard },
  personal_care: { label: 'Personal care', icon: Scissors },
  gifts: { label: 'Gifts & donations', icon: Gift },
  emi_loans: { label: 'EMI & loans', icon: Landmark },
  investment: { label: 'Investment', icon: TrendingUp },
  other: { label: 'Other', icon: CircleDashed },
  salary: { label: 'Salary', icon: Banknote },
  business: { label: 'Business', icon: Store },
  freelance: { label: 'Freelance', icon: Laptop },
  refund: { label: 'Refund', icon: RotateCcw },
  gift_received: { label: 'Gift received', icon: Gift },
  other_income: { label: 'Other income', icon: Wallet },
};

export const MODE_META: Record<
  PaymentMode,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  cash: {
    label: 'Cash',
    color: '#10b981', // Emerald Green
    bgColor: 'rgba(16, 185, 129, 0.12)',
    icon: Banknote,
  },
  upi: {
    label: 'UPI',
    color: '#8b5cf6', // Violet / Purple
    bgColor: 'rgba(139, 92, 246, 0.12)',
    icon: QrCode,
  },
  card: {
    label: 'Card',
    color: '#f59e0b', // Amber / Orange
    bgColor: 'rgba(245, 158, 11, 0.12)',
    icon: CreditCard,
  },
  bank_transfer: {
    label: 'Bank',
    color: '#3b82f6', // Bank Blue
    bgColor: 'rgba(59, 130, 246, 0.12)',
    icon: Building2,
  },
  other: {
    label: 'Other',
    color: '#64748b', // Slate Neutral
    bgColor: 'rgba(100, 116, 139, 0.12)',
    icon: Wallet,
  },
  unknown: {
    label: 'Other',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.12)',
    icon: Wallet,
  },
};

