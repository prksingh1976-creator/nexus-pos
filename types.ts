export interface Product {
  id: string;
  name: string;
  variant?: string; // e.g., "500ml", "1kg", "Large"
  seller: string; // Company or Brand Name
  category: string;
  tags: string[]; // Array of tag strings
  price: number;
  cost: number;
  stock: number;
  minStockLevel: number; // For low stock warnings
}

export interface CartItem extends Product {
  quantity: number;
}

export interface ChargeRule {
  id: string;
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  isDiscount: boolean; // true = subtract, false = add
  trigger: 'always' | 'amount_threshold' | 'customer_assigned';
  threshold?: number; // For amount_threshold
  enabled: boolean;
}

export interface AppliedCharge {
  name: string;
  amount: number;
  isDiscount: boolean;
}

export interface Transaction {
  id: string;
  customerId: string | null; // Null for guest
  customerName?: string;
  date: string; // ISO string
  items: CartItem[];
  subtotal: number; // Raw total of items
  charges: AppliedCharge[]; // Tax, discounts, fees applied
  total: number; // Final amount paid
  type: 'sale' | 'payment' | 'refund';
  paymentMethod: 'cash' | 'account' | 'upi'; 
  status: 'completed' | 'queued' | 'cancelled'; // New status field
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number; // Positive means they owe money (credit), Negative means store credit
  totalSpent: number;
  lastVisit: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  currency?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  upiId?: string; // Store merchant UPI ID
  preferences?: UserPreferences;
}

export interface DashboardStats {
  totalSales: number;
  totalRevenue: number;
  lowStockCount: number;
  totalCreditReceivable: number;
}