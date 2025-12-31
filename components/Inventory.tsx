import React, { useState, useRef, useMemo } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Product } from '../types';
import { Icons, getCategoryIcon } from '../constants';
import { suggestRestock, parseInvoiceImage } from '../services/geminiService';

export const Inventory: React.FC = () => {
  const { 
    products, addProduct, updateProduct, deleteProduct, 
    categories, addCategory, deleteCategory, 
    tags, addTag, deleteTag 
  } = useShop();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Expanded State for Product Families (by Name)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  // Scan Invoice State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannedItems, setScannedItems] = useState<Partial<Product>[]>([]);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Form State
  const initialForm = { name: '', variant: '', seller: '', category: categories[0] || 'General', tags: [] as string[], price: 0, cost: 0, stock: 0, minStockLevel: 5 };
  const [formData, setFormData] = useState(initialForm);

  // Settings State
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [settingsTab, setSettingsTab] = useState<'categories' | 'tags'>('categories');

  // Filter Logic
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
        const term = searchTerm.toLowerCase();
        return (
            p.name.toLowerCase().includes(term) ||
            p.seller.toLowerCase().includes(term) ||
            (p.variant && p.variant.toLowerCase().includes(term)) ||
            p.category.toLowerCase().includes(term) ||
            p.tags.some(t => t.toLowerCase().includes(term))
        );
    });
  }, [products, searchTerm]);

  // Group items by Seller -> Category -> Product Name (Family)
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

      // Sort keys for consistent display
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
      seller: formData.seller || 'General',
      price: Number(formData.price),
      cost: Number(formData.cost),
      stock: Number(formData.stock),
      minStockLevel: Number(formData.minStockLevel),
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
        tags: product.tags || [],
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        minStockLevel: product.minStockLevel
      });
    } else {
      setEditingProduct(null);
      setFormData({
          ...initialForm,
          category: categories[0] || 'General'
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

  const toggleTag = (tag: string) => {
    if (formData.tags.includes(tag)) {
        setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
    } else {
        setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  }

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
               addProduct({
                   id: crypto.randomUUID(),
                   name: item.name,
                   variant: item.variant || '',
                   seller: item.seller || 'General',
                   category: item.category || 'General',
                   tags: [],
                   price: item.price || 0,
                   cost: item.cost,
                   stock: item.stock,
                   minStockLevel: 5
               });
               // Add category if new
               if (item.category) addCategory(item.category);
          }
      });
      setShowScanModal(false);
      setScannedItems([]);
  };

  const removeScannedItem = (index: number) => {
      setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Inventory</h2>
           <p className="text-slate-500 dark:text-slate-400">Track stock sorted by Company/Seller.</p>
        </div>
        <div className="flex flex-wrap gap-2">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
                {scanning ? (
                    <span className="animate-pulse">Scanning...</span>
                ) : (
                    <>
                        <Icons.Sparkles /> <span>Scan Invoice</span>
                    </>
                )}
            </button>
            <button 
                onClick={handleGetAdvice}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 font-medium flex items-center space-x-2 transition-colors"
            >
                {loadingAi ? 'Thinking...' : <><Icons.Sparkles /> <span>Smart Restock</span></>}
            </button>
            <button
                onClick={() => setShowSettingsModal(true)}
                className="px-4 py-2 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium flex items-center space-x-2 transition-colors"
            >
                <Icons.Settings />
                <span>Manage</span>
            </button>
            <button 
                onClick={() => openModal()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center space-x-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
                <Icons.Plus />
                <span>Add Product</span>
            </button>
        </div>
      </header>

      {advice && (
        <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 rounded-lg text-indigo-800 dark:text-indigo-200 text-sm whitespace-pre-line">
            <div className="flex justify-between items-start">
                <span className="font-bold mb-2 block">AI Recommendation:</span>
                <button onClick={() => setAdvice(null)} className="text-indigo-400 hover:text-indigo-600">✕</button>
            </div>
            {advice}
        </div>
      )}

      {/* Main Inventory Layout */}
      <div className="space-y-6">
        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
             <input 
                type="text" 
                placeholder="Search by product, company, or category..." 
                className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {groupedInventory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
                <Icons.Inventory />
                <p className="mt-2">No items found.</p>
            </div>
        ) : (
            groupedInventory.map(group => (
                <div key={group.name} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
                    {/* Seller Header */}
                    <div className="bg-slate-100 dark:bg-slate-900/80 px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center">
                            <span className="bg-blue-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-xs mr-3">
                                {group.name.charAt(0).toUpperCase()}
                            </span>
                            {group.name}
                        </h3>
                        <span className="text-xs font-bold text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            {group.categories.reduce((acc, cat) => acc + cat.products.reduce((pAcc, p) => pAcc + p.variants.length, 0), 0)} Items
                        </span>
                    </div>

                    {/* Categories under Seller */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {group.categories.map(category => (
                            <div key={category.name} className="p-0">
                                <div className="px-6 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50">
                                    {category.name}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                        <tbody>
                                            {category.products.map(productFamily => {
                                                const familyId = `${group.name}-${category.name}-${productFamily.name}`;
                                                const isExpanded = expandedFamilies.has(familyId);
                                                const totalStock = productFamily.variants.reduce((acc, v) => acc + v.stock, 0);
                                                const minPrice = Math.min(...productFamily.variants.map(v => v.price));
                                                const maxPrice = Math.max(...productFamily.variants.map(v => v.price));
                                                const priceDisplay = minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice} - ₹${maxPrice}`;
                                                
                                                // Icon based strictly on Category
                                                const icon = getCategoryIcon(category.name);

                                                return (
                                                  <React.Fragment key={familyId}>
                                                    {/* Product Family Row */}
                                                    <tr 
                                                        onClick={() => toggleFamily(familyId)}
                                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-800/50 cursor-pointer"
                                                    >
                                                        <td className="px-6 py-3 w-1/3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-blue-500 dark:text-blue-400">
                                                                    {icon}
                                                                </div>
                                                                <div>
                                                                    <span className="font-medium text-slate-800 dark:text-white block">
                                                                        {productFamily.name}
                                                                    </span>
                                                                    <span className="text-xs text-slate-400">
                                                                        {productFamily.variants.length} Variants
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-slate-500 dark:text-slate-400 w-1/6">
                                                             {/* Empty Cost for group view */}
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-medium text-slate-800 dark:text-white w-1/6">
                                                            {priceDisplay}
                                                        </td>
                                                        <td className="px-6 py-3 text-center w-1/6">
                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${totalStock === 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                                                {totalStock} Total Stock
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-right w-1/6">
                                                            <button className="text-slate-400">
                                                                {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Variants */}
                                                    {isExpanded && productFamily.variants.map(variant => (
                                                        <tr key={variant.id} className="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/50 animate-fade-in">
                                                            <td className="px-6 py-2 pl-16 w-1/3">
                                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                                    {variant.variant || 'Standard'}
                                                                </span>
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {variant.tags && variant.tags.map(tag => (
                                                                        <span key={tag} className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 bg-white dark:bg-slate-800">{tag}</span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-2 text-right text-slate-500 dark:text-slate-400 text-sm">
                                                                <span className="text-[10px] uppercase text-slate-400 mr-1">Cost</span>
                                                                ₹{variant.cost.toFixed(2)}
                                                            </td>
                                                            <td className="px-6 py-2 text-right text-slate-800 dark:text-white text-sm font-medium">
                                                                ₹{variant.price.toFixed(2)}
                                                            </td>
                                                            <td className="px-6 py-2 text-center text-sm">
                                                                 <span className={`px-2 py-0.5 rounded text-xs ${variant.stock <= variant.minStockLevel ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                    {variant.stock} left
                                                                 </span>
                                                            </td>
                                                            <td className="px-6 py-2 text-right space-x-3">
                                                                <button onClick={() => openModal(variant)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-xs">Edit</button>
                                                                <button onClick={() => deleteProduct(variant.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-400 text-xs">
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                  </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">{editingProduct ? 'Edit Product Variant' : 'New Product'}</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Product Name (Group)</label>
                        <input 
                            type="text" required 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="e.g. Fresh Milk"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Products with the same name will be grouped together.</p>
                    </div>
                    
                    {/* New Seller Field */}
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Company / Seller</label>
                        <input 
                            type="text" required placeholder="e.g. Samsung, Nestle"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.seller} onChange={e => setFormData({...formData, seller: e.target.value})}
                        />
                    </div>

                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Category</label>
                        <select 
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                        <label className="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">Variant / Size</label>
                        <input 
                            type="text" placeholder="e.g. 500ml, 1kg, XL"
                            className="w-full border border-blue-200 dark:border-blue-700 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.variant} onChange={e => setFormData({...formData, variant: e.target.value})}
                        />
                    </div>

                     <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Min Stock Alert</label>
                        <input 
                            type="number" required min="0"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Current Stock</label>
                        <input 
                            type="number" required min="0"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Cost Price</label>
                        <input 
                            type="number" required min="0" step="0.01"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.cost} onChange={e => setFormData({...formData, cost: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Selling Price</label>
                        <input 
                            type="number" required min="0" step="0.01"
                            className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                        />
                    </div>

                    <div className="col-span-2">
                         <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Tags</label>
                         <div className="flex flex-wrap gap-2 p-3 border border-slate-100 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900">
                             {tags.length === 0 && <span className="text-xs text-slate-400">No tags created yet. Use "Manage" to add tags.</span>}
                             {tags.map(tag => (
                                 <button
                                    type="button"
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${formData.tags.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}
                                 >
                                     {tag}
                                 </button>
                             ))}
                         </div>
                    </div>

                    <div className="col-span-2 flex space-x-2 pt-4">
                        <button type="button" onClick={closeModal} className="flex-1 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Save Variant</button>
                    </div>
                </form>
             </div>
        </div>
      )}

      {/* Scanned Items Review Modal */}
      {showScanModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Review Scanned Items</h3>
                    <button onClick={() => setShowScanModal(false)} className="text-slate-400 hover:text-red-500"><Icons.X /></button>
                </div>
                
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    AI found {scannedItems.length} items. Please review and edit before adding to inventory.
                </p>

                <div className="space-y-3 mb-6">
                    {scannedItems.length === 0 ? (
                         <div className="text-center py-8 text-slate-400">No items found in image.</div>
                    ) : (
                        scannedItems.map((item, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <div className="flex-1 space-y-2">
                                    <input 
                                        type="text" placeholder="Name" className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white outline-none"
                                        value={item.name} 
                                        onChange={e => {
                                            const updated = [...scannedItems];
                                            updated[idx] = { ...item, name: e.target.value };
                                            setScannedItems(updated);
                                        }}
                                    />
                                    <div className="flex gap-2">
                                         <input 
                                            type="text" placeholder="Variant" className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white outline-none"
                                            value={item.variant}
                                            onChange={e => {
                                                const updated = [...scannedItems];
                                                updated[idx] = { ...item, variant: e.target.value };
                                                setScannedItems(updated);
                                            }}
                                        />
                                        <input 
                                            type="text" placeholder="Category" className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white outline-none"
                                            value={item.category}
                                            onChange={e => {
                                                const updated = [...scannedItems];
                                                updated[idx] = { ...item, category: e.target.value };
                                                setScannedItems(updated);
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 items-start">
                                    <input 
                                        type="number" placeholder="Qty" className="w-16 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white outline-none"
                                        value={item.stock}
                                        onChange={e => {
                                            const updated = [...scannedItems];
                                            updated[idx] = { ...item, stock: Number(e.target.value) };
                                            setScannedItems(updated);
                                        }}
                                    />
                                    <input 
                                        type="number" placeholder="Cost" className="w-20 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm dark:text-white outline-none"
                                        value={item.cost}
                                        onChange={e => {
                                            const updated = [...scannedItems];
                                            updated[idx] = { ...item, cost: Number(e.target.value) };
                                            setScannedItems(updated);
                                        }}
                                    />
                                </div>
                                <button onClick={() => removeScannedItem(idx)} className="text-red-400 hover:text-red-600 pt-1">
                                    <Icons.Trash />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowScanModal(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">Cancel</button>
                    <button onClick={confirmScannedItems} className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition-colors">
                        Confirm & Add {scannedItems.length} Items
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* Settings Modal (Categories & Tags) */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button 
                        className={`flex-1 py-4 text-sm font-bold ${settingsTab === 'categories' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        onClick={() => setSettingsTab('categories')}
                    >
                        Categories
                    </button>
                    <button 
                        className={`flex-1 py-4 text-sm font-bold ${settingsTab === 'tags' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        onClick={() => setSettingsTab('tags')}
                    >
                        Product Tags
                    </button>
                </div>

                <div className="p-6 max-h-96 overflow-y-auto">
                    {settingsTab === 'categories' ? (
                        <div className="space-y-4">
                            <div className="flex space-x-2">
                                <input 
                                    type="text" placeholder="New Category Name"
                                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newCategory}
                                    onChange={(e) => setNewCategory(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && newCategory.trim() && (addCategory(newCategory.trim()), setNewCategory(''))}
                                />
                                <button 
                                    disabled={!newCategory.trim()}
                                    onClick={() => { addCategory(newCategory.trim()); setNewCategory(''); }}
                                    className="px-4 bg-blue-600 text-white rounded font-bold text-sm disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="space-y-2">
                                {categories.map(cat => (
                                    <div key={cat} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="text-blue-500 dark:text-blue-400">
                                                {getCategoryIcon(cat)}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-200 font-medium">{cat}</span>
                                        </div>
                                        <button onClick={() => deleteCategory(cat)} className="text-slate-400 hover:text-red-500">
                                            <Icons.X />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex space-x-2">
                                <input 
                                    type="text" placeholder="New Tag Name"
                                    className="flex-1 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && newTag.trim() && (addTag(newTag.trim()), setNewTag(''))}
                                />
                                <button 
                                    disabled={!newTag.trim()}
                                    onClick={() => { addTag(newTag.trim()); setNewTag(''); }}
                                    className="px-4 bg-blue-600 text-white rounded font-bold text-sm disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <div key={tag} className="flex items-center space-x-1 pl-3 pr-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800 text-sm">
                                        <span>{tag}</span>
                                        <button onClick={() => deleteTag(tag)} className="text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
                                            <Icons.X />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end">
                    <button onClick={() => setShowSettingsModal(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded font-medium text-sm transition-colors">Done</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};