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
          // Debt Payment
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
          // Add Debt (Lending)
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
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <div>
           <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Customers</h2>
           <p className="text-slate-500 dark:text-slate-400">Manage profiles and credit history.</p>
        </div>
        <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center space-x-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
            <Icons.Plus />
            <span>Add Customer</span>
        </button>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 flex overflow-hidden transition-colors">
        {/* List View */}
        <div className={`w-full md:w-1/3 border-r border-slate-200 dark:border-slate-700 flex flex-col ${selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <input 
                    type="text" 
                    placeholder="Search customers..." 
                    className="w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredCustomers.map(c => (
                    <div 
                        key={c.id} 
                        onClick={() => setSelectedCustomer(c)}
                        className={`p-4 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-semibold text-slate-800 dark:text-white">{c.name}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{c.email}</p>
                            </div>
                            {c.balance > 0 && (
                                <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs px-2 py-1 rounded-full font-medium">
                                    Owes ₹{c.balance.toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Detail View */}
        <div className={`flex-1 flex flex-col bg-white dark:bg-slate-800 ${!selectedCustomer ? 'hidden md:flex' : 'flex'}`}>
            {selectedCustomer ? (
                <>
                    <div className="p-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                        <div className="flex justify-between items-start">
                            <div>
                                <button className="md:hidden text-blue-600 dark:text-blue-400 mb-2 text-sm font-medium flex items-center" onClick={() => setSelectedCustomer(null)}>
                                    <span className="mr-1">←</span> Back to List
                                </button>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h2>
                                <div className="flex space-x-4 mt-2 text-slate-500 dark:text-slate-400 text-sm">
                                    <span>{selectedCustomer.email}</span>
                                    <span>•</span>
                                    <span>{selectedCustomer.phone}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wide font-bold">Credit Balance</p>
                                <p className={`text-4xl font-bold ${selectedCustomer.balance > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                                    ₹{selectedCustomer.balance.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-6">
                            <button 
                                onClick={() => setShowActionModal('settle')}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold shadow-md shadow-green-100 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={selectedCustomer.balance <= 0}
                            >
                                Settle Debt (Pay)
                            </button>
                            <button 
                                onClick={() => setShowActionModal('adjust')}
                                className="flex-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 py-2 rounded-lg font-bold transition-colors"
                            >
                                Add Credit (Lend)
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-8">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Transaction History</h3>
                        <p className="text-xs text-slate-500 mb-4">Click on a transaction to view items.</p>
                        <div className="space-y-4">
                            {getCustomerTransactions(selectedCustomer.id).length === 0 ? (
                                <p className="text-slate-400 italic">No transactions found.</p>
                            ) : (
                                getCustomerTransactions(selectedCustomer.id).reverse().map(t => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => setViewingTransaction(t)}
                                        className="bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 p-4 rounded-lg flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                                    >
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-white">
                                                {t.type === 'payment' ? 'Debt Payment' : (t.items[0]?.name === 'Manual Credit Added' ? 'Manual Credit Addition' : 'Purchase')}
                                                {t.paymentMethod === 'account' && <span className="ml-2 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">Credit Tab</span>}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(t.date).toLocaleDateString()} at {new Date(t.date).toLocaleTimeString()} • {t.items.length} Items
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${t.type === 'payment' ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-white'}`}>
                                                {t.type === 'payment' ? '-' : ''}₹{t.total.toFixed(2)}
                                            </span>
                                            <span className="text-slate-400"><Icons.ChevronDown /></span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <Icons.Users />
                    <p className="mt-2">Select a customer to view details</p>
                </div>
            )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-96 border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">New Customer</h3>
                <form onSubmit={handleAddCustomer} className="space-y-4">
                    <input 
                        type="text" required placeholder="Full Name" 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    />
                    <input 
                        type="email" required placeholder="Email" 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                    <input 
                        type="tel" placeholder="Phone Number" 
                        className="w-full border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                    <div className="flex space-x-2 pt-2">
                        <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">Save</button>
                    </div>
                </form>
             </div>
        </div>
      )}

      {/* Transaction Action Modal */}
      {showActionModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-80 border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {showActionModal === 'settle' ? 'Receive Payment' : 'Add Credit (Lend)'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {showActionModal === 'settle' 
                        ? `Enter amount paid by ${selectedCustomer?.name}.` 
                        : `Enter credit amount to add to ${selectedCustomer?.name}'s balance.`}
                </p>
                
                <div className="relative mb-4">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                    <input 
                        type="number" autoFocus
                        className="w-full pl-8 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded text-lg font-bold outline-none focus:border-blue-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                        placeholder="0.00"
                        value={amountInput}
                        onChange={e => setAmountInput(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setShowActionModal(null)} className="flex-1 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors">Cancel</button>
                    <button 
                        onClick={handleTransaction}
                        className={`flex-1 py-2 text-white rounded font-bold ${showActionModal === 'settle' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* View Transaction Items Modal */}
      {viewingTransaction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Transaction Details</h3>
                          <p className="text-xs text-slate-500">#{viewingTransaction.id.slice(0, 8)} • {new Date(viewingTransaction.date).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => setViewingTransaction(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Icons.X /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {/* Items List */}
                      <div>
                          <p className="text-xs font-bold text-slate-500 uppercase mb-2">Items Purchased</p>
                          <div className="space-y-2">
                              {viewingTransaction.items.length === 0 ? <p className="text-sm text-slate-400">No items (Payment Record)</p> : 
                                viewingTransaction.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-700/50 pb-2 last:border-0">
                                      <div>
                                          <p className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</p>
                                          <p className="text-xs text-slate-500">{item.variant} {item.quantity > 1 && `x${item.quantity}`}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="font-medium text-slate-800 dark:text-white">₹{(item.price * item.quantity).toFixed(2)}</p>
                                          {item.quantity > 1 && <p className="text-xs text-slate-400">@{item.price}</p>}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-sm space-y-1">
                          <div className="flex justify-between text-slate-500">
                              <span>Subtotal</span>
                              <span>₹{viewingTransaction.subtotal.toFixed(2)}</span>
                          </div>
                          {viewingTransaction.charges.map((c, i) => (
                              <div key={i} className="flex justify-between">
                                  <span className="text-slate-500">{c.name}</span>
                                  <span className={c.isDiscount ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}>
                                      {c.isDiscount ? '-' : ''}₹{c.amount.toFixed(2)}
                                  </span>
                              </div>
                          ))}
                          <div className="flex justify-between font-bold text-lg text-slate-800 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                              <span>Total</span>
                              <span>₹{viewingTransaction.total.toFixed(2)}</span>
                          </div>
                      </div>
                      
                      <div className="text-xs text-center text-slate-400">
                          Payment Method: <span className="uppercase font-bold">{viewingTransaction.paymentMethod}</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};