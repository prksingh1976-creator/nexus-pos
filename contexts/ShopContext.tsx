import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Customer, Transaction, User, ChargeRule } from '../types';
import { DEFAULT_CATEGORIES } from '../constants';
import * as Cloud from '../services/firebase';

interface ShopContextType {
  user: User | null;
  isCloudEnabled: boolean;
  enableCloud: (config: any) => Promise<boolean>;
  login: (user: User) => void;
  loginCloud: () => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  categories: string[];
  tags: string[];
  chargeRules: ChargeRule[];
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  processTransaction: (transaction: Transaction) => void;
  updateOrderStatus: (transactionId: string, status: 'completed' | 'queued' | 'cancelled', paymentMethod?: 'cash' | 'account' | 'upi') => void;
  addCategory: (category: string) => void;
  deleteCategory: (category: string) => void;
  addTag: (tag: string) => void;
  deleteTag: (tag: string) => void;
  updateUserUpi: (upiId: string) => void;
  addChargeRule: (rule: ChargeRule) => void;
  updateChargeRule: (rule: ChargeRule) => void;
  deleteChargeRule: (id: string) => void;
  importData: (data: any) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'nexus_pos_';
const FIREBASE_CONFIG_KEY = 'nexus_firebase_config';

// Helper for safe parsing
const safeParse = (key: string, fallback: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error parsing ${key} from localStorage`, e);
    return fallback;
  }
};

// Default setup data
const DEFAULT_TAGS = ['New', 'Sale', 'Best Seller'];
const DEFAULT_CHARGES: ChargeRule[] = [
    { id: 'tax-gst', name: 'GST (5%)', type: 'percent', value: 5, isDiscount: false, trigger: 'always', enabled: false },
];

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isCloudEnabled, setIsCloudEnabled] = useState(false);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [chargeRules, setChargeRules] = useState<ChargeRule[]>([]);

  // Initialize Firebase and Session
  useEffect(() => {
      // 1. Load Local Config & Initialize Firebase
      const savedConfig = safeParse(FIREBASE_CONFIG_KEY, null);
      let unsubscribeAuth = () => {};

      if (savedConfig) {
          const success = Cloud.initializeFirebase(savedConfig);
          if (success) {
              setIsCloudEnabled(true);
              
              // 2. Subscribe to Firebase Auth State (Handles persistence)
              unsubscribeAuth = Cloud.onAuthStateChange(async (fbUser) => {
                  if (fbUser) {
                      // Check if we need to restore session
                      const storedUser = safeParse(`${STORAGE_KEY_PREFIX}user`, null);
                      
                      // If no local user, or ID mismatch, sync from Cloud
                      if (!storedUser || storedUser.id !== fbUser.uid) {
                          console.log("Restoring session from Firebase...");
                          try {
                              const profile = await Cloud.getUserProfile(fbUser.uid);
                              const userData: User = profile || {
                                  id: fbUser.uid,
                                  name: fbUser.displayName || 'Shop Owner',
                                  email: fbUser.email || '',
                                  preferences: { theme: 'light' }
                              };
                              
                              setUser(userData);
                              // Sync to local storage
                              localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(userData));
                              localStorage.setItem(`${STORAGE_KEY_PREFIX}${userData.id}_profile`, JSON.stringify(userData));
                          } catch (e) {
                              console.error("Failed to restore cloud profile", e);
                          }
                      }
                  }
              });
          }
      }
      
      // 3. Load User from LocalStorage (Fast Path)
      const savedUser = safeParse(`${STORAGE_KEY_PREFIX}user`, null);
      if (savedUser) {
        setUser(savedUser);
      }

      return () => {
          unsubscribeAuth();
      }
  }, []);

  // Theme Management
  useEffect(() => {
    if (user?.preferences?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.preferences?.theme]);

  // Load Data: Local vs Cloud
  useEffect(() => {
    if (!user) return;

    let unsubProducts = () => {};
    let unsubCustomers = () => {};
    let unsubTransactions = () => {};
    let unsubCategories = () => {};
    let unsubTags = () => {};
    let unsubCharges = () => {};
    let unsubProfile = () => {};

    if (isCloudEnabled && Cloud.isFirebaseInitialized()) {
        console.log("Subscribing to Cloud Data for user:", user.id);
        // Cloud Mode: Subscribe to Firestore
        unsubProducts = Cloud.subscribeToCollection(user.id, 'products', (data) => data && setProducts(data));
        unsubCustomers = Cloud.subscribeToCollection(user.id, 'customers', (data) => data && setCustomers(data));
        unsubTransactions = Cloud.subscribeToCollection(user.id, 'transactions', (data) => data && setTransactions(data));
        unsubCategories = Cloud.subscribeToCollection(user.id, 'categories', (data) => data && setCategories(data));
        unsubTags = Cloud.subscribeToCollection(user.id, 'tags', (data) => data && setTags(data));
        unsubCharges = Cloud.subscribeToCollection(user.id, 'chargerules', (data) => data && setChargeRules(data));
        
        // Subscribe to Profile Settings (Shop Name, UPI, Theme)
        unsubProfile = Cloud.subscribeToProfile(user.id, (profile) => {
            if (profile) {
                 setUser(prev => {
                     // Only update if something changed to avoid render loops
                     if (prev && JSON.stringify(prev) !== JSON.stringify(profile)) {
                         localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(profile));
                         localStorage.setItem(`${STORAGE_KEY_PREFIX}${profile.id}_profile`, JSON.stringify(profile));
                         return profile;
                     }
                     return prev;
                 });
            }
        });
    } else {
        // Local Mode: Load from LocalStorage
        const p = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_products`, []);
        const c = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_customers`, []);
        const t = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_transactions`, []);
        const cats = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_categories`, DEFAULT_CATEGORIES);
        const tgs = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_tags`, DEFAULT_TAGS);
        const cr = safeParse(`${STORAGE_KEY_PREFIX}${user.id}_chargerules`, DEFAULT_CHARGES);

        setProducts(p);
        setCustomers(c);
        setTransactions(t);
        setCategories(cats);
        setTags(tgs);
        setChargeRules(cr);
    }

    return () => {
        unsubProducts();
        unsubCustomers();
        unsubTransactions();
        unsubCategories();
        unsubTags();
        unsubCharges();
        unsubProfile();
    };
  }, [user?.id, isCloudEnabled]);

  // Unified Data Saver
  const saveData = (key: string, data: any) => {
    if (!user) return;
    
    // Always save to LocalStorage as backup/cache
    try {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}_${key}`, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save local data", e);
    }

    // If Cloud Enabled, sync to Firestore
    if (isCloudEnabled && Cloud.isFirebaseInitialized()) {
        Cloud.saveToCloud(user.id, key, data);
    }
  };

  const enableCloud = async (config: any) => {
      const success = Cloud.initializeFirebase(config);
      if (success) {
          localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
          setIsCloudEnabled(true);
      }
      return success;
  };

  const loginCloud = async () => {
      try {
          const firebaseUser = await Cloud.loginWithGoogle();
          if (firebaseUser) {
              const profile = await Cloud.getUserProfile(firebaseUser.uid);
              const userData: User = profile || {
                  id: firebaseUser.uid,
                  name: firebaseUser.displayName || 'Shop Owner',
                  email: firebaseUser.email || '',
                  preferences: { theme: 'light' }
              };
              login(userData);
          }
      } catch (e) {
          console.error("Cloud Login Failed", e);
          throw e;
      }
  };

  const login = (newUser: User) => {
    if (!newUser.preferences) {
        newUser.preferences = { theme: 'light' };
    }
    setUser(newUser);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(newUser));
    // Save persistent profile for re-login
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${newUser.id}_profile`, JSON.stringify(newUser));
    
    if (isCloudEnabled) {
        Cloud.saveUserProfile(newUser.id, newUser);
    }
  };

  const logout = async () => {
    if (isCloudEnabled) {
        try {
            await Cloud.logoutFromCloud();
        } catch (e) {
            console.error("Cloud logout failed", e);
        }
    }
    
    // First clear user to trigger redirections
    setUser(null);
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}user`);
    
    // Then clear data state safely
    setTimeout(() => {
        setProducts([]);
        setCustomers([]);
        setTransactions([]);
        setCategories([]);
        setTags([]);
        setChargeRules([]);
        document.documentElement.classList.remove('dark');
    }, 0);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      if (updates.preferences && user.preferences) {
        updatedUser.preferences = { ...user.preferences, ...updates.preferences };
      }
      setUser(updatedUser);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(updatedUser));
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${updatedUser.id}_profile`, JSON.stringify(updatedUser));
      
      if (isCloudEnabled) Cloud.saveUserProfile(updatedUser.id, updatedUser);
    }
  };

  const updateUserUpi = (upiId: string) => {
    updateUser({ upiId });
  };

  // --- Data Mutators (Wrapped with saveData) ---

  const addProduct = (product: Product) => {
    const updated = [...products, product];
    setProducts(updated);
    saveData('products', updated);
  };

  const updateProduct = (product: Product) => {
    const updated = products.map(p => p.id === product.id ? product : p);
    setProducts(updated);
    saveData('products', updated);
  };

  const deleteProduct = (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    saveData('products', updated);
  };

  const addCustomer = (customer: Customer) => {
    const updated = [...customers, customer];
    setCustomers(updated);
    saveData('customers', updated);
  };

  const updateCustomer = (customer: Customer) => {
    const updated = customers.map(c => c.id === customer.id ? customer : c);
    setCustomers(updated);
    saveData('customers', updated);
  };

  const addChargeRule = (rule: ChargeRule) => {
    const updated = [...chargeRules, rule];
    setChargeRules(updated);
    saveData('chargerules', updated);
  };

  const updateChargeRule = (rule: ChargeRule) => {
    const updated = chargeRules.map(r => r.id === rule.id ? rule : r);
    setChargeRules(updated);
    saveData('chargerules', updated);
  };

  const deleteChargeRule = (id: string) => {
    const updated = chargeRules.filter(r => r.id !== id);
    setChargeRules(updated);
    saveData('chargerules', updated);
  };

  const applyTransactionToCustomer = (transaction: Transaction, customerList: Customer[]) => {
      if (!transaction.customerId) return customerList;

      const custIndex = customerList.findIndex(c => c.id === transaction.customerId);
      if (custIndex > -1) {
          const updatedCustomers = [...customerList];
          const customer = { ...updatedCustomers[custIndex] };
          customer.lastVisit = new Date().toISOString();
          
          if (transaction.paymentMethod === 'account') {
            customer.balance += transaction.total;
          } else if (transaction.type === 'payment') {
            customer.balance -= transaction.total;
          } else {
              customer.totalSpent += transaction.total;
          }
          updatedCustomers[custIndex] = customer;
          return updatedCustomers;
      }
      return customerList;
  };

  const processTransaction = (transaction: Transaction) => {
    const updatedTransactions = [transaction, ...transactions];
    setTransactions(updatedTransactions);
    saveData('transactions', updatedTransactions);

    // Update Stock
    const updatedProducts = [...products];
    transaction.items.forEach(item => {
      const prodIndex = updatedProducts.findIndex(p => p.id === item.id);
      if (prodIndex > -1) {
        updatedProducts[prodIndex].stock -= item.quantity;
      }
    });
    setProducts(updatedProducts);
    saveData('products', updatedProducts);

    // Update Customer
    if (transaction.customerId && transaction.status !== 'queued') {
      const updatedCustomers = applyTransactionToCustomer(transaction, customers);
      setCustomers(updatedCustomers);
      saveData('customers', updatedCustomers);
    }
  };

  const updateOrderStatus = (transactionId: string, status: 'completed' | 'queued' | 'cancelled', paymentMethod?: 'cash' | 'account' | 'upi') => {
      let updatedTransactions = [...transactions];
      const txIndex = updatedTransactions.findIndex(t => t.id === transactionId);
      
      if (txIndex === -1) return;

      const oldStatus = updatedTransactions[txIndex].status;
      const transaction = { ...updatedTransactions[txIndex], status };

      if (paymentMethod) {
          transaction.paymentMethod = paymentMethod;
      }

      updatedTransactions[txIndex] = transaction;
      setTransactions(updatedTransactions);
      saveData('transactions', updatedTransactions);

      if (oldStatus === 'queued' && status === 'completed') {
          const updatedCustomers = applyTransactionToCustomer(transaction, customers);
          setCustomers(updatedCustomers);
          saveData('customers', updatedCustomers);
      }

      if (status === 'cancelled' && oldStatus !== 'cancelled') {
            const updatedProducts = [...products];
            transaction.items.forEach(item => {
                const prodIndex = updatedProducts.findIndex(p => p.id === item.id);
                if (prodIndex > -1) {
                    updatedProducts[prodIndex].stock += item.quantity;
                }
            });
            setProducts(updatedProducts);
            saveData('products', updatedProducts);
      }
  };

  const addCategory = (category: string) => {
    if (!categories.includes(category)) {
      const updated = [...categories, category];
      setCategories(updated);
      saveData('categories', updated);
    }
  };

  const deleteCategory = (category: string) => {
    const updated = categories.filter(c => c !== category);
    setCategories(updated);
    saveData('categories', updated);
  };

  const addTag = (tag: string) => {
    if (!tags.includes(tag)) {
      const updated = [...tags, tag];
      setTags(updated);
      saveData('tags', updated);
    }
  };

  const deleteTag = (tag: string) => {
    const updated = tags.filter(t => t !== tag);
    setTags(updated);
    saveData('tags', updated);
  };

  const importData = (data: any) => {
    if (!data || !data.user) {
        alert("Invalid backup data: User profile missing.");
        return;
    }
    const uid = data.user.id;
    const prefix = `${STORAGE_KEY_PREFIX}${uid}_`;
    
    // Save to Local
    localStorage.setItem(`${STORAGE_KEY_PREFIX}user`, JSON.stringify(data.user));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}_profile`, JSON.stringify(data.user));
    if (data.products) localStorage.setItem(prefix + 'products', JSON.stringify(data.products));
    if (data.customers) localStorage.setItem(prefix + 'customers', JSON.stringify(data.customers));
    if (data.transactions) localStorage.setItem(prefix + 'transactions', JSON.stringify(data.transactions));
    if (data.categories) localStorage.setItem(prefix + 'categories', JSON.stringify(data.categories));
    if (data.tags) localStorage.setItem(prefix + 'tags', JSON.stringify(data.tags));
    if (data.chargeRules) localStorage.setItem(prefix + 'chargerules', JSON.stringify(data.chargeRules));

    // Update State
    setUser(data.user);
    if (data.products) setProducts(data.products);
    if (data.customers) setCustomers(data.customers);
    if (data.transactions) setTransactions(data.transactions);
    if (data.categories) setCategories(data.categories);
    if (data.tags) setTags(data.tags);
    if (data.chargeRules) setChargeRules(data.chargeRules);

    // If Cloud Enabled, overwrite cloud with this import
    if (isCloudEnabled) {
        if(confirm("Do you want to upload this imported data to the Cloud? This will overwrite existing cloud data.")) {
             if (data.products) Cloud.saveToCloud(uid, 'products', data.products);
             if (data.customers) Cloud.saveToCloud(uid, 'customers', data.customers);
             if (data.transactions) Cloud.saveToCloud(uid, 'transactions', data.transactions);
             if (data.categories) Cloud.saveToCloud(uid, 'categories', data.categories);
             if (data.tags) Cloud.saveToCloud(uid, 'tags', data.tags);
             if (data.chargeRules) Cloud.saveToCloud(uid, 'chargerules', data.chargeRules);
             Cloud.saveUserProfile(uid, data.user);
        }
    }
  };

  return (
    <ShopContext.Provider value={{
      user, isCloudEnabled, enableCloud, login, loginCloud, logout, updateUser,
      products, customers, transactions, categories, tags, chargeRules,
      addProduct, updateProduct, deleteProduct,
      addCustomer, updateCustomer,
      processTransaction, updateOrderStatus, updateUserUpi,
      addCategory, deleteCategory, addTag, deleteTag,
      addChargeRule, updateChargeRule, deleteChargeRule,
      importData
    }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) throw new Error("useShop must be used within a ShopProvider");
  return context;
};