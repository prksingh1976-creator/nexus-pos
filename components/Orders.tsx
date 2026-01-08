import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShop } from '../contexts/ShopContext';
import { Transaction } from '../types';
import { Icons } from '../constants';
import QRCode from 'qrcode';

export const Orders: React.FC = () => {
  const { transactions, updateOrderStatus, deleteTransaction, user, customers } = useShop();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'queued' | 'completed' | 'cancelled'>('queued');
  
  // Advanced Filters
  const [customerFilter, setCustomerFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Payment Modal State
  const [selectedOrder, setSelectedOrder] = useState<Transaction | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'method' | 'upi_scan'>('method');
  const [upiQrCode, setUpiQrCode] = useState<string | null>(null);

  // Print State
  const [orderToPrint, setOrderToPrint] = useState<Transaction | null>(null);

  // Filtering Logic
  const filteredTransactions = transactions
    .filter(t => {
        // Status Filter
        if (filter !== 'all' && t.status !== filter) return false;
        
        // Customer Filter
        if (customerFilter && t.customerId !== customerFilter) return false;

        // Date Range Filter
        if (startDate) {
            const txDate = new Date(t.date);
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            if (txDate < start) return false;
        }
        if (endDate) {
            const txDate = new Date(t.date);
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            if (txDate > end) return false;
        }

        return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'queued': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const openPaymentModal = (order: Transaction) => {
      setSelectedOrder(order);
      setPaymentStep('method');
      setShowPaymentModal(true);
  };

  const handleResumeOrder = (order: Transaction) => {
      // Direct resume without confirmation
      deleteTransaction(order.id);
      navigate('/pos', { 
          state: { 
              cart: order.items, 
              customerId: order.customerId, 
              queueName: order.queueName 
          } 
      });
  };

  const handlePrint = (order: Transaction) => {
      setOrderToPrint(order);
      // Wait for state to update then print
      setTimeout(() => {
          window.print();
          // Clear after printing (optional, helps cleanup)
          // setOrderToPrint(null); 
      }, 100);
  };

  const generateUpiQr = async () => {
      if (!selectedOrder) return;
      const upiId = user?.upiId;
      if (!upiId) {
          alert("UPI ID not configured. Please add it in Account Settings.");
          return;
      }

      const name = encodeURIComponent(user?.name || 'Nexus Shop');
      const amount = selectedOrder.total.toFixed(2);
      const upiUrl = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR`; 
      
      try {
          const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 300 });
          setUpiQrCode(qrDataUrl);
          setPaymentStep('upi_scan');
      } catch (err) {
          console.error(err);
          alert("Failed to generate QR Code");
      }
  };

  const completeOrder = (method: 'cash' | 'account' | 'upi') => {
      if (selectedOrder) {
          if (method === 'account' && !selectedOrder.customerId) {
              alert("Cannot use Credit Account for Guest orders.");
              return;
          }
          updateOrderStatus(selectedOrder.id, 'completed', method);
          setShowPaymentModal(false);
          setSelectedOrder(null);
      }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Orders</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">Manage order queue and view history.</p>
            </div>
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500'}`}
            >
                <Icons.Settings />
            </button>
        </div>

        {/* Filters Section */}
        {showFilters && (
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Customer</label>
                    <select 
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        value={customerFilter}
                        onChange={(e) => setCustomerFilter(e.target.value)}
                    >
                        <option value="">All Customers</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Start Date</label>
                    <input 
                        type="date"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">End Date</label>
                    <input 
                        type="date"
                        className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:text-white"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="md:col-span-3 flex justify-end">
                    <button 
                        onClick={() => { setCustomerFilter(''); setStartDate(''); setEndDate(''); }}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>
        )}
        
        {/* Status Tabs */}
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto max-w-full self-start">
            {(['queued', 'completed', 'cancelled', 'all'] as const).map(f => (
                <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                        filter === f 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                    {f}
                </button>
            ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
          {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                  <Icons.Orders />
                  <p className="mt-3 font-medium">No orders found.</p>
              </div>
          ) : (
              filteredTransactions.map(order => (
                  <div key={order.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-100 dark:border-slate-700 pb-4 mb-4 gap-4">
                          <div>
                              <div className="flex items-center gap-3 mb-1">
                                  <span className="font-bold text-lg text-slate-800 dark:text-white">
                                      {order.queueName ? `${order.queueName}` : `#${order.id.slice(0, 8)}`}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${getStatusColor(order.status)}`}>
                                      {order.status}
                                  </span>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                  {new Date(order.date).toLocaleString()} • {order.customerName || 'Guest'}
                              </p>
                          </div>
                          <div className="flex items-center gap-4">
                              <div className="text-right">
                                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount</p>
                                  <p className="text-xl font-bold text-slate-800 dark:text-white">₹{order.total.toFixed(2)}</p>
                              </div>
                          </div>
                      </div>

                      <div className="mb-4">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Items</p>
                          <div className="space-y-2">
                              {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm text-slate-700 dark:text-slate-300">
                                      <span>{item.quantity}x {item.name}</span>
                                      <span className="text-slate-500 dark:text-slate-400">₹{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg mb-4 text-sm">
                            <div className="flex justify-between mb-1 text-slate-500 dark:text-slate-400">
                                <span>Subtotal</span>
                                <span>₹{order.subtotal?.toFixed(2) || (order.total).toFixed(2)}</span>
                            </div>
                            {order.charges?.map((c, i) => (
                                <div key={i} className="flex justify-between mb-1">
                                    <span className="text-slate-500 dark:text-slate-400">{c.name}</span>
                                    <span className={c.isDiscount ? 'text-green-600' : 'text-slate-600 dark:text-slate-300'}>
                                        {c.isDiscount ? '-' : ''}₹{c.amount.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                      </div>

                      <div className="flex gap-3 pt-2">
                        {order.status === 'queued' ? (
                          <>
                              <button 
                                  onClick={() => openPaymentModal(order)}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                              >
                                  Pay & Mark Done
                              </button>
                              <button 
                                  onClick={() => handleResumeOrder(order)}
                                  className="px-4 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg font-medium transition-colors"
                              >
                                  Edit in POS
                              </button>
                              <button 
                                  onClick={() => updateOrderStatus(order.id, 'cancelled')}
                                  className="px-4 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg font-medium transition-colors"
                              >
                                  Cancel
                              </button>
                          </>
                        ) : (
                          <button 
                              onClick={() => handlePrint(order)}
                              className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white py-2 rounded-lg font-medium transition-colors hover:bg-slate-200"
                          >
                             Print Receipt
                          </button>
                        )}
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700 flex justify-between items-center text-xs text-slate-400">
                          <span className="uppercase">Payment: {order.paymentMethod === 'pending' ? 'Pending' : order.paymentMethod}</span>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedOrder && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 fixed">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md transform transition-all scale-100 max-h-[90vh] overflow-y-auto">
                {paymentStep === 'method' && (
                  <>
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Complete Payment</h3>
                        <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Icons.X /></button>
                     </div>

                     <div className="mb-6 text-center">
                         <p className="text-sm text-slate-500 dark:text-slate-400">Total Amount</p>
                         <p className="text-3xl font-bold text-slate-800 dark:text-white">₹{selectedOrder.total.toFixed(2)}</p>
                     </div>
                    
                     <div className="space-y-3">
                        <button 
                            onClick={() => completeOrder('cash')}
                            className="w-full py-4 border-2 border-slate-100 dark:border-slate-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl flex items-center px-4 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold mr-4 text-lg">₹</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 dark:text-white">Cash</p>
                            </div>
                        </button>

                         <button 
                            onClick={() => completeOrder('account')}
                            disabled={!selectedOrder.customerId}
                            className="w-full py-4 border-2 border-slate-100 dark:border-slate-700 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl flex items-center px-4 transition-all group disabled:opacity-50"
                        >
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold mr-4">A</div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800 dark:text-white">Store Credit / Tab</p>
                                {!selectedOrder.customerId && <p className="text-xs text-red-400">Not available for Guest</p>}
                            </div>
                        </button>

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
                  </>
                )}

                {paymentStep === 'upi_scan' && (
                    <div className="text-center">
                        <div className="flex justify-between items-center mb-4">
                             <button onClick={() => setPaymentStep('method')} className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">Back</button>
                             <h3 className="text-xl font-bold text-slate-800 dark:text-white">Scan to Pay</h3>
                             <div className="w-8"></div>
                        </div>
                        
                        <div className="bg-white border-2 border-slate-800 p-4 rounded-xl inline-block mb-4">
                            {upiQrCode && <img src={upiQrCode} alt="UPI QR Code" className="w-64 h-64" />}
                        </div>
                        
                        <p className="text-lg font-bold text-slate-800 dark:text-white mb-6">₹{selectedOrder.total.toFixed(2)}</p>

                        <button 
                           onClick={() => completeOrder('upi')}
                           className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-200"
                        >
                           Payment Received
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}
      
      {/* HIDDEN PRINT RECEIPT CONTAINER */}
      {orderToPrint && (
        <div id="printable-receipt" className="hidden">
            <div style={{ padding: '20px', fontFamily: 'monospace', textAlign: 'center' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 10px 0' }}>{user?.name || 'Nexus Shop'}</h1>
                <p style={{ margin: '0' }}>Order #{orderToPrint.id.slice(0, 8)}</p>
                <p style={{ margin: '0 0 20px 0' }}>{new Date(orderToPrint.date).toLocaleString()}</p>
                
                <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '10px 0', marginBottom: '20px' }}>
                    {orderToPrint.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ textAlign: 'left' }}>{item.quantity}x {item.name}</span>
                            <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>Subtotal</span>
                    <span>₹{orderToPrint.subtotal.toFixed(2)}</span>
                </div>
                {orderToPrint.charges.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span>{c.name}</span>
                        <span>{c.isDiscount ? '-' : ''}₹{c.amount.toFixed(2)}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', marginTop: '10px' }}>
                    <span>Total</span>
                    <span>₹{orderToPrint.total.toFixed(2)}</span>
                </div>
                
                <p style={{ marginTop: '20px', fontSize: '12px' }}>Thank you for your business!</p>
            </div>
        </div>
      )}
    </div>
  );
};