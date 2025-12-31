import React, { useState } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Icons } from '../constants';
import { generateBusinessInsight } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export const Dashboard: React.FC = () => {
  const { products, transactions, customers } = useShop();
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Stats Calculation
  const totalRevenue = transactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + t.total, 0);
  
  const totalSalesCount = transactions.length;
  const lowStockCount = products.filter(p => p.stock < p.minStockLevel).length;
  const totalReceivable = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  // Chart Data: Sales per day (Mock logic simplified for demo)
  const chartData = transactions.length > 0 ? transactions.slice(0, 10).map((t, idx) => ({
    name: new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    amount: t.total,
  })).reverse() : [
      { name: '09:00', amount: 0 },
      { name: '12:00', amount: 0 },
      { name: '15:00', amount: 0 },
      { name: '18:00', amount: 0 }
  ];

  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    const result = await generateBusinessInsight(products, transactions, customers);
    setInsight(result);
    setLoadingAi(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Dashboard</h2>
        <p className="text-slate-500 dark:text-slate-400">Welcome back! Here is your shop's overview.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Revenue</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">₹{totalRevenue.toFixed(2)}</h3>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-lg">
              <Icons.Dashboard /> {/* Using generic icon as placeholder */}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Transactions</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{totalSalesCount}</h3>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg">
              <Icons.Cart />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Low Stock Items</p>
              <h3 className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                {lowStockCount}
              </h3>
            </div>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 rounded-lg">
              <Icons.Inventory />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Credit Receivable</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white">₹{totalReceivable.toFixed(2)}</h3>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-lg">
              <Icons.Users />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-96 transition-colors">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Recent Transactions</h3>
          <div className="h-full w-full">
            {transactions.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                    <p>No sales yet. Start selling in POS!</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#475569" strokeOpacity={0.2} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} prefix="₹" />
                    <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff'}} 
                    />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col border border-slate-700">
          <div className="flex items-center space-x-2 mb-4">
            <div className="p-2 bg-indigo-500/20 rounded-lg backdrop-blur-sm border border-indigo-400/30 text-indigo-300">
              <Icons.Sparkles />
            </div>
            <h3 className="text-lg font-bold">Gemini Insights</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto mb-4 text-sm text-indigo-100 space-y-2">
             {!insight ? (
               <div className="flex flex-col items-center justify-center h-full text-center text-indigo-300/60">
                 <p>Tap below to analyze your store performance.</p>
               </div>
             ) : (
               <div className="whitespace-pre-line leading-relaxed">{insight}</div>
             )}
          </div>

          <button
            onClick={handleGenerateInsight}
            disabled={loadingAi || transactions.length === 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loadingAi ? (
              <span>Analyzing...</span>
            ) : (
              <>
                <Icons.Sparkles />
                <span>Generate Smart Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};