import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShop } from '../contexts/ShopContext';
import { Product } from '../types';
import { Icons, getCategoryIcon } from '../constants';
import { suggestRestock, parseInvoiceImage } from '../services/geminiService';

export const Inventory: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, 
    categories, addCategory, deleteCategory,
    sellers, addSeller, deleteSeller
  } = useShop();
  
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Master Data Manager State
  const [showMasterManager, setShowMasterManager] = useState(false);
  const [activeManagerTab, setActiveManagerTab] = useState<'categories' | 'sellers'>('categories');
  const [newMasterItem, setNewMasterItem] = useState('');

  // Expanded State for Product Families (by Name)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Scan Invoice State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannedItems, setScannedItems] = useState<Partial<Product>[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Form State
  const initialForm = { name: '', variant: '', seller: '', category: '', price: 0, cost: 0, stock: 0, minStockLevel: 5, isVariablePrice: false };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
      if (location.state && location.state.filter === 'low-stock') {
          setFilterLowStock(true);
      }
  }, [location]);

  // Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            p.name.toLowerCase().includes(term) ||
            p.seller.toLowerCase().includes(term) ||
            (p.variant && p.variant.toLowerCase().includes(term)) ||
            p.category.toLowerCase().includes(term)
        );
        const matchesLowStock = filterLowStock ? p.stock < p.minStockLevel : true;
        return matchesSearch && matchesLowStock;
    });
  }, [products, searchTerm, filterLowStock]);

  // Group items
  const groupedInventory = useMemo(() => {
      const groups: Record<string, Record<string, Record<string, Product[]>>> = {};

      filteredProducts.forEach(product => {
          const seller = product.seller || 'Unassigned';
          if (!groups[seller]) groups[seller] = {};
          
          const cat = product.category || 'Other';
          if (!groups[seller][cat]) groups[seller][cat] = {};

          const name = product.name;
          if (!groups[seller][cat][name]) groups[seller][cat][name] = [];
          
          groups[seller][cat][name].push(product);
      });

      const sortedSellers = Object.keys(groups).sort();
      return sortedSellers.map(seller => ({
          name: seller,
          categories: Object.keys(groups[seller]).sort().map(cat => ({
              name: cat,
              products: Object.keys(groups[seller][cat]).sort().map(prodName => ({
                  name: prodName,
                  variants: groups[seller][cat][prodName].sort((a,b) => (a.price - b.price))
              }))
          }))
      }));
  }, [filteredProducts]);

  const toggleFamily = (familyId: string) => {
      setExpandedFamilies(prev => {
          const next = new Set(prev);
          if (next.has(familyId)) next.delete(familyId);
          else next.add(familyId);
          return next;
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const product: Product = {
      id: editingProduct ? editingProduct.id : crypto.randomUUID(),
      ...formData,
      category: formData.category || categories[0] || 'General',
      seller: formData.seller || sellers[0] || 'General',
      price: Number(formData.price),
      cost: Number(formData.cost),
      stock: Number(formData.stock),
      minStockLevel: Number(formData.minStockLevel),
      isVariablePrice: formData.isVariablePrice
    };

    if (editingProduct) {
      updateProduct(product);
    } else {
      addProduct(product);
    }
    closeModal();
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        variant: product.variant || '',
        seller: product.seller,
        category: product.category,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        minStockLevel: product.minStockLevel,
        isVariablePrice: product.isVariablePrice || false
      });
    } else {
      setEditingProduct(null);
      setFormData({
          ...initialForm,
          category: categories[0] || 'General',
          seller: sellers[0] || 'General'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleGetAdvice = async () => {
    setLoadingAi(true);
    const result = await suggestRestock(products);
    setAdvice(result);
    setLoadingAi(false);
  }

  // Master Manager Logic
  const handleAddMasterItem = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMasterItem.trim()) return;
      
      const item = newMasterItem.trim();
      if (activeManagerTab === 'categories') {
          addCategory(item);
      } else {
          addSeller(item);
      }
      setNewMasterItem('');
  };

  const handleDeleteMasterItem = (item: string) => {
      if(confirm(`Delete "${item}" from list?`)) {
          if (activeManagerTab === 'categories') deleteCategory(item);
          else deleteSeller(item);
      }
  };

  // Handle Invoice Scanning
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanning(true);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64String = reader.result?.toString().split(',')[1];
          if (base64String) {
              const items = await parseInvoiceImage(base64String);
              setScannedItems(items);
              setShowScanModal(true);
          }
          setScanning(false);
          // Reset file input
          if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
  };

  const confirmScannedItems = () => {
      scannedItems.forEach(item => {
          if (item.name && item.stock !== undefined && item.cost !== undefined) {
               // Auto-add new categories/sellers found in scan to prevent data loss, 
               // even though manual entry is restricted.
               const safeCategory = item.category || 'General';
               const safeSeller = item.seller || 'General';
               
               if (!categories.includes(safeCategory)) addCategory(safeCategory);
               if (!sellers.includes(safeSeller)) addSeller(safeSeller);

               addProduct({
                   id: crypto.randomUUID(),
                   name: item.name,
                   variant: item.variant || '',
                   seller: safeSeller,
                   category: safeCategory,
                   price: item.price || 0,
                   cost: item.cost,
                   stock: item.stock,
                   minStockLevel: 5
               });
          }
      });
      setShowScanModal(false);
      setScannedItems([]);
  };

  const removeScannedItem = (index: number) => {
      setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Inventory</h2>
           <p className="text-sm text-slate-500 dark:text-slate-400">Manage stock and product catalog.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto text-sm">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
            />
            <button 
                onClick={() => setShowMasterManager(true)}
                className="flex-1 md:flex-none px-3 py-2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg hover:bg-slate-200 font-medium flex items-center justify-center space-x-2 transition-colors border border-slate-200 dark:border-slate-700"
            >
                <Icons.List /> <span>Manage Lists</span>
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="flex-1 md:flex-none px-3 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg hover:bg-purple-200 font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
                {scanning ? <span className="animate-pulse">Scanning...</span> : <><Icons.Sparkles /> <span>Scan Invoice</span></>}
            </button>
            <button 
                onClick={handleGetAdvice}
                className="flex-1 md:flex-none px-3 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 font-medium flex items-center justify-center space-x-2 transition-colors"
            >
                {loadingAi ? 'Thinking...' : <><Icons.Sparkles /> <span>AI Restock</span></>}
            </button>
            <button 
                onClick={() => openModal()}
                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/20"
            >
                <Icons.Plus />
                <span>Add Item</span>
            </button>
        </div>
      </header>

      {advice && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-3 rounded-lg text-indigo-800 dark:text-indigo-200 text-xs whitespace-pre-line relative">
            <button onClick={() => setAdvice(null)} className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-600">✕</button>
            <strong className="block mb-1 font-bold">AI Recommendation:</strong>
            {advice}
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex flex-col md:flex-row gap-2">
        <input 
            type="text" 
            placeholder="Search by product, company, or category..." 
            className="flex-1 bg-transparent border-none px-3 py-1.5 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />
        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors border ${filterLowStock ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300' : 'bg-slate-50 border-transparent text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
            <input 
                type="checkbox" 
                checked={filterLowStock} 
                onChange={e => setFilterLowStock(e.target.checked)} 
                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4" 
            />
            <span className="text-xs font-bold">Low Stock Only</span>
        </label>
      </div>

      <div className="space-y-4">
        {groupedInventory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Icons.Inventory />
                <p className="mt-2 font-medium text-sm">No items found.</p>
            </div>
        ) : (
            groupedInventory.map(group => (
                <div key={group.name} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Seller Header */}
                    <div className="bg-slate-50 dark:bg-slate-900/80 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-base text-slate-800 dark:text-white flex items-center">
                            <span className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-6 h-6 rounded-md flex items-center justify-center text-[10px] mr-2 shadow-sm">
                                {group.name.charAt(0).toUpperCase()}
                            </span>
                            {group.name}
                        </h3>
                        <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                            {group.categories.reduce((acc, cat) => acc + cat.products.reduce((pAcc, p) => pAcc + p.variants.length, 0), 0)} Items
                        </span>
                    </div>

                    <div className="p-0">
                        {group.categories.map(category => (
                            <div key={category.name} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                {/* Category Label */}
                                <div className="px-4 py-1.5 bg-slate-50/50 dark:bg-slate-800/30 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {category.name}
                                </div>
                                
                                {category.products.map(productFamily => {
                                    const familyId = `${group.name}-${category.name}-${productFamily.name}`;
                                    const isExpanded = expandedFamilies.has(familyId);
                                    const totalStock = productFamily.variants.reduce((acc, v) => acc + v.stock, 0);
                                    const minPrice = Math.min(...productFamily.variants.map(v => v.price));
                                    const maxPrice = Math.max(...productFamily.variants.map(v => v.price));
                                    
                                    return (
                                        <div key={familyId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            {/* Header Row */}
                                            <div 
                                                onClick={() => toggleFamily(familyId)}
                                                className="flex flex-col md:flex-row md:items-center p-3 md:px-4 cursor-pointer gap-2 md:gap-4"
                                            >
                                                {/* Product Info */}
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className="text-blue-500 dark:text-blue-400 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-md scale-90">
                                                        {getCategoryIcon(category.name)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm">{productFamily.name}</h4>
                                                        <p className="text-[10px] text-slate-500">{productFamily.variants.length} Variants</p>
                                                    </div>
                                                </div>

                                                {/* Stats */}
                                                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-1 md:mt-0">
                                                    <div className="text-right">
                                                        <span className="block text-[10px] text-slate-400 uppercase font-bold md:hidden">Price</span>
                                                        <span className="font-medium text-slate-800 dark:text-white text-sm">
                                                            {minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`}
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totalStock === 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                            {totalStock} Stock
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-400 transition-transform duration-200 transform" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                                        <Icons.ChevronDown />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Content */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 md:px-4 md:pb-4 space-y-2 animate-fade-in">
                                                    {productFamily.variants.map(variant => (
                                                        <div key={variant.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex flex-wrap items-center gap-3 shadow-sm">
                                                            <div className="flex-1 min-w-[120px]">
                                                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200 block">
                                                                    {variant.variant || 'Standard'}
                                                                    {variant.isVariablePrice && <span className="ml-2 text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">Variable Price</span>}
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-4 text-xs">
                                                                <div>
                                                                    <span className="text-[9px] text-slate-400 block uppercase">Cost</span>
                                                                    <span className="text-slate-500">₹{variant.cost}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[9px] text-slate-400 block uppercase">Sell</span>
                                                                    <span className="font-bold text-slate-800 dark:text-white">₹{variant.price}</span>
                                                                </div>
                                                                <div>
                                                                     <span className="text-[9px] text-slate-400 block uppercase">Stock</span>
                                                                     <span className={`${variant.stock <= variant.minStockLevel ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{variant.stock}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 ml-auto">
                                                                <button onClick={() => openModal(variant)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold">Edit</button>
                                                                <button onClick={() => deleteProduct(variant.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[10px]">
                                                                    <Icons.Trash />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => {
                                                            setEditingProduct(null);
                                                            setFormData({ ...initialForm, name: productFamily.name, seller: group.name, category: category.name });
                                                            setShowModal(true);
                                                        }}
                                                        className="w-full py-1.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
                                                    >
                                                        + Add Variant to {productFamily.name}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Master Data Manager Modal */}
      {showMasterManager && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">Manage Lists</h3>
                      <button onClick={() => setShowMasterManager(false)} className="text-slate-400 hover:text-slate-600"><Icons.X /></button>
                  </div>

                  <div className="flex mb-4 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                      <button 
                        onClick={() => setActiveManagerTab('categories')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeManagerTab === 'categories' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                          Categories
                      </button>
                      <button 
                        onClick={() => setActiveManagerTab('sellers')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${activeManagerTab === 'sellers' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                          Brands / Sellers
                      </button>
                  </div>

                  <form onSubmit={handleAddMasterItem} className="flex gap-2 mb-4">
                      <input 
                        type="text" 
                        placeholder={`New ${activeManagerTab === 'categories' ? 'Category' : 'Seller'} Name...`}
                        className="flex-1 border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        value={newMasterItem}
                        onChange={e => setNewMasterItem(e.target.value)}
                      />
                      <button type="submit" className="px-4 bg-blue-600 text-white rounded-lg font-bold">Add</button>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                      {(activeManagerTab === 'categories' ? categories : sellers).map(item => (
                          <div key={item} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item}</span>
                              <button onClick={() => handleDeleteMasterItem(item)} className="text-slate-400 hover:text-red-500">
                                  <Icons.Trash />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Product Name</label>
                        <input 
                            type="text" required 
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Brand / Seller</label>
                        <select 
                            required
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.seller} onChange={e => setFormData({...formData, seller: e.target.value})}
                        >
                            {sellers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
                         <select 
                            required
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30">
                        <label className="block text-[10px] font-bold text-blue-800 dark:text-blue-300 mb-1 uppercase">Variant</label>
                        <input 
                            type="text" placeholder="e.g. 500ml"
                            className="w-full border border-blue-200 dark:border-blue-800/50 rounded-lg p-2 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})}
                        />
                    </div>

                     <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Min Stock</label>
                        <input 
                            type="number" required
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Current Stock</label>
                        <input 
                            type="number" required
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Cost Price</label>
                        <input 
                            type="number" required step="0.01"
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Selling Price (Base)</label>
                        <input 
                            type="number" required step="0.01"
                            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="flex items-center gap-2 p-3 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <input 
                                type="checkbox"
                                checked={formData.isVariablePrice}
                                onChange={e => setFormData({...formData, isVariablePrice: e.target.checked})}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <div>
                                <span className="block text-sm font-bold text-slate-700 dark:text-slate-200">Variable Price / Quantity</span>
                                <span className="block text-xs text-slate-500">Enable if you sell loose items by weight or custom price (e.g. Vegetables).</span>
                            </div>
                        </label>
                    </div>

                    <div className="col-span-2 flex gap-3 mt-4">
                        <button type="button" onClick={closeModal} className="flex-1 py-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors text-sm">Cancel</button>
                        <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 text-sm">Save Product</button>
                    </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
};