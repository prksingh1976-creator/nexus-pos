
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Product, Customer, Transaction, User, ChargeRule, CartItem, UserPreferences } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SELLERS } from '../constants';
import { 
    initializeFirebase, 
    onAuthStateChange,
    saveToCloud, 
    saveUserProfile
} from '../services/firebase';
import { storage } from '../services/storage';

interface ShopContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  deleteAccount: () => Promise<void>;
  isLoading: boolean;
  
  // Network & Sync
  isOnline: boolean;
  isCloudEnabled: boolean;
  isLocalSyncEnabled: boolean;
  enableCloud: (config: any) => Promise<boolean>;
  loginCloud: () => Promise<void>;
  connectLocalFolder: () => Promise<boolean>;

  // Data
  products: Product[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;

  customers: Customer[];
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;

  transactions: Transaction[];
  processTransaction: (transaction: Transaction) => void;
  updateOrderStatus: (id: string, status: 'completed' | 'queued' | 'cancelled', paymentMethod?: 'cash' | 'account' | 'upi') => void;
  deleteTransaction: (id: string) => void;

  // Master Data
  categories: string[];
  addCategory: (cat: string) => void;
  deleteCategory: (cat: string) => void;
  
  sellers: string[];
  addSeller: (seller: string) => void;
  deleteSeller: (seller: string) => void;

  chargeRules: ChargeRule[];
  addChargeRule: (rule: ChargeRule) => void;
  updateChargeRule: (rule: ChargeRule) => void;
  deleteChargeRule: (id: string) => void;
  
  tags: string[];

  // POS State
  posCart: CartItem[];
  setPosCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  posCustomer: Customer | null;
  setPosCustomer: React.Dispatch<React.SetStateAction<Customer | null>>;
  
  importData: (jsonData: any) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within a ShopProvider');
  return context;
};

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [sellers, setSellers] = useState<string[]>(DEFAULT_SELLERS);
  const [chargeRules, setChargeRules] = useState<ChargeRule[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // POS State
  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [posCustomer, setPosCustomer] = useState<Customer | null>(null);

  // Sync State
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  const [isLocalSyncEnabled, setIsLocalSyncEnabled] = useState(false);
  const fileHandleRef = useRef<any>(null);

  // Persistence Key Helper
  const getStoreKey = (key: string) => user ? `nexus_${user.id}_${key}` : null;

  // Initialize App
  useEffect(() => {
    const init = async () => {
      const savedUser = localStorage.getItem('nexus_current_user');
      if (savedUser) {
        const userData: User = JSON.parse(savedUser);
        setUser(userData);
        
        // Load User Data
        const prefix = `nexus_${userData.id}_`;
        const [p, c, t, cats, sels, rules] = await Promise.all([
          storage.get(prefix + 'products'),
          storage.get(prefix + 'customers'),
          storage.get(prefix + 'transactions'),
          storage.get(prefix + 'categories'),
          storage.get(prefix + 'sellers'),
          storage.get(prefix + 'chargerules')
        ]);

        if (p) setProducts(p);
        if (c) setCustomers(c);
        if (t) setTransactions(t);
        if (cats) setCategories(cats);
        if (sels) setSellers(sels);
        if (rules) setChargeRules(rules);

        // Check for Cloud
        const cloudConfig = localStorage.getItem(prefix + 'cloud_config');
        if (cloudConfig) {
          initializeFirebase(JSON.parse(cloudConfig));
          setIsCloudEnabled(true);
        }
      }
      setIsLoading(false);
    };

    init();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Data to Storage on Change
  useEffect(() => {
    if (!user) return;
    const prefix = `nexus_${user.id}_`;
    storage.set(prefix + 'products', products);
    storage.set(prefix + 'customers', customers);
    storage.set(prefix + 'transactions', transactions);
    storage.set(prefix + 'categories', categories);
    storage.set(prefix + 'sellers', sellers);
    storage.set(prefix + 'chargerules', chargeRules);

    // Cloud Sync if enabled
    if (isCloudEnabled) {
      saveToCloud(user.id, 'products', products);
      saveToCloud(user.id, 'customers', customers);
      saveToCloud(user.id, 'transactions', transactions);
    }
    
    // Local Folder Sync if enabled
    if (isLocalSyncEnabled && fileHandleRef.current) {
        const backup = { user, products, customers, transactions, categories, sellers, chargeRules, timestamp: new Date().toISOString() };
        saveToLocalFile(backup);
    }
  }, [products, customers, transactions, categories, sellers, chargeRules, user, isCloudEnabled, isLocalSyncEnabled]);

  const saveToLocalFile = async (data: any) => {
      try {
          const writable = await fileHandleRef.current.createWritable();
          await writable.write(JSON.stringify(data, null, 2));
          await writable.close();
      } catch (e) {
          console.error("Local sync failed", e);
      }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('nexus_current_user', JSON.stringify(userData));
    localStorage.setItem(`nexus_pos_${userData.id}_profile`, JSON.stringify(userData));
    // Data will be loaded via next effect or reload, but for better UX we could trigger load here
    window.location.reload(); 
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nexus_current_user');
    setPosCart([]);
    setPosCustomer(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    const newUser = { ...user, ...updates };
    setUser(newUser);
    localStorage.setItem('nexus_current_user', JSON.stringify(newUser));
    localStorage.setItem(`nexus_pos_${user.id}_profile`, JSON.stringify(newUser));
    if (isCloudEnabled) saveUserProfile(user.id, newUser);
  };

  const deleteAccount = async () => {
    if (!user) return;
    const prefix = `nexus_${user.id}_`;
    await Promise.all([
      storage.del(prefix + 'products'),
      storage.del(prefix + 'customers'),
      storage.del(prefix + 'transactions'),
      storage.del(prefix + 'categories'),
      storage.del(prefix + 'sellers'),
      storage.del(prefix + 'chargerules'),
      storage.del(`nexus_pos_${user.id}_profile`)
    ]);
    logout();
  };

  const addProduct = (p: Product) => setProducts(prev => [...prev, p]);
  const updateProduct = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));
  const deleteProduct = (id: string) => setProducts(prev => prev.filter(x => x.id !== id));

  const addCustomer = (c: Customer) => setCustomers(prev => [...prev, c]);
  const updateCustomer = (c: Customer) => setCustomers(prev => prev.map(x => x.id === c.id ? c : x));
  const deleteCustomer = (id: string) => setCustomers(prev => prev.filter(x => x.id !== id));

  const processTransaction = (t: Transaction) => {
    // 1. Update Inventory
    setProducts(prev => prev.map(p => {
        const cartItem = t.items.find(item => item.id === p.id);
        if (cartItem) return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        return p;
    }));

    // 2. Update Customer Balance if credit/account
    if (t.customerId) {
        setCustomers(prev => prev.map(c => {
            if (c.id === t.customerId) {
                let newBalance = c.balance;
                if (t.paymentMethod === 'account') newBalance += t.total;
                if (t.type === 'payment') newBalance -= t.total;
                
                return { 
                    ...c, 
                    balance: parseFloat(newBalance.toFixed(2)),
                    totalSpent: t.type === 'sale' ? c.totalSpent + t.total : c.totalSpent,
                    lastVisit: new Date().toISOString()
                };
            }
            return c;
        }));
    }

    // 3. Save Transaction
    setTransactions(prev => [t, ...prev]);

    // 4. Reset POS
    setPosCart([]);
    setPosCustomer(null);
  };

  const updateOrderStatus = (id: string, status: 'completed' | 'queued' | 'cancelled', paymentMethod?: 'cash' | 'account' | 'upi') => {
    setTransactions(prev => prev.map(t => {
      if (t.id === id) {
          const updated = { ...t, status, paymentMethod: paymentMethod || t.paymentMethod };
          // If moving from queued to completed, we should ideally handle stock/balance then? 
          // Our current POS logic subtracts stock on initial 'processTransaction'.
          // To keep it simple, we only adjust balance on final completion if it's 'account'.
          if (status === 'completed' && paymentMethod === 'account' && t.customerId) {
              setCustomers(curr => curr.map(c => c.id === t.customerId ? { ...c, balance: c.balance + t.total } : c));
          }
          return updated;
      }
      return t;
    }));
  };

  const deleteTransaction = (id: string) => setTransactions(prev => prev.filter(x => x.id !== id));

  const addCategory = (c: string) => setCategories(prev => Array.from(new Set([...prev, c])));
  const deleteCategory = (c: string) => setCategories(prev => prev.filter(x => x !== c));
  const addSeller = (s: string) => setSellers(prev => Array.from(new Set([...prev, s])));
  const deleteSeller = (s: string) => setSellers(prev => prev.filter(x => x !== s));

  const addChargeRule = (r: ChargeRule) => setChargeRules(prev => [...prev, r]);
  const updateChargeRule = (r: ChargeRule) => setChargeRules(prev => prev.map(x => x.id === r.id ? r : x));
  const deleteChargeRule = (id: string) => setChargeRules(prev => prev.filter(x => x.id !== id));

  const enableCloud = async (config: any) => {
    if (!user) return false;
    const success = initializeFirebase(config);
    if (success) {
      localStorage.setItem(`nexus_${user.id}_cloud_config`, JSON.stringify(config));
      setIsCloudEnabled(true);
    }
    return success;
  };

  const loginCloud = async () => {
    // Logic for Google Sign in or similar could go here
    console.log("Cloud login triggered");
  };

  const connectLocalFolder = async () => {
    try {
        const handle = await (window as any).showSaveFilePicker({
            suggestedName: `nexus_backup_${user?.id}.json`,
            types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        });
        fileHandleRef.current = handle;
        setIsLocalSyncEnabled(true);
        return true;
    } catch (e) {
        return false;
    }
  };

  const importData = (data: any) => {
    if (data.products) setProducts(data.products);
    if (data.customers) setCustomers(data.customers);
    if (data.transactions) setTransactions(data.transactions);
    if (data.categories) setCategories(data.categories);
    if (data.sellers) setSellers(data.sellers);
    if (data.chargeRules) setChargeRules(data.chargeRules);
    if (data.user) updateUser(data.user);
  };

  const value = {
    user, login, logout, updateUser, deleteAccount, isLoading,
    isOnline, isCloudEnabled, isLocalSyncEnabled, enableCloud, loginCloud, connectLocalFolder,
    products, addProduct, updateProduct, deleteProduct,
    customers, addCustomer, updateCustomer, deleteCustomer,
    transactions, processTransaction, updateOrderStatus, deleteTransaction,
    categories, addCategory, deleteCategory,
    sellers, addSeller, deleteSeller,
    chargeRules, addChargeRule, updateChargeRule, deleteChargeRule,
    tags, posCart, setPosCart, posCustomer, setPosCustomer, importData
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};
