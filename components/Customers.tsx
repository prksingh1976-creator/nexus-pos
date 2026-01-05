import React, { useState } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Customer, Transaction } from '../types';
import { Icons } from '../constants';

export const Customers: React.FC = () => {
  const { customers, addCustomer, transactions, processTransaction } = useShop();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Transaction View State
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);

  // Form State
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });

  // Payment/Adjustment Modal
  const [showActionModal, setShowActionModal] = useState<'settle' | 'adjust' | null>(null);
  const [amountInput, setAmountInput] = useState('');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    addCustomer({
      id: crypto.randomUUID(),
      name: newCustomer.name,
      email: newCustomer.email,
      phone: newCustomer.phone,
      balance: 0,
      totalSpent: 0,
      lastVisit: new Date().toISOString()
    });
    setNewCustomer({ name: '', email: '', phone: '' });
    setShowAddModal(false);
  };

  const getCustomerTransactions = (customerId: string) => {
    return transactions.filter(t => t.customerId === customerId);
  };

  const handleTransaction = () => {
      if (!selectedCustomer || !amountInput) return;
      const amount = parseFloat(amountInput);
      if (isNaN(amount) || amount <= 0) {
          alert("Please enter a valid positive amount");
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
                  name: 'Manual Credit Added',
                  seller: 'Store Admin',
                  category: 'Services',
                  tags: [],
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

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-4rem)] md:h-screen flex flex-col">
      <header className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Customers</h2>
           <p className="text-slate-500 dark:text-slate-400">Manage profiles and credit history.</p>
        </div>
        <button 
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 md:w-auto md:h-auto md:px-6 md:py-2.5 bg-blue-600 text-white rounded-full md:rounded-xl hover:bg-blue-700 font-bold flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
        >
            <Icons.Plus />
            <span className="hidden md:inline">Add Customer</span>
        </button>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex overflow-hidden relative">
        {/* List View */}
        <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <input 
                    type="text" 
                    placeholder="Search customers..." 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white placeholder:text-slate-400 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">No customers found.</div>
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
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.phone || c.email}</p>
                                </div>
                                {c.balance > 0 && (
                                    <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-[10px] uppercase font-bold px-2 py-1 rounded-full">
                                        ₹{c.balance.toFixed(0)} Due
                                    </span>
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
                            <div>
                                <button className="md:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 mb-4 flex items-center font-bold text-sm" onClick={() => setSelectedCustomer(null)}>
                                    <Icons.ChevronUp /> <span className="rotate-90 ml-1">Back</span>
                                </button>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white">{selectedCustomer.name}</h2>
                                <div className="flex flex-col md:flex-row md:space-x-4 mt-2 text-slate-500 dark:text-slate-400 text-sm">
                                    <span>{selectedCustomer.email}</span>
                                    <span className="hidden md:inline">•</span>
                                    <span>{selectedCustomer.phone}</span>
                                </div>
                            </div>
                            <div className="text-right bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                                <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">Current Balance</p>
                                <p className={`text-3xl font-black ${selectedCustomer.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    ₹{selectedCustomer.balance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-8">
                            <button 
                                onClick={() => setShowActionModal('settle')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98]"
                                disabled={selectedCustomer.balance <= 0}
                            >
                                Pay Debt
                            </button>
                            <button 
                                onClick={() => setShowActionModal('adjust')}
                                className="flex-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 py-3 rounded-xl font-bold transition-all active:scale-[0.98]"
                            >
                                Lend (Add Credit)
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-800">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">History</h3>
                        <div className="space-y-4">
                            {getCustomerTransactions(selectedCustomer.id).length === 0 ? (
                                <p className="text-slate-400 italic text-center py-10">No transaction history.</p>
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
                                                    {t.type === 'payment' ? 'Debt Payment' : (t.items[0]?.name === 'Manual Credit Added' ? 'Credit Adjustment' : 'Purchase')}
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
                                            {t.paymentMethod === 'account' && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">CREDIT</span>}
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
                    <p className="font-medium">Select a customer to view details</p>
                </div>
            )}
        </div>
      </div>

      {/* Modals (Add Customer, Actions) - styling updated similarly in actual implementation */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
             <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">New Customer</h3>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                    <input 
                        type="text" required placeholder="Full Name" 
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                    <input 
                        type="email" placeholder="Email" 
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                    <input 
                        type="tel" placeholder="Phone Number" 
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-bold">Cancel</button>
                        <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">Save Profile</button>
                    </div>
                </form>
             </div>
        </div>
      )}
      
      {/* Action Modal */}
      {showActionModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 w-full max-w-sm">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {showActionModal === 'settle' ? 'Receive Payment' : 'Add Credit (Lend)'}
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                    {showActionModal === 'settle' 
                        ? `How much is ${selectedCustomer?.name} paying back?` 
                        : `How much credit are you giving ${selectedCustomer?.name}?`}
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
                    <button onClick={() => setShowActionModal(null)} className="py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancel</button>
                    <button 
                        onClick={handleTransaction}
                        className={`py-3 text-white rounded-xl font-bold shadow-lg ${showActionModal === 'settle' ? 'bg-green-600 shadow-green-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}
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