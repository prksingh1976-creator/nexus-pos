import React, { useState } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Icons } from '../constants';
import { generateBusinessInsight } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { products, transactions, customers, user } = useShop();
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const navigate = useNavigate();

  // Stats Calculation
  const totalRevenue = transactions
    .filter(t => t.type === 'sale')
    .reduce((sum, t) => sum + t.total, 0);
  
  const totalSalesCount = transactions.length;
  const lowStockCount = products.filter(p => p.stock < p.minStockLevel).length;
  const totalReceivable = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  // Chart Data: Sales per day
  const chartData = transactions.length > 0 ? transactions.slice(0, 10).map((t, idx) => ({
    name: new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    amount: t.total,
  })).reverse() : [
      { name: '09:00', amount: 0 },
      { name: '12:00', amount: 0 },
      { name: '15:00', amount: 0 },
      { name: '18:00', amount: 0 }
  ];

  // Top Products Data
  const topProducts = React.useMemo(() => {
    const productCounts: Record<string, number> = {};
    transactions.forEach(t => {
      t.items.forEach(item => {
        const key = item.name;
        productCounts[key] = (productCounts[key] || 0) + item.quantity;
      });
    });
    return Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [transactions]);

  const handleGenerateInsight = async () => {
    setLoadingAi(true);
    const result = await generateBusinessInsight(products, transactions, customers);
    setInsight(result);
    setLoadingAi(false);
  };

  const StatCard = ({ title, value, icon, gradient, onClick }: any) => (
    <div 
        onClick={onClick}
        className={`relative overflow-hidden p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 ${gradient} cursor-pointer hover:shadow-lg transition-all active:scale-[0.98]`}
    >
        <div className="relative z-10 flex justify-between items-start">
            <div className="text-white">
                <p className="text-xs font-medium opacity-80 mb-1">{title}</p>
                <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
            </div>
            <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-white scale-90">
                {icon}
            </div>
        </div>
        {/* Decorative Circle */}
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/10 rounded-full blur-2xl"></div>
    </div>
  );

  const QuickAction = ({ label, icon, onClick, colorClass }: any) => (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all active:scale-95 ${colorClass}`}
    >
      <div className="mb-2 p-2 rounded-full bg-white/20">{icon}</div>
      <span className="text-xs font-bold">{label}</span>
    </button>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 md:space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Overview for {user?.name.split(' ')[0]}.</p>
        </div>
        <div className="flex gap-2">
            <span className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
            </span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
            title="Revenue" 
            value={`₹${totalRevenue.toFixed(0)}`} 
            icon={<Icons.Dashboard />} 
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            onClick={() => navigate('/orders', { state: { filter: 'completed' } })}
        />
        <StatCard 
            title="Transactions" 
            value={totalSalesCount} 
            icon={<Icons.Cart />} 
            gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
            onClick={() => navigate('/orders', { state: { filter: 'all' } })}
        />
        <StatCard 
            title="Low Stock" 
            value={lowStockCount} 
            icon={<Icons.Inventory />} 
            gradient="bg-gradient-to-br from-orange-500 to-red-500"
            onClick={() => navigate('/inventory', { state: { filter: 'low-stock' } })}
        />
        <StatCard 
            title="Credit Due" 
            value={`₹${totalReceivable.toFixed(0)}`} 
            icon={<Icons.Users />} 
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
            onClick={() => navigate('/customers', { state: { filter: 'debtors' } })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-6">
        {/* Main Chart Section */}
        <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Sales Trend */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-72 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-slate-800 dark:text-white">Sales Trend</h3>
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md">Last 10 Sales</span>
              </div>
              <div className="flex-1 w-full min-h-0">
                {transactions.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-slate-400 flex-col gap-2">
                        <Icons.Dashboard />
                        <p className="text-sm">No sales recorded yet.</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            tickFormatter={(value) => `₹${value}`} 
                        />
                        <Tooltip 
                            cursor={{stroke: '#3b82f6', strokeWidth: 2}}
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px'}} 
                        />
                        <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
               <QuickAction 
                  label="New Sale" 
                  icon={<Icons.Cart />} 
                  onClick={() => navigate('/pos')} 
                  colorClass="bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20 hover:bg-blue-700"
               />
               <QuickAction 
                  label="Add Item" 
                  icon={<Icons.Plus />} 
                  onClick={() => navigate('/inventory')} 
                  colorClass="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
               />
               <QuickAction 
                  label="New Customer" 
                  icon={<Icons.Users />} 
                  onClick={() => navigate('/customers')} 
                  colorClass="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
               />
               <QuickAction 
                  label="Scan Stock" 
                  icon={<Icons.Inventory />} 
                  onClick={() => navigate('/inventory')} 
                  colorClass="bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-500/20 hover:bg-purple-700"
               />
            </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
            {/* Top Products */}
            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 min-h-[200px]">
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Top Selling Items</h3>
              <div className="space-y-4">
                {topProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No data available.</p>
                ) : (
                  topProducts.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500">{idx + 1}</span>
                         <span className="text-sm text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{p.name}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">{p.count} sold</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Assistant */}
            <div className="bg-slate-900 text-white p-5 rounded-xl shadow-xl flex flex-col border border-slate-700 relative overflow-hidden h-64">
              {/* Background Decor */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

              <div className="relative z-10 flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg shadow-lg">
                  <Icons.Sparkles />
                </div>
                <div>
                    <h3 className="text-base font-bold">Smart Insights</h3>
                    <p className="text-[10px] text-slate-400">Powered by Gemini AI</p>
                </div>
              </div>
              
              <div className="relative z-10 flex-1 overflow-y-auto mb-4 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 scrollbar-thin">
                {!insight ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-2">
                    <p className="text-xs">Tap analyze to get actionable tips on your inventory and sales.</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-line text-xs text-slate-200 leading-relaxed font-light">{insight}</div>
                )}
              </div>

              <button
                onClick={handleGenerateInsight}
                disabled={loadingAi || transactions.length === 0}
                className="relative z-10 w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-lg font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/25"
              >
                {loadingAi ? (
                  <span className="animate-pulse">Analyzing...</span>
                ) : (
                  <>
                    <Icons.Sparkles />
                    <span>Analyze Performance</span>
                  </>
                )}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};