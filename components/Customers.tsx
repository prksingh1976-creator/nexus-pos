import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Customer, Transaction } from '../types';
import { Icons } from '../constants';
import { useLocation } from 'react-router-dom';
import { loadFaceModels, getFaceDescriptor } from '../services/faceRecService';

export const Customers: React.FC = () => {
  const { customers, addCustomer, updateCustomer, deleteCustomer, transactions, processTransaction, user } = useShop();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDebtorsOnly, setShowDebtorsOnly] = useState(false);
  const [showModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Face Registration State
  const [showCamera, setShowCamera] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceStatus, setFaceStatus] = useState('Stand still...');

  // Transaction View State
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  // Form State
  const [newCustomer, setNewCustomer] = useState<{
      name: string;
      phone: string;
      email: string;
      company: string;
      manager: string;
      notes: string;
      smsEnabled: boolean;
      smsTemplateId: string;
  }>({ name: '', phone: '', email: '', company: '', manager: '', notes: '', smsEnabled: false, smsTemplateId: '' });

  // Payment/Adjustment Modal
  const [showActionModal, setShowActionModal] = useState<'settle' | 'adjust' | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // Stats
  const totalReceivables = useMemo(() => customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0), [customers]);
  const debtorsCount = useMemo(() => customers.filter(c => c.balance > 0).length, [customers]);
  
  // Available SMS Templates
  const availableTemplates = user?.preferences?.smsTemplates || [];

  useEffect(() => {
    if (location.state && location.state.filter === 'debtors') {
        setShowDebtorsOnly(true);
    }
  }, [location]);

  // Camera Logic
  useEffect(() => {
      let stream: MediaStream | null = null;
      if (showCamera && videoRef.current) {
          loadFaceModels().then(() => {
              navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
                  stream = s;
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                      videoRef.current.play();
                  }
              });
          });
      }
      return () => {
          stream?.getTracks().forEach(t => t.stop());
      };
  }, [showCamera]);

  const captureFace = async () => {
      if (!videoRef.current) return;
      setFaceStatus("Scanning...");
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (descriptor) {
          setFaceDescriptor(Array.from(descriptor));
          setFaceStatus("Success!");
          setTimeout(() => setShowCamera(false), 1000);
      } else {
          setFaceStatus("No face detected. Try again.");
      }
  };

  const filteredCustomers = customers
    .filter(c => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = c.name.toLowerCase().includes(term) || 
                              (c.company && c.company.toLowerCase().includes(term)) ||
                              (c.phone && c.phone.includes(term));
        const matchesDebt = showDebtorsOnly ? c.balance > 0 : true;
        return matchesSearch && matchesDebt;
    })
    .sort((a, b) => {
        if (showDebtorsOnly) return b.balance - a.balance;
        return a.name.localeCompare(b.name);
    });

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing && selectedCustomer) {
        updateCustomer({
            ...selectedCustomer,
            name: newCustomer.name,
            phone: newCustomer.phone || undefined,
            email: newCustomer.email || undefined,
            company: newCustomer.company || undefined,
            manager: newCustomer.manager || undefined,
            notes: newCustomer.notes || undefined,
            faceDescriptor: faceDescriptor || selectedCustomer.faceDescriptor,
            smsEnabled: newCustomer.smsEnabled,
            smsTemplateId: newCustomer.smsTemplateId || undefined
        });
        // Update local selected state to show changes immediately
        setSelectedCustomer(prev => prev ? ({
            ...prev,
            name: newCustomer.name,
            phone: newCustomer.phone || undefined,
            email: newCustomer.email || undefined,
            company: newCustomer.company || undefined,
            manager: newCustomer.manager || undefined,
            notes: newCustomer.notes || undefined,
            faceDescriptor: faceDescriptor || prev.faceDescriptor,
            smsEnabled: newCustomer.smsEnabled,
            smsTemplateId: newCustomer.smsTemplateId || undefined
        }) : null);
    } else {
        addCustomer({
            id: crypto.randomUUID(),
            name: newCustomer.name,
            phone: newCustomer.phone || undefined,
            email: newCustomer.email || undefined,
            company: newCustomer.company || undefined,
            manager: newCustomer.manager || undefined,
            notes: newCustomer.notes || undefined,
            balance: 0,
            totalSpent: 0,
            lastVisit: new Date().toISOString(),
            faceDescriptor: faceDescriptor,
            smsEnabled: newCustomer.smsEnabled,
            smsTemplateId: newCustomer.smsTemplateId || undefined
        });
    }
    
    setNewCustomer({ name: '', phone: '', email: '', company: '', manager: '', notes: '', smsEnabled: false, smsTemplateId: '' });
    setFaceDescriptor(undefined);
    setShowAddModal(false);
    setIsEditing(false);
  };

  const handleDeleteCustomer = () => {
      if (!selectedCustomer) return;
      if (Math.abs(selectedCustomer.balance) > 0.01) {
          alert("Cannot delete customer with active balance. Please settle debt first.");
          return;
      }
      
      if (confirm(`Are you sure you want to delete ${selectedCustomer.name}? This cannot be undone.`)) {
          deleteCustomer(selectedCustomer.id);
          setSelectedCustomer(null);
      }
  };

  const getCustomerTransactions = (customerId: string) => {
    return transactions.filter(t => t.customerId === customerId);
  };

  const handleTransaction = () => {
      if (!selectedCustomer || !amountInput) return;
      const amount = parseFloat(amountInput);
      if (isNaN(amount) || amount <= 0) {
          alert("Enter valid amount");
          return;
      }

      if (showActionModal === 'settle') {
          processTransaction({
              id: crypto.randomUUID(),
              customerId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              date: new Date().toISOString(),
              items: [],
              subtotal: 0,
              charges: [],
              total: amount,
              type: 'payment',
              paymentMethod: 'cash',
              status: 'completed'
          });
      } else if (showActionModal === 'adjust') {
          processTransaction({
              id: crypto.randomUUID(),
              customerId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              date: new Date().toISOString(),
              items: [{
                  id: 'manual-adj',
                  name: 'Manual Credit',
                  seller: 'Admin',
                  category: 'Services',
                  price: amount,
                  cost: 0,
                  stock: 9999,
                  minStockLevel: 0,
                  quantity: 1
              }],
              subtotal: amount,
              charges: [],
              total: amount,
              type: 'sale',
              paymentMethod: 'account', 
              status: 'completed'
          });
      }

      setShowActionModal(null);
      setAmountInput('');
  };

  const openAddModal = () => {
      setNewCustomer({ name: '', phone: '', email: '', company: '', manager: '', notes: '', smsEnabled: false, smsTemplateId: '' });
      setFaceDescriptor(undefined);
      setIsEditing(false);
      setShowAddModal(true);
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)] md:h-screen flex flex-col animate-fade-in">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Clients</h2>
           <p className="text-slate-500 dark:text-slate-400">Manage accounts & debts.</p>
        </div>
        
        <div className="flex gap-4">
             {/* Total Receivable Card */}
             <div className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3">
                 <div className="p-2 bg-red-100 dark:bg-red-800 rounded-lg text-red-600 dark:text-red-200">
                     <Icons.Users />
                 </div>
                 <div>
                     <p className="text-xs font-bold text-red-500 uppercase tracking-wide">Credit Given</p>
                     <p className="text-xl font-black text-red-600 dark:text-red-400">₹{totalReceivables.toFixed(0)}</p>
                 </div>
             </div>

            <button 
                onClick={openAddModal}
                className="h-auto px-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
            >
                <Icons.Plus />
                <span className="hidden md:inline">New Client</span>
            </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex overflow-hidden relative">
        {/* List View */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <input 
                    type="text" 
                    placeholder="Search..." 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2 mt-3">
                   <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${showDebtorsOnly ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                       <input 
                         type="checkbox" 
                         checked={showDebtorsOnly} 
                         onChange={e => setShowDebtorsOnly(e.target.checked)} 
                         className="rounded text-red-600 focus:ring-red-500 w-4 h-4" 
                       />
                       <span className="text-xs font-bold">Debtors Only ({debtorsCount})</span>
                   </label>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        {showDebtorsOnly ? 'No debt found.' : 'No clients found.'}
                    </div>
                ) : (
                    filteredCustomers.map(c => (
                        <div 
                            key={c.id} 
                            onClick={() => setSelectedCustomer(c)}
                            className={`p-4 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{c.name}</h4>
                                    {c.company && <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{c.company}</p>}
                                    {c.phone && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.phone}</p>}
                                </div>
                                {c.balance > 0 ? (
                                    <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                                        ₹{c.balance.toFixed(0)}
                                    </span>
                                ) : (
                                    <span className="text-emerald-500 text-[10px] font-bold mt-1">OK</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Detail View (Desktop: Right Side, Mobile: Full Overlay) */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-slate-800 md:relative absolute inset-0 md:inset-auto z-10 md:z-auto transition-transform duration-300 ${selectedCustomer ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            {selectedCustomer ? (
                <>
                    <div className="p-6 md:p-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <div className="flex justify-between items-start">
                            <div className="flex-1 pr-4">
                                <div className="flex justify-between items-center mb-4 md:mb-2">
                                    <button className="md:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 flex items-center font-bold text-sm" onClick={() => setSelectedCustomer(null)}>
                                        <Icons.ChevronUp /> <span className="rotate-90 ml-1">Back</span>
                                    </button>
                                    
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setNewCustomer({
                                                    name: selectedCustomer.name,
                                                    phone: selectedCustomer.phone || '',
                                                    email: selectedCustomer.email || '',
                                                    company: selectedCustomer.company || '',
                                                    manager: selectedCustomer.manager || '',
                                                    notes: selectedCustomer.notes || '',
                                                    smsEnabled: selectedCustomer.smsEnabled || false,
                                                    smsTemplateId: selectedCustomer.smsTemplateId || ''
                                                });
                                                setFaceDescriptor(selectedCustomer.faceDescriptor);
                                                setIsEditing(true);
                                                setShowAddModal(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            title="Edit Details"
                                        >
                                            <Icons.Edit />
                                        </button>
                                        {Math.abs(selectedCustomer.balance) < 0.01 && (
                                            <button 
                                                onClick={handleDeleteCustomer}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Delete Client"
                                            >
                                                <Icons.Trash />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    {selectedCustomer.name}
                                    {selectedCustomer.faceDescriptor && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Face ID</span>}
                                </h2>
                                {selectedCustomer.company && (
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedCustomer.company}</p>
                                )}
                                <div className="flex flex-col gap-1 mt-3 text-sm text-slate-600 dark:text-slate-400">
                                    {selectedCustomer.phone && <p className="flex items-center gap-2"><span className="opacity-50 w-16">Phone:</span> {selectedCustomer.phone}</p>}
                                    {selectedCustomer.manager && <p className="flex items-center gap-2"><span className="opacity-50 w-16">Manager:</span> {selectedCustomer.manager}</p>}
                                    {selectedCustomer.email && <p className="flex items-center gap-2"><span className="opacity-50 w-16">Email:</span> {selectedCustomer.email}</p>}
                                    {selectedCustomer.smsEnabled ? (
                                        <p className="flex items-center gap-2 text-green-600 font-bold text-xs"><span className="opacity-50 w-16 text-slate-500 font-normal">SMS:</span> Enabled</p>
                                    ) : (
                                        <p className="flex items-center gap-2 text-slate-400 text-xs"><span className="opacity-50 w-16 text-slate-500 font-normal">SMS:</span> Disabled</p>
                                    )}
                                </div>
                                {selectedCustomer.notes && (
                                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-800 text-xs text-yellow-800 dark:text-yellow-200">
                                        <strong>Note:</strong> {selectedCustomer.notes}
                                    </div>
                                )}
                            </div>
                            <div className="text-right bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hidden md:block">
                                <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">Balance</p>
                                <p className={`text-3xl font-black ${selectedCustomer.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    ₹{selectedCustomer.balance.toFixed(0)}
                                </p>
                            </div>
                        </div>
                        {/* Mobile Balance Card */}
                         <div className="text-right bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 md:hidden mt-4">
                                <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">Balance</p>
                                <p className={`text-3xl font-black ${selectedCustomer.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    ₹{selectedCustomer.balance.toFixed(0)}
                                </p>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-8">
                            <button 
                                onClick={() => setShowActionModal('settle')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98] flex flex-col items-center justify-center"
                                disabled={selectedCustomer.balance <= 0}
                            >
                                <span>Receive Payment</span>
                            </button>
                            <button 
                                onClick={() => setShowActionModal('adjust')}
                                className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 py-3 rounded-xl font-bold transition-all active:scale-[0.98] flex flex-col items-center justify-center"
                            >
                                <span>Give Credit</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-800">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">History</h3>
                        <div className="space-y-4">
                            {getCustomerTransactions(selectedCustomer.id).length === 0 ? (
                                <p className="text-slate-400 italic text-center py-10">No history found.</p>
                            ) : (
                                getCustomerTransactions(selectedCustomer.id).reverse().map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => setViewingTransaction(t)}
                                        className="bg-white dark:bg-slate-700/30 border border-slate-100 dark:border-slate-700/50 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${t.type === 'payment' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {t.type === 'payment' ? '₹' : <Icons.Cart />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-white">
                                                    {t.type === 'payment' ? 'Payment Received' : (t.items[0]?.name === 'Manual Credit' ? 'Manual Credit' : 'Purchase')}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {new Date(t.date).toLocaleDateString()} • {new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`block font-bold text-lg ${t.type === 'payment' ? 'text-green-600' : 'text-slate-800 dark:text-white'}`}>
                                                {t.type === 'payment' ? '-' : ''}₹{t.total.toFixed(0)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="hidden md:flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Icons.Users />
                    </div>
                    <p className="font-medium">Select a client</p>
                </div>
            )}
        </div>
      </div>

      {/* Modals (Add/Edit Customer, Actions) */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">{isEditing ? 'Edit Client' : 'New Client'}</h3>
                
                {/* Face Registration Section */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Face ID</span>
                        {faceDescriptor ? (
                            <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-1 rounded">Registered</span>
                        ) : (
                            <span className="text-xs text-slate-400">Not Set</span>
                        )}
                    </div>
                    
                    {showCamera ? (
                        <div className="relative rounded-xl overflow-hidden bg-black h-48 mb-3">
                            <video 
                                ref={videoRef} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                playsInline
                            />
                            <div className="absolute bottom-0 inset-x-0 p-2 bg-black/50 text-white text-xs text-center font-medium">
                                {faceStatus}
                            </div>
                        </div>
                    ) : null}

                    {showCamera ? (
                        <div className="flex gap-2">
                            <button onClick={captureFace} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-xs">Capture Face</button>
                            <button onClick={() => setShowCamera(false)} className="px-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs">Cancel</button>
                        </div>
                    ) : (
                        <button 
                            type="button" 
                            onClick={() => setShowCamera(true)}
                            className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            {faceDescriptor ? 'Update Face ID' : 'Register Face ID'}
                        </button>
                    )}
                </div>

                <form onSubmit={handleSaveCustomer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-500 mb-1">FULL NAME *</label>
                            <input 
                                type="text" required
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                                value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                            />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-bold text-slate-500 mb-1">PHONE NUMBER (OPT)</label>
                            <input 
                                type="tel"
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                                value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                            />
                        </div>
                        
                        {/* SMS Toggle */}
                        <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-slate-500">SMS ALERTS</label>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={newCustomer.smsEnabled} 
                                        onChange={e => setNewCustomer({...newCustomer, smsEnabled: e.target.checked})} 
                                        disabled={!newCustomer.phone}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                                </label>
                             </div>
                             {!newCustomer.phone && <p className="text-[10px] text-red-400">Phone number required for SMS.</p>}
                             
                             {newCustomer.smsEnabled && (
                                 <div className="mt-2">
                                     <label className="block text-[10px] font-bold text-slate-400 mb-1">SMS TEMPLATE</label>
                                     <select 
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg p-2 text-xs text-slate-700 dark:text-slate-200"
                                        value={newCustomer.smsTemplateId}
                                        onChange={e => setNewCustomer({...newCustomer, smsTemplateId: e.target.value})}
                                     >
                                         <option value="">Use Shop Default</option>
                                         {availableTemplates.map(t => (
                                             <option key={t.id} value={t.id}>{t.name}</option>
                                         ))}
                                     </select>
                                 </div>
                             )}
                        </div>

                        <div className="col-span-1">
                             <label className="block text-xs font-bold text-slate-500 mb-1">COMPANY (OPT)</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                                value={newCustomer.company} onChange={e => setNewCustomer({...newCustomer, company: e.target.value})}
                            />
                        </div>
                        <div className="col-span-1">
                             <label className="block text-xs font-bold text-slate-500 mb-1">MANAGER (OPT)</label>
                            <input 
                                type="text" 
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                                value={newCustomer.manager} onChange={e => setNewCustomer({...newCustomer, manager: e.target.value})}
                            />
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-bold text-slate-500 mb-1">EMAIL (OPT)</label>
                            <input 
                                type="email"
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                                value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                            />
                        </div>
                         <div className="col-span-2">
                             <label className="block text-xs font-bold text-slate-500 mb-1">NOTE (OPT)</label>
                            <textarea
                                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white text-sm"
                                rows={2}
                                value={newCustomer.notes} onChange={e => setNewCustomer({...newCustomer, notes: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
                            {isEditing ? 'Save Changes' : 'Create Client'}
                        </button>
                    </div>
                </form>
             </div>
        </div>
      )}
      
      {/* Action Modal */}
      {showActionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-sm">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {showActionModal === 'settle' ? 'Receive Payment' : 'Give Credit'}
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                    {showActionModal === 'settle' 
                        ? `Amount received from ${selectedCustomer?.name}?` 
                        : `Amount to lend to ${selectedCustomer?.name}?`}
                </p>
                
                <div className="relative mb-8">
                    <span className="absolute left-4 top-3 text-slate-400 font-bold text-xl">₹</span>
                    <input 
                        type="number" autoFocus
                        className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-3xl font-black outline-none focus:border-blue-500 bg-transparent text-slate-900 dark:text-white"
                        placeholder="0"
                        value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowActionModal(null)} className="py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                    <button 
                        onClick={handleTransaction}
                        className={`py-3 text-white rounded-xl font-bold shadow-lg transition-transform active:scale-[0.98] ${showActionModal === 'settle' ? 'bg-green-600 shadow-green-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};