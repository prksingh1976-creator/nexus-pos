import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Product, CartItem, Customer, AppliedCharge, Transaction } from '../types';
import { Icons, getCategoryIcon } from '../constants';
import QRCode from 'qrcode';

export const POS: React.FC = () => {
  const { products, customers, processTransaction, categories, user, chargeRules } = useShop();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  
  // Checkout States
  const [checkoutStep, setCheckoutStep] = useState<'method' | 'upi_scan'>('method');
  const [upiQrCode, setUpiQrCode] = useState<string | null>(null);

  // Receipt Modal State
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Per-Transaction Charge Toggles (Set of disabled Rule IDs for this session)
  const [disabledChargeIds, setDisabledChargeIds] = useState<Set<string>>(new Set());

  // Custom Ad-Hoc Charges (One-time use)
  const [customCharges, setCustomCharges] = useState<{ id: string, name: string, amount: number, isDiscount: boolean }[]>([]);

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Grouping Logic for Variants (Same Name => Same Group)
  const groupedProducts = useMemo(() => {
      const groups: Record<string, Product[]> = {};
      filteredProducts.forEach(p => {
          if (!groups[p.name]) groups[p.name] = [];
          groups[p.name].push(p);
      });
      return groups;
  }, [filteredProducts]);

  // Cart Logic
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Dynamic Charge Calculation
  const appliedCharges: AppliedCharge[] = useMemo(() => {
      if (cartSubtotal === 0) return [];

      const rules = chargeRules
        .filter(rule => rule.enabled && !disabledChargeIds.has(rule.id))
        .filter(rule => {
            if (rule.trigger === 'always') return true;
            if (rule.trigger === 'amount_threshold') return cartSubtotal > (rule.threshold || 0);
            if (rule.trigger === 'customer_assigned') return !!selectedCustomer;
            return false;
        })
        .map(rule => {
            let amount = 0;
            if (rule.type === 'fixed') {
                amount = rule.value;
            } else {
                amount = (cartSubtotal * rule.value) / 100;
            }
            return {
                name: rule.name,
                amount: amount,
                isDiscount: rule.isDiscount
            };
        });

      const customs = customCharges.map(c => ({
          name: c.name,
          amount: c.amount,
          isDiscount: c.isDiscount
      }));

      return [...rules, ...customs];
  }, [cartSubtotal, chargeRules, selectedCustomer, disabledChargeIds, customCharges]);

  const finalTotal = useMemo(() => {
      const chargesTotal = appliedCharges.reduce((acc, c) => c.isDiscount ? acc - c.amount : acc + c.amount, 0);
      return Math.max(0, cartSubtotal + chargesTotal);
  }, [cartSubtotal, appliedCharges]);

  const toggleCharge = (ruleId: string) => {
      setDisabledChargeIds(prev => {
          const next = new Set(prev);
          if (next.has(ruleId)) {
              next.delete(ruleId);
          } else {
              next.add(ruleId);
          }
          return next;
      });
  };

  // Custom Charge Handlers
  const addCustomCharge = () => {
      setCustomCharges(prev => [...prev, { id: crypto.randomUUID(), name: 'Extra Charge', amount: 0, isDiscount: false }]);
  };

  const updateCustomCharge = (id: string, field: keyof typeof customCharges[0], value: any) => {
      setCustomCharges(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCustomCharge = (id: string) => {
      setCustomCharges(prev => prev.filter(c => c.id !== id));
  };

  const generateUpiQr = async () => {
      const upiId = user?.upiId;
      if (!upiId) {
          alert("UPI ID not configured. Please add it in Account Settings.");
          return;
      }

      const name = encodeURIComponent(user?.name || 'Nexus Shop');
      const amount = finalTotal.toFixed(2);
      const upiUrl = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`; 
      
      try {
          const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 300 });
          setUpiQrCode(qrDataUrl);
          setCheckoutStep('upi_scan');
      } catch (err) {
          console.error(err);
          alert("Failed to generate QR Code");
      }
  };

  const handleCompleteTransaction = (method: 'cash' | 'account' | 'upi', status: 'completed' | 'queued') => {
    if (method === 'account' && !selectedCustomer) {
      alert("Please select a customer for account credit.");
      return;
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      customerId: selectedCustomer ? selectedCustomer.id : null,
      customerName: selectedCustomer ? selectedCustomer.name : 'Guest',
      date: new Date().toISOString(),
      items: cart,
      subtotal: cartSubtotal,
      charges: appliedCharges,
      total: finalTotal,
      type: 'sale',
      paymentMethod: method,
      status: status
    };

    processTransaction(transaction);

    // Show Receipt
    setLastTransaction(transaction);
    setShowReceipt(true);

    // Reset
    setCart([]);
    setSelectedCustomer(null);
    setShowCheckoutModal(false);
    setCheckoutStep('method');
    setShowCartMobile(false);
    setDisabledChargeIds(new Set()); // Reset toggle state
    setCustomCharges([]); // Reset custom charges
  };

  return (
    <div className="flex h-full relative flex-col md:flex-row">
      {/* Left: Products Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
        {/* Header Filters */}
        <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-10 transition-colors">
            <div className="flex space-x-4 mb-4">
                <input 
                    type="text" 
                    placeholder="Search products..." 
                    className="flex-1 bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'All' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                    All Items
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900 transition-colors">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 md:pb-4">
                {Object.keys(groupedProducts).map(productName => {
                    const group = groupedProducts[productName];
                    const firstItem = group[0];
                    const hasMultipleVariants = group.length > 1 || !!firstItem.variant;

                    return (
                        <div 
                            key={productName} 
                            onClick={() => !hasMultipleVariants ? addToCart(firstItem) : null}
                            className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md flex flex-col overflow-hidden ${!hasMultipleVariants && firstItem.stock === 0 ? 'opacity-50 grayscale pointer-events-none' : ''} ${!hasMultipleVariants ? 'cursor-pointer active:scale-95' : ''}`}
                        >
                            {/* Card Header (Category Icon Only) */}
                            <div className="p-4 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/50">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20`}>
                                    {getCategoryIcon(firstItem.category)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base leading-tight line-clamp-2">{productName}</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">{firstItem.seller}</p>
                                </div>
                            </div>

                            {/* Card Body: Variants or Single Price */}
                            <div className="p-4 pt-3 flex-1 flex flex-col justify-end">
                                {hasMultipleVariants ? (
                                    <div className="space-y-2 w-full">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Select Size</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {group.sort((a,b) => a.price - b.price).map(variant => (
                                                <button
                                                    key={variant.id}
                                                    onClick={(e) => { e.stopPropagation(); addToCart(variant); }}
                                                    disabled={variant.stock === 0}
                                                    className={`py-2 px-1 text-xs font-bold rounded border transition-colors ${
                                                        variant.stock === 0 
                                                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 border-transparent cursor-not-allowed' 
                                                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                                                    }`}
                                                >
                                                    <span className="block truncate">{variant.variant || 'Standard'}</span>
                                                    <span className="block">₹{variant.price}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center w-full mt-2">
                                        <span className="font-bold text-blue-600 text-xl">₹{firstItem.price.toFixed(2)}</span>
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${firstItem.stock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700'}`}>
                                            {firstItem.stock > 0 ? `${firstItem.stock} Left` : 'Out of Stock'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      {cart.length > 0 && (
        <button 
          onClick={() => setShowCartMobile(true)}
          className="md:hidden fixed bottom-4 right-4 left-4 bg-blue-600 text-white p-4 rounded-xl shadow-xl flex justify-between items-center z-20 font-bold"
        >
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 px-2 py-1 rounded text-sm">{totalItems}</span>
            <span>View Order</span>
          </div>
          <span>₹{finalTotal.toFixed(2)}</span>
        </button>
      )}

      {/* Right: Cart (Responsive) */}
      <div className={`
         fixed inset-0 z-30 bg-white dark:bg-slate-800 md:static md:w-96 md:border-l md:border-slate-200 dark:md:border-slate-700 flex flex-col h-full shadow-xl transition-all duration-300 transform
         ${showCartMobile ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
      `}>
        {/* Mobile Cart Header Close */}
        <div className="md:hidden p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">Current Order</h2>
            <button onClick={() => setShowCartMobile(false)} className="p-2 bg-white dark:bg-slate-700 rounded-full text-slate-500 shadow-sm"><Icons.X /></button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hidden md:block transition-colors">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                <span className="mr-2"><Icons.Cart /></span> Current Order
            </h2>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 transition-colors">
            {/* Customer Selector */}
             <select 
                className="w-full p-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm outline-none focus:border-blue-500 text-slate-700 dark:text-white"
                value={selectedCustomer?.id || ''}
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
            >
                <option value="">Guest Customer</option>
                {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.balance > 0 ? `(Owes ₹${c.balance})` : ''}</option>
                ))}
            </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                    <Icons.Cart />
                    <p className="mt-2 text-sm font-medium">Cart is empty</p>
                </div>
            ) : (
                cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center group">
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                {item.name} 
                                {item.variant && <span className="text-slate-500 dark:text-slate-400 ml-1 font-normal">({item.variant})</span>}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">₹{item.price.toFixed(2)} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                             <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold">-</button>
                             <span className="text-sm w-4 text-center font-medium text-slate-800 dark:text-white">{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold">+</button>
                             <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 ml-2 md:opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                <Icons.Trash />
                             </button>
                        </div>
                        <div className="ml-4 w-16 text-right font-bold text-slate-800 dark:text-white">
                            ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Cart Footer: Breakdown */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-8 md:pb-6 transition-colors">
            
            {/* Charge breakdown and toggles */}
            {cart.length > 0 && (
                <div className="mb-4 space-y-1">
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>₹{cartSubtotal.toFixed(2)}</span>
                    </div>
                    {/* Active Charges List (Automated) */}
                    {chargeRules.filter(r => r.enabled).map(rule => {
                        const isApplies = (rule.trigger === 'always') ||
                                          (rule.trigger === 'amount_threshold' && cartSubtotal > (rule.threshold || 0)) ||
                                          (rule.trigger === 'customer_assigned' && !!selectedCustomer);
                        
                        if (!isApplies) return null;

                        const isDisabled = disabledChargeIds.has(rule.id);
                        let amount = rule.type === 'fixed' ? rule.value : (cartSubtotal * rule.value) / 100;
                        const displayAmount = isDisabled ? 0 : amount;

                        return (
                             <div key={rule.id} className="flex justify-between items-center text-sm group">
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => toggleCharge(rule.id)}
                                        className={`w-4 h-4 rounded border flex items-center justify-center ${isDisabled ? 'border-slate-300' : 'bg-blue-600 border-blue-600'}`}
                                    >
                                        {!isDisabled && <span className="text-white text-[10px]">✓</span>}
                                    </button>
                                    <span className={`${isDisabled ? 'text-slate-400 line-through' : rule.isDiscount ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {rule.name}
                                    </span>
                                </div>
                                <span className={`${isDisabled ? 'text-slate-400 line-through' : rule.isDiscount ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {rule.isDiscount ? '-' : ''}₹{displayAmount.toFixed(2)}
                                </span>
                            </div>
                        );
                    })}

                    {/* Custom Ad-Hoc Charges */}
                    {customCharges.map((custom) => (
                        <div key={custom.id} className="flex items-center gap-2 mt-1">
                            <input 
                                type="text"
                                className="flex-1 min-w-0 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-xs text-slate-800 dark:text-white"
                                value={custom.name}
                                onChange={(e) => updateCustomCharge(custom.id, 'name', e.target.value)}
                            />
                            <div className="flex items-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded overflow-hidden">
                                <button
                                    onClick={() => updateCustomCharge(custom.id, 'isDiscount', !custom.isDiscount)}
                                    className={`px-1.5 py-1 text-xs font-bold ${custom.isDiscount ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}
                                >
                                    {custom.isDiscount ? '-' : '+'}
                                </button>
                                <input 
                                    type="number"
                                    className="w-16 px-1 py-1 text-xs text-right border-l border-slate-300 dark:border-slate-600 bg-transparent text-slate-800 dark:text-white outline-none"
                                    value={custom.amount}
                                    onChange={(e) => updateCustomCharge(custom.id, 'amount', Number(e.target.value))}
                                    placeholder="0"
                                />
                            </div>
                            <button 
                                onClick={() => removeCustomCharge(custom.id)}
                                className="text-slate-400 hover:text-red-500"
                            >
                                <Icons.X />
                            </button>
                        </div>
                    ))}

                    <button 
                        onClick={addCustomCharge}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center mt-2"
                    >
                        <span className="mr-1 text-lg leading-none">+</span> Add Custom Charge
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center mb-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Total</span>
                <span className="text-3xl font-bold text-slate-900 dark:text-white">₹{finalTotal.toFixed(2)}</span>
            </div>
            <button 
                onClick={() => setShowCheckoutModal(true)}
                disabled={cart.length === 0}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all"
            >
                Checkout
            </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
                
                {checkoutStep === 'method' && (
                  <>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Payment Method</h3>
                        <button onClick={() => setShowCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Icons.X /></button>
                    </div>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => handleCompleteTransaction('cash', 'completed')} 
                            className="w-full py-4 border-2 border-slate-100 dark:border-slate-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl flex items-center px-4 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold mr-4 group-hover:scale-110 transition-transform text-lg">₹</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 dark:text-white">Cash</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Accept cash from customer</p>
                            </div>
                        </button>

                        <button 
                            onClick={() => handleCompleteTransaction('account', 'completed')} 
                            disabled={!selectedCustomer}
                            className="w-full py-4 border-2 border-slate-100 dark:border-slate-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl flex items-center px-4 transition-all group disabled:opacity-50 disabled:hover:border-slate-100 disabled:hover:bg-transparent"
                        >
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold mr-4 group-hover:scale-110 transition-transform">A</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 dark:text-white">Store Credit / Tab</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedCustomer ? `Charge to ${selectedCustomer.name}` : 'Select customer first'}</p>
                            </div>
                        </button>

                        {/* UPI Option */}
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
                             <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">UPI Payment</label>
                             <button 
                                onClick={generateUpiQr}
                                className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                             >
                                <Icons.QRCode /> Generate QR Code
                             </button>
                             {!user?.upiId && (
                                <p className="text-xs text-red-400 mt-2 text-center">
                                    Setup UPI ID in Account Settings first.
                                </p>
                             )}
                        </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                        <button 
                           onClick={() => handleCompleteTransaction('cash', 'queued')} 
                           className="w-full py-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-xl font-bold transition-colors"
                        >
                           Place Order as Queued (Pay Later)
                        </button>
                    </div>
                  </>
                )}

                {checkoutStep === 'upi_scan' && (
                    <div className="text-center">
                        <div className="flex justify-between items-center mb-4">
                             <button onClick={() => setCheckoutStep('method')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Back</button>
                             <h3 className="text-xl font-bold text-slate-800 dark:text-white">Scan to Pay</h3>
                             <div className="w-8"></div>
                        </div>
                        
                        <div className="bg-white border-2 border-slate-800 p-4 rounded-xl inline-block mb-4">
                            {upiQrCode && <img src={upiQrCode} alt="UPI QR Code" className="w-64 h-64" />}
                        </div>
                        
                        <p className="text-lg font-bold text-slate-800 dark:text-white mb-1">₹{finalTotal.toFixed(2)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Scan with any UPI App</p>

                        <div className="space-y-3">
                             <button 
                                onClick={() => handleCompleteTransaction('upi', 'completed')}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200"
                             >
                                Payment Received
                             </button>
                             <button 
                                onClick={() => handleCompleteTransaction('upi', 'queued')}
                                className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-xl font-medium"
                             >
                                Mark as Queued
                             </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-sm flex flex-col items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                      <Icons.Sparkles /> 
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Transaction Successful!</h3>
                  <p className="text-slate-500 text-sm mb-6">Order #{lastTransaction.id.slice(0, 8)}</p>

                  <div className="w-full bg-slate-50 dark:bg-slate-900 p-4 rounded-lg mb-6 border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="text-slate-800 dark:text-white font-medium">₹{lastTransaction.subtotal.toFixed(2)}</span>
                      </div>
                      {lastTransaction.charges.map((c, i) => (
                          <div key={i} className="flex justify-between text-sm mb-1">
                              <span className="text-slate-500">{c.name}</span>
                              <span className={c.isDiscount ? 'text-green-600' : 'text-slate-500'}>
                                  {c.isDiscount ? '-' : ''}₹{c.amount.toFixed(2)}
                              </span>
                          </div>
                      ))}
                      <div className="border-t border-slate-200 dark:border-slate-700 my-2"></div>
                      <div className="flex justify-between text-lg font-bold">
                          <span className="text-slate-800 dark:text-white">Total</span>
                          <span className="text-blue-600">₹{lastTransaction.total.toFixed(2)}</span>
                      </div>
                  </div>

                  <button 
                    onClick={() => setShowReceipt(false)}
                    className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg font-medium transition-colors"
                  >
                      Close & New Sale
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};