import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Product, Customer, Transaction, User, ChargeRule, CartItem } from '../types';
import { DEFAULT_CATEGORIES, DEFAULT_SELLERS, isMobile } from '../constants';
import { 
    initializeFirebase, 
    loginWithGoogle, logoutFromCloud, 
    subscribeToCollection, 
    saveToCloud, saveUserProfile, deleteUserData,
    onAuthStateChange
} from '../services/firebase';
import { api } from '../services/api';
import { storage } from '../services/storage';

// --- Precision Helper ---
const round = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

interface ShopContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  deleteAccount: () => Promise<void>;
  isLoading: boolean;
  
  // Network Status
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'error';
  
  // Cloud
  enableCloud: (config: any) => Promise<boolean>;
  loginCloud: () => Promise<void>;
  isCloudEnabled: boolean;
  isLocalSyncEnabled: boolean;
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
    if (!context) {
        throw new Error("useShop must be used within a ShopProvider");
    }
    return context;
};

export const ShopProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  
  // --- Network State ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');

  // --- Data State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [sellers, setSellers] = useState<string[]>(DEFAULT_SELLERS);
  const [chargeRules, setChargeRules] = useState<ChargeRule[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // --- POS Temporary State ---
  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [posCustomer, setPosCustomer] = useState<Customer | null>(null);

  // --- Sync Refs ---
  const syncTimeouts = useRef<Record<string, any>>({});
  const [dirHandle, setDirHandle] = useState<any>(null);
  const unsubscribers = useRef<Function[]>([]);

  // --- Initialization & Network Listeners ---
  useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  // --- Theme Application ---
  useEffect(() => {
    const preference = user?.preferences?.theme || 'system';
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = preference === 'dark' || (preference === 'system' && mediaQuery.matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    const listener = () => {
        if (preference === 'system') applyTheme();
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [user?.preferences?.theme]);

  // Initialize App Data
  useEffect(() => {
      const init = async () => {
          try {
              // 1. Try Load User from LocalStorage (Fast)
              const sessionUser = localStorage.getItem('nexus_pos_user');
              let currentUser: User | null = null;

              if (sessionUser) {
                  try {
                      currentUser = JSON.parse(sessionUser);
                      setUser(currentUser);
                      
                      // Load Data from IndexedDB (Async, Large Storage)
                      if (currentUser) {
                          await loadLocalData(currentUser.id);
                      }
                  } catch (err) {
                      console.error("Failed to parse local user or load data", err);
                  }
              }

              // 2. Try Auto-Connect Cloud
              const savedConfig = localStorage.getItem('nexus_pos_firebase_config');
              if (savedConfig) {
                  try {
                      const config = JSON.parse(savedConfig);
                      const success = initializeFirebase(config);
                      if (success) {
                          setIsCloudEnabled(true);
                          
                          // Check for active firebase session
                          onAuthStateChange((firebaseUser) => {
                              if (firebaseUser && currentUser) {
                                 console.log("🔥 Cloud Connected & User Restored");
                                 setupCloudListeners(currentUser.id);
                              }
                          });
                      }
                  } catch (e) {
                      console.error("Auto-connect cloud failed", e);
                  }
              }
          } catch (e) {
              console.error("Critical Init Error:", e);
          } finally {
              // ALWAYS remove loading screen
              setIsLoading(false);
          }
      };

      init();
  }, []);

  const loadLocalData = async (userId: string) => {
      try {
          const p = await storage.get(`nexus_pos_${userId}_products`);
          if (p) setProducts(p);

          const c = await storage.get(`nexus_pos_${userId}_customers`);
          if (c) setCustomers(c);

          const t = await storage.get(`nexus_pos_${userId}_transactions`);
          if (t) setTransactions(t);

          const cat = await storage.get(`nexus_pos_${userId}_categories`);
          if (cat) setCategories(cat);

          const s = await storage.get(`nexus_pos_${userId}_sellers`);
          if (s) setSellers(s);

          const r = await storage.get(`nexus_pos_${userId}_chargerules`);
          if (r) setChargeRules(r);
      } catch (e) {
          console.warn("Failed to load some local data from IDB", e);
      }
  };

  const setupCloudListeners = (userId: string) => {
      // Clear old listeners
      unsubscribers.current.forEach(u => u());
      unsubscribers.current = [];

      const sub1 = subscribeToCollection(userId, 'products', (data) => { if(data) { setProducts(data); storage.set(`nexus_pos_${userId}_products`, data); } });
      const sub2 = subscribeToCollection(userId, 'customers', (data) => { if(data) { setCustomers(data); storage.set(`nexus_pos_${userId}_customers`, data); } });
      const sub3 = subscribeToCollection(userId, 'transactions', (data) => { if(data) { setTransactions(data); storage.set(`nexus_pos_${userId}_transactions`, data); } });
      
      unsubscribers.current.push(sub1, sub2, sub3);
  };

  const saveData = (key: string, data: any) => {
      if (!user) return;
      
      // 1. IndexedDB (Async but reliable for large data)
      storage.set(`nexus_pos_${user.id}_${key}`, data).catch(e => console.error("IDB Save Failed", e));
      
      // 2. Server/Cloud (Debounced)
      setSyncStatus('syncing');
      if (syncTimeouts.current[key]) {
          clearTimeout(syncTimeouts.current[key]);
      }

      syncTimeouts.current[key] = setTimeout(async () => {
          try {
              // Cloud Sync
              if (isCloudEnabled) {
                  await saveToCloud(user.id, key, data);
              }
              
              // Legacy Server API (Optional)
              if (key === 'products' || key === 'customers' || key === 'transactions') {
                  // @ts-ignore
                  await api.syncData(user.id, key, data);
              }

              // Local Folder Sync
              if (dirHandle) {
                  await saveToLocalFolder(key, data);
              }
              setSyncStatus('synced');
          } catch (e) {
              setSyncStatus('error');
              console.error("Sync Failed", e);
          }
      }, 2000); 
  };

  const connectLocalFolder = async () => {
      try {
          // @ts-ignore
          const handle = await window.showDirectoryPicker();
          setDirHandle(handle);
          return true;
      } catch (e) {
          console.error("File System Access denied", e);
          return false;
      }
  };

  const saveToLocalFolder = async (filename: string, data: any) => {
      if (!dirHandle) return;
      try {
          const fileHandle = await dirHandle.getFileHandle(`${filename}.json`, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(data, null, 2));
          await writable.close();
      } catch (e) {
          console.error("Failed to write to local folder", e);
      }
  };

  // --- Auth Actions ---
  const login = (userData: User) => {
      setUser(userData);
      localStorage.setItem('nexus_pos_user', JSON.stringify(userData));
      api.syncUser(userData);
      loadLocalData(userData.id);
      if (isCloudEnabled) {
          saveUserProfile(userData.id, userData);
          setupCloudListeners(userData.id);
      }
  };

  const logout = async () => {
      await logoutFromCloud();
      unsubscribers.current.forEach(u => u());
      unsubscribers.current = [];
      
      setUser(null);
      localStorage.removeItem('nexus_pos_user');
      setProducts([]);
      setCustomers([]);
      setTransactions([]);
      setPosCart([]);
      setPosCustomer(null);
  };

  const updateUser = (updates: Partial<User>) => {
      if (!user) return;
      const updated = { ...user, ...updates };
      setUser(updated);
      localStorage.setItem('nexus_pos_user', JSON.stringify(updated));
      api.syncUser(updated);
      if (isCloudEnabled) saveUserProfile(user.id, updated);
  };

  const deleteAccount = async () => {
      if (!user) return;
      const userId = user.id;
      localStorage.removeItem('nexus_pos_user');
      localStorage.removeItem('nexus_pos_firebase_config'); // Also clear cloud config
      
      const keys = await storage.keys();
      for (const key of keys) {
          if (key.startsWith(`nexus_pos_${userId}`)) {
              await storage.del(key);
          }
      }

      if (isCloudEnabled) await deleteUserData(userId);
      setUser(null);
  };

  const enableCloud = async (config: any) => {
      const success = initializeFirebase(config);
      if (success) {
          setIsCloudEnabled(true);
          localStorage.setItem('nexus_pos_firebase_config', JSON.stringify(config));
      }
      return success;
  };

  const loginCloud = async () => {
      if (!isCloudEnabled) return;
      await loginWithGoogle();
      // Listeners are attached in useEffect onAuthStateChange
  };

  // --- SMS Logic (Mobile Native) ---
  const triggerSms = async (transaction: Transaction, customer: Customer) => {
      if (!customer.phone) return;
      
      try {
          const templateId = customer.smsTemplateId;
          const template = (user?.preferences?.smsTemplates || []).find(t => t.id === templateId) 
                          || (user?.preferences?.smsTemplates || []).find(t => t.isDefault);
          
          let message = '';
          if (template) {
              message = template.content
                .replace(/<shopname>/gi, user?.name || 'Shop')
                .replace(/<customername>/gi, customer.name)
                .replace(/<latestcreditamount>/gi, transaction.total.toFixed(2))
                .replace(/<totalcreditamount>/gi, customer.balance.toFixed(2))
                .replace(/<date>/gi, new Date().toLocaleDateString())
                .replace(/<latestcredititems>/gi, transaction.items.map(i => `${i.quantity}x ${i.name}`).join(', '));
          } else {
              message = `Dear ${customer.name}, a bill of ${transaction.total.toFixed(2)} has been recorded. Current Balance: ${customer.balance.toFixed(2)}. Thanks, ${user?.name}`;
          }

          // Use native SMS protocol for all devices
          const ua = navigator.userAgent.toLowerCase();
          const isIos = /iphone|ipad|ipod/.test(ua);
          const separator = isIos ? '&' : '?';
          
          const encodedMessage = encodeURIComponent(message);
          window.location.href = `sms:${customer.phone}${separator}body=${encodedMessage}`;

      } catch (e) {
          console.error("SMS Failed", e);
      }
  };

  // --- Data Modifiers ---
  const addProduct = (p: Product) => {
      const updated = [...products, p];
      setProducts(updated);
      saveData('products', updated);
  };
  const updateProduct = (p: Product) => {
      const updated = products.map(item => item.id === p.id ? p : item);
      setProducts(updated);
      saveData('products', updated);
  };
  const deleteProduct = (id: string) => {
      const updated = products.filter(item => item.id !== id);
      setProducts(updated);
      saveData('products', updated);
  };

  const addCustomer = (c: Customer) => {
      const updated = [...customers, c];
      setCustomers(updated);
      saveData('customers', updated);
  };
  const updateCustomer = (c: Customer) => {
      const updated = customers.map(item => item.id === c.id ? c : item);
      setCustomers(updated);
      saveData('customers', updated);
  };
  const deleteCustomer = (id: string) => {
      const updated = customers.filter(item => item.id !== id);
      setCustomers(updated);
      saveData('customers', updated);
  };

  const processTransaction = (tx: Transaction) => {
      const updatedTransactions = [...transactions, tx];
      setTransactions(updatedTransactions);
      saveData('transactions', updatedTransactions);

      const updatedProducts = [...products];
      tx.items.forEach(cartItem => {
          const productIndex = updatedProducts.findIndex(p => p.id === cartItem.id);
          if (productIndex > -1) {
              const currentStock = updatedProducts[productIndex].stock;
              updatedProducts[productIndex] = {
                  ...updatedProducts[productIndex],
                  stock: round(currentStock - cartItem.quantity)
              };
          }
      });
      setProducts(updatedProducts);
      saveData('products', updatedProducts);

      let updatedCustomer = null;
      if (tx.customerId) {
          const custIndex = customers.findIndex(c => c.id === tx.customerId);
          if (custIndex > -1) {
              const cust = customers[custIndex];
              let newBalance = cust.balance;
              let newSpent = cust.totalSpent;

              if (tx.paymentMethod === 'account') {
                  newBalance = round(newBalance + tx.total);
                  newSpent = round(newSpent + tx.total);
              } else if (tx.type === 'payment') {
                  newBalance = round(newBalance - tx.total);
              } else {
                  newSpent = round(newSpent + tx.total);
              }

              const newCustomerData = {
                  ...cust,
                  balance: newBalance,
                  totalSpent: newSpent,
                  lastVisit: new Date().toISOString()
              };
              
              const updatedCustomers = [...customers];
              updatedCustomers[custIndex] = newCustomerData;
              setCustomers(updatedCustomers);
              saveData('customers', updatedCustomers);
              updatedCustomer = newCustomerData;
          }
      }

      if (updatedCustomer && updatedCustomer.smsEnabled) {
          triggerSms(tx, updatedCustomer);
      }

      setPosCart([]);
      setPosCustomer(null);
  };

  const updateOrderStatus = (id: string, status: 'completed' | 'queued' | 'cancelled', paymentMethod?: 'cash' | 'account' | 'upi') => {
      const index = transactions.findIndex(t => t.id === id);
      if (index === -1) return;

      const tx = transactions[index];
      const updatedTx = { ...tx, status, paymentMethod: paymentMethod || tx.paymentMethod };
      
      if (status === 'cancelled' && tx.status !== 'cancelled') {
           const updatedProducts = [...products];
           tx.items.forEach(cartItem => {
               const pIdx = updatedProducts.findIndex(p => p.id === cartItem.id);
               if (pIdx > -1) {
                   updatedProducts[pIdx].stock = round(updatedProducts[pIdx].stock + cartItem.quantity);
               }
           });
           setProducts(updatedProducts);
           saveData('products', updatedProducts);
      }

      if (status === 'completed' && paymentMethod === 'account' && tx.customerId && tx.status !== 'completed') {
           const cIdx = customers.findIndex(c => c.id === tx.customerId);
           if (cIdx > -1) {
               const c = customers[cIdx];
               const updatedC = { 
                   ...c, 
                   balance: round(c.balance + tx.total), 
                   totalSpent: round(c.totalSpent + tx.total) 
               };
               const updatedCs = [...customers];
               updatedCs[cIdx] = updatedC;
               setCustomers(updatedCs);
               saveData('customers', updatedCs);
               if (updatedC.smsEnabled) triggerSms(updatedTx, updatedC);
           }
      }

      const newTransactions = [...transactions];
      newTransactions[index] = updatedTx;
      setTransactions(newTransactions);
      saveData('transactions', newTransactions);
  };

  const deleteTransaction = (id: string) => {
      const newTransactions = transactions.filter(t => t.id !== id);
      setTransactions(newTransactions);
      saveData('transactions', newTransactions);
  };

  const addCategory = (cat: string) => { if (!categories.includes(cat)) { const up = [...categories, cat]; setCategories(up); saveData('categories', up); } };
  const deleteCategory = (cat: string) => { const up = categories.filter(c => c !== cat); setCategories(up); saveData('categories', up); };
  const addSeller = (s: string) => { if (!sellers.includes(s)) { const up = [...sellers, s]; setSellers(up); saveData('sellers', up); } };
  const deleteSeller = (s: string) => { const up = sellers.filter(x => x !== s); setSellers(up); saveData('sellers', up); };
  const addChargeRule = (r: ChargeRule) => { const up = [...chargeRules, r]; setChargeRules(up); saveData('chargerules', up); };
  const updateChargeRule = (r: ChargeRule) => { const up = chargeRules.map(x => x.id === r.id ? r : x); setChargeRules(up); saveData('chargerules', up); };
  const deleteChargeRule = (id: string) => { const up = chargeRules.filter(x => x.id !== id); setChargeRules(up); saveData('chargerules', up); };

  const importData = (json: any) => {
      if (json.products) { setProducts(json.products); saveData('products', json.products); }
      if (json.customers) { setCustomers(json.customers); saveData('customers', json.customers); }
      if (json.transactions) { setTransactions(json.transactions); saveData('transactions', json.transactions); }
      if (json.categories) { setCategories(json.categories); saveData('categories', json.categories); }
      if (json.chargeRules) { setChargeRules(json.chargeRules); saveData('chargerules', json.chargeRules); }
  };

  return (
    <ShopContext.Provider value={{
      user, login, logout, updateUser, deleteAccount, isLoading,
      isOnline, syncStatus,
      enableCloud, loginCloud, isCloudEnabled, isLocalSyncEnabled: !!dirHandle, connectLocalFolder,
      products, addProduct, updateProduct, deleteProduct,
      customers, addCustomer, updateCustomer, deleteCustomer,
      transactions, processTransaction, updateOrderStatus, deleteTransaction,
      categories, addCategory, deleteCategory,
      sellers, addSeller, deleteSeller,
      chargeRules, addChargeRule, updateChargeRule, deleteChargeRule,
      tags,
      posCart, setPosCart, posCustomer, setPosCustomer,
      importData
    }}>
      {children}
    </ShopContext.Provider>
  );
};