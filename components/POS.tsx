import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShop } from '../contexts/ShopContext';
import { Product, CartItem, Customer, AppliedCharge, Transaction } from '../types';
import { Icons, getCategoryIcon } from '../constants';
import QRCode from 'qrcode';
import { getAllFaceDescriptors, findBestMatch, loadFaceModels } from '../services/faceRecService';

export const POS: React.FC = () => {
  const { 
    products, customers, processTransaction, categories, user, chargeRules,
    posCart, setPosCart, posCustomer, setPosCustomer 
  } = useShop();
  
  const location = useLocation();
  const navigate = useNavigate();

  // Alias context state to local variables for cleaner code
  const cart = posCart;
  const setCart = setPosCart;
  const selectedCustomer = posCustomer;
  const setSelectedCustomer = setPosCustomer;

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  
  // Checkout States
  const [checkoutStep, setCheckoutStep] = useState<'method' | 'upi_scan'>('method');
  const [upiQrCode, setUpiQrCode] = useState<string | null>(null);
  const [queueName, setQueueName] = useState('');

  // Receipt Modal State
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Variable Price Modal State
  const [variableProduct, setVariableProduct] = useState<Product | null>(null);
  const [variableInputType, setVariableInputType] = useState<'price' | 'quantity'>('price');
  const [variableInputValue, setVariableInputValue] = useState('');

  // Face Rec State
  const sentryVideoRef = useRef<HTMLVideoElement>(null);
  const sentryStreamRef = useRef<MediaStream | null>(null);
  const [detectedCustomers, setDetectedCustomers] = useState<Customer[]>([]);

  // Per-Transaction Charge Toggles
  const [disabledChargeIds, setDisabledChargeIds] = useState<Set<string>>(new Set());
  const [customCharges, setCustomCharges] = useState<{ id: string, name: string, amount: number, isDiscount: boolean }[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Settings for Camera Widget
  const camSize = user?.preferences?.camPreviewSize || 'small';
  const showCam = user?.preferences?.showCamPreview ?? true;

  // Load Order from Navigation (Edit Mode)
  useEffect(() => {
    if (location.state && location.state.cart) {
        setCart(location.state.cart);
        if (location.state.customerId) {
            const customer = customers.find(c => c.id === location.state.customerId);
            if (customer) setSelectedCustomer(customer);
        }
        if (location.state.queueName) {
            setQueueName(location.state.queueName);
        }
        // Clear history state to prevent reload loop
        navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, customers, navigate, setCart, setSelectedCustomer]);

  // Sync Queue Name with Customer
  useEffect(() => {
    if (selectedCustomer) {
        setQueueName(selectedCustomer.name);
    }
  }, [selectedCustomer]);

  // Face Recognition Sentry Logic with Robust Cleanup
  useEffect(() => {
      let interval: any;
      let activeStream: MediaStream | null = null;
      let isMounted = true;

      const startCamera = async () => {
         try {
            if (!isMounted) return;
            await loadFaceModels();
            
            if (!isMounted) return;
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
            
            // Critical check: If component unmounted while awaiting user permission or stream
            if (!isMounted) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            activeStream = stream;
            sentryStreamRef.current = stream;

            if (sentryVideoRef.current) {
                sentryVideoRef.current.srcObject = stream;
                try {
                    await sentryVideoRef.current.play();
                } catch (e) {
                    console.log("Play interrupted", e);
                }
            }

            // Start Scan Loop
            interval = setInterval(async () => {
                if (!isMounted) return;
                if (!sentryVideoRef.current || sentryVideoRef.current.paused || sentryVideoRef.current.ended) return;
                
                const descriptors = await getAllFaceDescriptors(sentryVideoRef.current);
                
                if (isMounted && descriptors.length > 0) {
                    const matches: Customer[] = [];
                    descriptors.forEach(desc => {
                        const match = findBestMatch(desc, customers);
                        if (match) matches.push(match);
                    });
                    
                    const uniqueMatches = Array.from(new Map(matches.map(c => [c.id, c])).values());
                    setDetectedCustomers(uniqueMatches);
                } else if (isMounted) {
                    setDetectedCustomers([]);
                }
            }, 1000);
         } catch (err) {
             console.error("Face Rec Camera Error:", err);
         }
      };

      if (user?.preferences?.enableFaceRecognition) {
          startCamera();
      }

      return () => {
          isMounted = false;
          if (interval) clearInterval(interval);
          
          if (activeStream) {
              activeStream.getTracks().forEach(t => t.stop());
          }
          if (sentryStreamRef.current) {
              sentryStreamRef.current.getTracks().forEach(t => t.stop());
              sentryStreamRef.current = null;
          }
      };
  }, [user?.preferences?.enableFaceRecognition, customers]);

  // Filtering Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (p.variant && p.variant.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Grouping Logic for Variants
  const groupedProducts = useMemo(() => {
      const groups: Record<string, Product[]> = {};
      filteredProducts.forEach(p => {
          if (!groups[p.name]) groups[p.name] = [];
          groups[p.name].push(p);
      });
      return groups;
  }, [filteredProducts]);

  // Cart Logic
  const addToCart = (product: Product, quantityOverride?: number, priceOverride?: number) => {
    if (product.stock <= 0 && !quantityOverride) return; 

    if (product.isVariablePrice && quantityOverride === undefined) {
        setVariableProduct(product);
        setVariableInputValue('');
        setVariableInputType('price');
        return;
    }

    setCart(prev => {
      const qtyToAdd = quantityOverride || 1;
      const finalPrice = priceOverride !== undefined ? priceOverride : product.price;

      const existingItemIndex = prev.findIndex(item => item.id === product.id && Math.abs(item.price - finalPrice) < 0.01);

      if (existingItemIndex > -1) {
        const item = prev[existingItemIndex];
        if (item.quantity + qtyToAdd > product.stock) return prev;
        
        const newCart = [...prev];
        newCart[existingItemIndex] = { ...item, quantity: item.quantity + qtyToAdd };
        return newCart;
      }
      
      return [...prev, { ...product, quantity: qtyToAdd, price: finalPrice }];
    });
  };

  const handleVariableSubmit = () => {
      if (!variableProduct || !variableInputValue) return;
      const val = parseFloat(variableInputValue);
      if (isNaN(val) || val <= 0) return;

      if (variableInputType === 'quantity') {
          addToCart(variableProduct, val); 
      } else {
          if (variableProduct.price > 0) {
              const calculatedQty = val / variableProduct.price;
              addToCart(variableProduct, calculatedQty);
          } else {
              addToCart(variableProduct, 1, val);
          }
      }
      setVariableProduct(null);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        const exactMatch = products.find(p => p.name.toLowerCase() === searchTerm.toLowerCase() || p.id === searchTerm);
        
        if (exactMatch) {
            addToCart(exactMatch);
            setSearchTerm('');
        } else if (filteredProducts.length === 1) {
            addToCart(filteredProducts[0]);
            setSearchTerm('');
        }
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => {
        const newCart = [...prev];
        const item = newCart[index];
        const newQty = Math.max(0.01, item.quantity + delta);
        
        if (newQty > item.stock && delta > 0) return prev;
        
        newCart[index] = { ...item, quantity: parseFloat(newQty.toFixed(3)) };
        return newCart;
    });
  };

  const removeItem = (index: number) => {
      setCart(prev => prev.filter((_, i) => i !== index));
  }

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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

      return [...rules, ...customCharges];
  }, [cartSubtotal, chargeRules, selectedCustomer, disabledChargeIds, customCharges]);

  const finalTotal = useMemo(() => {
      const chargesTotal = appliedCharges.reduce((acc, c) => c.isDiscount ? acc - c.amount : acc + c.amount, 0);
      return Math.max(0, cartSubtotal + chargesTotal);
  }, [cartSubtotal, appliedCharges]);

  const toggleCharge = (ruleId: string) => {
      setDisabledChargeIds(prev => {
          const next = new Set(prev);
          if (next.has(ruleId)) next.delete(ruleId);
          else next.add(ruleId);
          return next;
      });
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

  const handleCompleteTransaction = (method: 'cash' | 'account' | 'upi' | 'pending', status: 'completed' | 'queued') => {
    if (method === 'account') {
        if (!selectedCustomer) {
            alert("Please select a customer for account credit.");
            return;
        }
        if (selectedCustomer.creditLimit && (selectedCustomer.balance + finalTotal > selectedCustomer.creditLimit)) {
             if (!confirm(`Credit Limit Exceeded!\n\nLimit: ₹${selectedCustomer.creditLimit}\nCurrent Balance: ₹${selectedCustomer.balance}\nNew Balance would be: ₹${selectedCustomer.balance + finalTotal}\n\nDo you want to proceed anyway?`)) {
                 return;
             }
        }
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
      status: status,
      queueName: queueName || undefined
    };
    processTransaction(transaction);
    setLastTransaction(transaction);
    
    // UI Cleanup
    setShowCheckoutModal(false);
    setCheckoutStep('method');
    setShowCartMobile(false);
    setDisabledChargeIds(new Set());
    setCustomCharges([]);
    setQueueName('');
    
    // Note: cart and customer state are cleared in processTransaction via ShopContext
    
    if (status === 'completed') {
        const autoShow = user?.preferences?.autoShowReceipt ?? true;
        if (autoShow) {
            setShowReceipt(true);
        }
    }
  };

  const handlePrint = () => {
      window.print();
  };

  // Helper styles for camera size
  const camSizeClass = {
      small: 'w-24 h-24',
      medium: 'w-48 h-36',
      large: 'w-full aspect-video'
  }[camSize];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen flex-col md:flex-row overflow-hidden relative">
      
      {/* Left: Products Grid */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full bg-slate-50 dark:bg-slate-900">
        {/* Header Filters */}
        <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-10">
            <div className="flex space-x-2 mb-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-slate-400"><Icons.Sparkles /></span>
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="Search or Scan (Enter to add)..." 
                        className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        autoFocus
                    />
                </div>
            </div>
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                <button 
                    onClick={() => setSelectedCategory('All')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${selectedCategory === 'All' ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
                >
                    All Items
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shadow-sm border ${selectedCategory === cat ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-20 md:pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Object.keys(groupedProducts).map(productName => {
                    const group = groupedProducts[productName];
                    const firstItem = group[0];
                    const hasMultipleVariants = group.length > 1;
                    const isOutOfStock = !hasMultipleVariants && firstItem.stock <= 0;

                    return (
                        <div 
                            key={productName} 
                            onClick={() => !hasMultipleVariants && !isOutOfStock ? addToCart(firstItem) : null}
                            className={`
                                bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 
                                transition-all flex flex-col overflow-hidden relative group 
                                ${!hasMultipleVariants 
                                    ? isOutOfStock 
                                        ? 'opacity-60 grayscale cursor-not-allowed'
                                        : 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-blue-400 dark:hover:border-blue-500 active:scale-[0.98]' 
                                    : 'cursor-default'
                                }
                            `}
                        >
                            <div className={`p-3 flex flex-col items-center justify-center flex-1 min-h-[110px] relative ${!hasMultipleVariants ? 'pointer-events-none' : ''}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md mb-2 ${!hasMultipleVariants ? 'group-hover:scale-110' : ''} transition-transform duration-300`}>
                                    <div className="scale-90">{getCategoryIcon(firstItem.category)}</div>
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-center leading-tight line-clamp-2 px-1 text-xs md:text-sm">
                                    {productName}
                                </h4>
                                {!hasMultipleVariants && firstItem.variant && (
                                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md">
                                        {firstItem.variant}
                                    </p>
                                )}
                                <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-wide">{firstItem.seller}</p>
                                
                                <div className="absolute top-2 right-2">
                                     {!hasMultipleVariants && (
                                         <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm ${firstItem.stock > 5 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                             {firstItem.stock}
                                         </span>
                                     )}
                                     {hasMultipleVariants && (
                                         <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                             {group.length} Vars
                                         </span>
                                     )}
                                </div>
                            </div>

                            <div className={`border-t border-slate-100 dark:border-slate-700 ${!hasMultipleVariants ? 'bg-slate-50 dark:bg-slate-900/50' : 'bg-white dark:bg-slate-800'}`}>
                                {hasMultipleVariants ? (
                                    <div className="p-1.5 grid grid-cols-2 gap-1.5 bg-slate-50 dark:bg-slate-900/30">
                                        {group.sort((a,b) => a.price - b.price).map(variant => (
                                            <button
                                                key={variant.id}
                                                onClick={(e) => { e.stopPropagation(); addToCart(variant); }}
                                                disabled={variant.stock <= 0}
                                                className={`py-1.5 px-1 flex flex-col items-center justify-center rounded-lg border transition-all text-center relative overflow-hidden active:scale-95 ${
                                                    variant.stock <= 0 
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed' 
                                                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-600 hover:shadow-sm'
                                                }`}
                                            >
                                                <div className="text-[10px] font-bold truncate max-w-full leading-none mb-0.5">{variant.variant || 'Std'}</div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">₹{variant.price}</div>
                                                {variant.stock <= 5 && variant.stock > 0 && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={`p-2 flex justify-center items-center h-10 ${isOutOfStock ? 'bg-slate-100 dark:bg-slate-800' : 'group-hover:bg-blue-500 dark:group-hover:bg-blue-600 transition-colors duration-300'}`}>
                                        {isOutOfStock ? (
                                            <span className="text-xs font-bold text-slate-400">Sold Out</span>
                                        ) : (
                                            <div className="flex items-center gap-1 group-hover:text-white transition-colors">
                                                <span className="text-xs font-medium text-slate-400 group-hover:text-blue-100 dark:text-slate-500">Add</span>
                                                <span className="text-sm font-black text-slate-800 dark:text-white group-hover:text-white">
                                                    ₹{firstItem.price}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {cart.length > 0 && (
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40">
            <button 
            onClick={() => setShowCartMobile(true)}
            className="w-full bg-slate-900 text-white p-3 rounded-xl shadow-2xl flex justify-between items-center active:scale-95 transition-transform"
            >
            <div className="flex items-center space-x-3">
                <div className="bg-blue-600 px-2 py-1 rounded text-xs font-bold">{totalItems}</div>
                <span className="font-semibold text-sm">View Cart</span>
            </div>
            <span className="font-bold text-base">₹{finalTotal.toFixed(2)}</span>
            </button>
        </div>
      )}

      {/* Right: Cart (Responsive Drawer on Mobile) */}
      <div 
        className={`
         fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 md:static md:w-96 md:border-l md:border-slate-200 dark:md:border-slate-800 flex flex-col md:h-full shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] md:shadow-none transition-transform duration-300 ease-out rounded-t-3xl md:rounded-none
         ${showCartMobile ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}
         h-[80vh] md:h-auto
      `}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1" onClick={() => setShowCartMobile(false)}>
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 md:bg-slate-50/50 dark:md:bg-slate-800/50 backdrop-blur-sm z-10 rounded-t-3xl md:rounded-none">
             <div className="flex justify-between items-center mb-3">
                 <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                     <Icons.Cart /> Current Order
                 </h2>
                 {cart.length > 0 && (
                     <button onClick={() => setCart([])} className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 px-2 py-1 rounded-md">
                         Clear
                     </button>
                 )}
             </div>

             {/* Face Rec Widget inside Sidebar */}
             {user?.preferences?.enableFaceRecognition && (
                 <div className={`flex ${camSize === 'large' ? 'flex-col' : 'flex-row'} gap-3 mb-4 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition-all`}>
                     {showCam ? (
                        <div className={`${camSizeClass} bg-black rounded-lg overflow-hidden relative shrink-0 transition-all duration-300`}>
                            <video ref={sentryVideoRef} className="w-full h-full object-cover" muted playsInline />
                        </div>
                     ) : (
                         /* Hidden Video for processing but invisible to user */
                         <div className="absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden">
                             <video ref={sentryVideoRef} muted playsInline />
                         </div>
                     )}
                     
                     <div className={`flex-1 flex flex-col justify-start gap-1 overflow-y-auto pr-1 scrollbar-thin ${camSize === 'large' ? 'max-h-32' : 'max-h-24'}`}>
                        <div className="flex justify-between items-center sticky top-0 bg-slate-100 dark:bg-slate-800 pb-1">
                             <p className="text-[10px] uppercase font-bold text-slate-400">Detected Faces</p>
                             {!showCam && <span className="text-[9px] font-bold text-green-500 animate-pulse">● Active</span>}
                        </div>
                        {detectedCustomers.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center min-h-[50px]">
                                <p className="text-[10px] text-slate-400 italic">Scanning...</p>
                            </div>
                        ) : (
                            detectedCustomers.map(u => (
                                <button 
                                  key={u.id}
                                  onClick={() => setSelectedCustomer(u)}
                                  className={`text-left text-xs font-bold p-1.5 rounded-md transition-all border flex justify-between items-center ${selectedCustomer?.id === u.id ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-blue-400'}`}
                                >
                                   <span>{u.name}</span>
                                   {selectedCustomer?.id === u.id && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                                </button>
                            ))
                        )}
                     </div>
                 </div>
             )}

             <select 
                className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white font-medium appearance-none cursor-pointer"
                value={selectedCustomer?.id || ''}
                onChange={(e) => setSelectedCustomer(customers.find(c => c.id === e.target.value) || null)}
            >
                <option value="">Guest Customer</option>
                {customers.map(c => (
                    <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''} {c.balance > 0 ? `[Due ₹${c.balance}]` : ''}
                    </option>
                ))}
            </select>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-slate-900">
            {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 space-y-2">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full">
                        <Icons.Cart />
                    </div>
                    <p className="font-medium text-sm">Start adding products</p>
                    <p className="text-xs">Type in search or scan barcode</p>
                </div>
            ) : (
                cart.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        <div className="flex-1 min-w-0 pr-3">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {item.name} 
                            </p>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                {item.variant && <span className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{item.variant}</span>}
                                <span>₹{item.price.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="flex items-center bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 h-7">
                                <button onClick={() => updateQuantity(index, -1)} className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-blue-600 active:bg-slate-100 rounded-l-lg">-</button>
                                <span className="text-xs font-bold w-10 text-center text-slate-800 dark:text-white truncate px-1">{item.quantity}</span>
                                <button onClick={() => updateQuantity(index, 1)} className="w-7 h-full flex items-center justify-center text-slate-500 hover:text-blue-600 active:bg-slate-100 rounded-r-lg">+</button>
                             </div>
                             <div className="text-right w-14 relative group">
                                <div className="font-bold text-slate-800 dark:text-white text-sm">₹{(item.price * item.quantity).toFixed(0)}</div>
                                <button 
                                    onClick={() => removeItem(index)}
                                    className="absolute -right-2 -top-3 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white dark:bg-slate-800 rounded-full shadow-sm"
                                >
                                    <Icons.X />
                                </button>
                             </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Cart Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 pb-6 md:pb-4 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-10">
            {cart.length > 0 && (
                <div className="mb-3 space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Subtotal</span>
                        <span>₹{cartSubtotal.toFixed(2)}</span>
                    </div>
                    {chargeRules.filter(r => r.enabled).map(rule => {
                        const isApplies = (rule.trigger === 'always') ||
                                          (rule.trigger === 'amount_threshold' && cartSubtotal > (rule.threshold || 0)) ||
                                          (rule.trigger === 'customer_assigned' && !!selectedCustomer);
                        if (!isApplies) return null;

                        const isDisabled = disabledChargeIds.has(rule.id);
                        let amount = rule.type === 'fixed' ? rule.value : (cartSubtotal * rule.value) / 100;
                        const displayAmount = isDisabled ? 0 : amount;

                        return (
                             <div key={rule.id} className="flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 p-0.5 rounded" onClick={() => toggleCharge(rule.id)}>
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${isDisabled ? 'border-slate-300' : 'bg-blue-600 border-blue-600'}`}>
                                        {!isDisabled && <span className="text-white text-[8px]">✓</span>}
                                    </div>
                                    <span className={`${isDisabled ? 'text-slate-400 line-through' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {rule.name}
                                    </span>
                                </div>
                                <span className={`${isDisabled ? 'text-slate-400 line-through' : rule.isDiscount ? 'text-green-600' : 'text-slate-600'}`}>
                                    {rule.isDiscount ? '-' : ''}₹{displayAmount.toFixed(2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex justify-between items-center mb-3 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700">
                <span className="text-slate-500 font-bold text-sm">Total</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{finalTotal.toFixed(2)}</span>
            </div>
            <button 
                onClick={() => setShowCheckoutModal(true)}
                disabled={cart.length === 0}
                className="w-full py-3 bg-slate-900 text-white dark:bg-blue-600 rounded-xl font-bold text-base shadow-lg shadow-slate-900/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
            >
                Checkout
            </button>
        </div>
      </div>

      {/* Mobile Cart Overlay */}
      {showCartMobile && (
        <div 
            className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm" 
            onClick={() => setShowCartMobile(false)}
        />
      )}

      {/* Variable Price Modal */}
      {variableProduct && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">{variableProduct.name}</h3>
                  <p className="text-sm text-slate-500 mb-4">Variable Price Item • Base: ₹{variableProduct.price}</p>
                  
                  <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-4">
                      <button 
                         onClick={() => setVariableInputType('price')}
                         className={`flex-1 py-2 text-sm font-bold rounded-md ${variableInputType === 'price' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                      >
                          Enter Total Price
                      </button>
                      <button 
                         onClick={() => setVariableInputType('quantity')}
                         className={`flex-1 py-2 text-sm font-bold rounded-md ${variableInputType === 'quantity' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600' : 'text-slate-500'}`}
                      >
                          Enter Quantity
                      </button>
                  </div>

                  <div className="relative mb-6">
                      <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-lg">
                          {variableInputType === 'price' ? '₹' : 'x'}
                      </span>
                      <input 
                          type="number" autoFocus
                          className="w-full pl-10 pr-4 py-3 border-2 border-blue-500 rounded-xl text-2xl font-bold outline-none bg-transparent text-slate-900 dark:text-white"
                          value={variableInputValue}
                          onChange={e => setVariableInputValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleVariableSubmit()}
                          placeholder="0"
                      />
                  </div>

                  <div className="flex gap-3">
                      <button onClick={() => setVariableProduct(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancel</button>
                      <button onClick={handleVariableSubmit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Add to Cart</button>
                  </div>
              </div>
          </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
            <div className="bg-white dark:bg-slate-800 rounded-t-3xl md:rounded-3xl shadow-2xl p-5 w-full max-w-sm animate-fade-in max-h-[90vh] overflow-y-auto">
                
                {checkoutStep === 'method' && (
                  <>
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Payment Method</h3>
                        <button onClick={() => setShowCheckoutModal(false)} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500"><Icons.X /></button>
                    </div>
                    
                    <div className="space-y-2.5">
                        <button 
                            onClick={() => handleCompleteTransaction('cash', 'completed')} 
                            className="w-full p-3.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-green-50 hover:border-green-200 dark:hover:border-green-900 rounded-xl flex items-center transition-all group active:scale-[0.98]"
                        >
                            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold mr-3 text-lg">₹</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 dark:text-white text-base">Cash</p>
                                <p className="text-[10px] text-slate-500">Instant payment</p>
                            </div>
                        </button>

                        <button 
                            onClick={() => handleCompleteTransaction('account', 'completed')} 
                            disabled={!selectedCustomer}
                            className="w-full p-3.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-purple-50 hover:border-purple-200 rounded-xl flex items-center transition-all group active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold mr-3 text-lg">A</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 dark:text-white text-base">Store Credit</p>
                                <p className="text-xs text-slate-500">{selectedCustomer ? `Tab: ${selectedCustomer.name}` : 'Select customer first'}</p>
                            </div>
                        </button>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800/50 rounded-xl overflow-hidden">
                            <button 
                                onClick={() => handleCompleteTransaction('pending', 'queued')} 
                                className="w-full p-3.5 flex items-center transition-all group active:scale-[0.98]"
                            >
                                <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center font-bold mr-3 text-lg">
                                    <Icons.Orders />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-slate-900 dark:text-white text-base">Hold / Queue Order</p>
                                    <p className="text-[10px] text-slate-500">Save order for later</p>
                                </div>
                            </button>
                            <div className="px-3.5 pb-3.5 pt-0">
                                <input 
                                    type="text" 
                                    placeholder="Queue Name (e.g. Table 5)" 
                                    className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-yellow-500 text-slate-800 dark:text-slate-200 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-700"
                                    value={queueName}
                                    onChange={(e) => setQueueName(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={!!selectedCustomer}
                                />
                            </div>
                        </div>

                        <div className="relative py-1.5">
                             <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                             <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-800 px-2 text-[10px] text-slate-400 uppercase font-bold">Or</span></div>
                        </div>

                        <button 
                            onClick={generateUpiQr}
                            className="w-full p-3.5 bg-slate-900 dark:bg-slate-950 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98] text-sm"
                        >
                            <Icons.QRCode /> Pay via UPI
                        </button>
                    </div>
                  </>
                )}

                {checkoutStep === 'upi_scan' && (
                    <div className="text-center">
                        <div className="flex justify-between items-center mb-3">
                             <button onClick={() => setCheckoutStep('method')} className="text-xs font-bold text-slate-500">Back</button>
                             <h3 className="text-lg font-bold text-slate-800 dark:text-white">Scan QR</h3>
                             <div className="w-8"></div>
                        </div>
                        
                        <div className="bg-white p-3 rounded-xl shadow-inner inline-block mb-3 border border-slate-200">
                            {upiQrCode && <img src={upiQrCode} alt="UPI QR Code" className="w-48 h-48" />}
                        </div>
                        
                        <p className="text-2xl font-black text-slate-800 dark:text-white mb-4">₹{finalTotal.toFixed(2)}</p>

                        <div className="grid grid-cols-2 gap-2.5">
                             <button 
                                onClick={() => handleCompleteTransaction('upi', 'completed')}
                                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-bold shadow-lg shadow-green-200 dark:shadow-none text-sm"
                             >
                                Received
                             </button>
                             <button 
                                onClick={() => handleCompleteTransaction('upi', 'queued')}
                                className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-white rounded-lg font-bold text-sm"
                             >
                                Pay Later
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-green-500"></div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3 shadow-sm no-print">
                      <Icons.Sparkles /> 
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-0.5 no-print">Success!</h3>
                  <p className="text-slate-500 text-xs mb-5 no-print">Order #{lastTransaction.id.slice(0, 8)}</p>

                  <div className="w-full bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl mb-5 border border-slate-100 dark:border-slate-700/50 dashed-border">
                      <div className="flex justify-between text-xs mb-2 text-slate-500">
                          <span>Subtotal</span>
                          <span>₹{lastTransaction.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 dark:border-slate-700 my-2"></div>
                      <div className="flex justify-between text-lg font-black text-slate-800 dark:text-white">
                          <span>Total</span>
                          <span>₹{lastTransaction.total.toFixed(2)}</span>
                      </div>
                  </div>

                  <div className="flex gap-2 w-full no-print">
                    <button 
                        onClick={handlePrint}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                    >
                        Print Receipt
                    </button>
                    <button 
                        onClick={() => setShowReceipt(false)}
                        className="flex-1 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-95 text-sm"
                    >
                        New Sale
                    </button>
                  </div>
              </div>
          </div>
      )}

      {/* HIDDEN PRINT RECEIPT */}
      {lastTransaction && (
        <div id="printable-receipt" className="hidden">
            <div style={{ padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>{user?.name || 'Nexus Shop'}</h1>
                <p style={{ margin: '0' }}>Order #{lastTransaction.id.slice(0, 8)}</p>
                <p style={{ margin: '0 0 20px 0' }}>{new Date(lastTransaction.date).toLocaleString()}</p>
                
                <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '10px 0', marginBottom: '20px' }}>
                    {lastTransaction.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ textAlign: 'left' }}>{item.quantity}x {item.name}</span>
                            <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Subtotal</span>
                    <span>₹{lastTransaction.subtotal.toFixed(2)}</span>
                </div>
                {lastTransaction.charges.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{c.name}</span>
                        <span>{c.isDiscount ? '-' : ''}₹{c.amount.toFixed(2)}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', marginTop: '10px' }}>
                    <span>Total</span>
                    <span>₹{lastTransaction.total.toFixed(2)}</span>
                </div>
                
                <p style={{ marginTop: '20px', fontSize: '12px' }}>Thank you for your business!</p>
            </div>
        </div>
      )}
    </div>
  );
};