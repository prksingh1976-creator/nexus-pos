export interface Product {
  id: string;
  name: string;
  variant?: string; // e.g., "500ml", "1kg", "Large"
  seller: string; // Company or Brand Name
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStockLevel: number; // For low stock warnings
  isVariablePrice?: boolean; // If true, prompt for amount/qty at POS
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
  paymentMethod: 'cash' | 'account' | 'upi' | 'pending'; 
  status: 'completed' | 'queued' | 'cancelled'; 
  queueName?: string; // Custom name for the order (e.g. "Table 5")
}

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string; // Optional
  email?: string; // Optional
  company?: string; // Optional
  manager?: string; // Optional
  notes?: string;   // Optional
  balance: number; // Positive means they owe money (credit), Negative means store credit
  creditLimit?: number; // Maximum credit allowed
  totalSpent: number;
  lastVisit: string;
  faceDescriptor?: number[]; // Array of 128 float numbers for face recognition
  smsEnabled?: boolean; // Enable SMS for this specific customer
  smsTemplateId?: string; // Optional override for specific template
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  currency?: string;
  autoShowReceipt?: boolean;
  enableFaceRecognition?: boolean;
  camPreviewSize?: 'small' | 'medium' | 'large';
  showCamPreview?: boolean;
  masterSmsEnabled?: boolean; // Global SMS toggle
  smsTemplates?: SmsTemplate[]; // List of saved templates
  smsServiceUrl?: string; // The endpoint to hit (e.g. localhost:3001)
  smsDeviceIp?: string; // The Android phone IP (passed to bridge)
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