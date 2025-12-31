import React, { useState, useEffect } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Icons } from '../constants';
import { ChargeRule } from '../types';
import { askAppHelp } from '../services/geminiService';

interface SettingsModalProps {
  onClose: () => void;
}

const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden mb-3">
        <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-sm text-slate-800 dark:text-white">{title}</h3>
        </div>
        <div className="p-3 text-slate-600 dark:text-slate-300 text-xs space-y-2 leading-relaxed">
            {children}
        </div>
    </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { user, updateUser, chargeRules, addChargeRule, updateChargeRule, deleteChargeRule, products, customers, transactions, categories, tags, importData } = useShop();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'account' | 'charges' | 'data' | 'help'>('account');

  // Account State
  const [name, setName] = useState(user?.name || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [theme, setTheme] = useState<'light' | 'dark'>(user?.preferences?.theme || 'light');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Help AI State
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Charge Rule State
  const [newRule, setNewRule] = useState<Partial<ChargeRule>>({
      name: '',
      type: 'percent',
      value: 0,
      isDiscount: false,
      trigger: 'always',
      threshold: 0,
      enabled: true
  });

  // Sync state if user context updates from outside
  useEffect(() => {
    if (user) {
        setName(user.name);
        setUpiId(user.upiId || '');
        setTheme(user.preferences?.theme || 'light');
    }
  }, [user]);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');

    setTimeout(() => {
        updateUser({
            name,
            upiId,
            preferences: { ...user?.preferences, theme }
        });
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    }, 500);
  };

  const handleAddRule = () => {
      if (!newRule.name || newRule.value === undefined) return;
      addChargeRule({
          id: crypto.randomUUID(),
          name: newRule.name,
          type: newRule.type as 'percent' | 'fixed',
          value: Number(newRule.value),
          isDiscount: newRule.isDiscount || false,
          trigger: newRule.trigger as any,
          threshold: Number(newRule.threshold),
          enabled: true
      });
      setNewRule({ name: '', type: 'percent', value: 0, isDiscount: false, trigger: 'always', threshold: 0, enabled: true });
  };

  const handleExport = () => {
    const backup = {
        user,
        products,
        customers,
        transactions,
        categories,
        tags,
        chargeRules,
        timestamp: new Date().toISOString(),
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if (window.confirm("This will overwrite your current shop data with the backup file. Are you sure?")) {
                importData(json);
                alert("Data restored successfully!");
                onClose();
            }
        } catch (err) {
            alert("Failed to parse backup file.");
        }
    };
    reader.readAsText(file);
  };

  const handleAiAsk = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiQuery.trim()) return;
      
      setLoadingAi(true);
      const answer = await askAppHelp(aiQuery);
      setAiResponse(answer);
      setLoadingAi(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                <div className="flex space-x-4 overflow-x-auto no-scrollbar">
                     <button 
                        onClick={() => setActiveTab('account')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'account' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Account
                     </button>
                     <button 
                        onClick={() => setActiveTab('charges')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'charges' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Taxes
                     </button>
                     <button 
                        onClick={() => setActiveTab('data')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'data' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Backup
                     </button>
                     <button 
                        onClick={() => setActiveTab('help')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'help' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Help & Support
                     </button>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <Icons.X />
                </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
                {activeTab === 'account' && (
                    <form onSubmit={handleSaveAccount} className="space-y-6">
                        {/* Profile Section */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Shop / Merchant Name
                                </label>
                                <input 
                                    type="text" 
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    placeholder="Enter your name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Email Address (Read Only)
                                </label>
                                <input 
                                    type="email" 
                                    disabled
                                    value={user?.email || ''}
                                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* Payments Section */}
                        <div>
                             <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                                Default UPI ID
                            </label>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Used to generate QR codes for payments.</p>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={upiId}
                                    onChange={(e) => setUpiId(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 pl-10 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                                    placeholder="username@bank"
                                />
                                <div className="absolute left-3 top-3.5 text-slate-400">
                                   <Icons.QRCode />
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* Preferences Section */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                Appearance
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setTheme('light')}
                                    className={`p-3 rounded-lg border-2 flex items-center justify-center space-x-2 transition-all ${
                                        theme === 'light' 
                                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <span>Light Mode</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme('dark')}
                                    className={`p-3 rounded-lg border-2 flex items-center justify-center space-x-2 transition-all ${
                                        theme === 'dark' 
                                        ? 'border-blue-500 bg-slate-800 text-white' 
                                        : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                                    }`}
                                >
                                    <span>Dark Mode</span>
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button 
                                type="submit" 
                                disabled={status === 'saving'}
                                className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center space-x-2 ${
                                    status === 'saved' 
                                    ? 'bg-green-600 hover:bg-green-700' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                                } disabled:opacity-70`}
                            >
                                {status === 'saving' ? 'Saving...' : status === 'saved' ? 'Settings Saved!' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'charges' && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-3">Add New Rule</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input 
                                    type="text" placeholder="Name (e.g. VAT, Service Fee)"
                                    className="col-span-2 border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                    value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})}
                                />
                                <select 
                                    className="border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                    value={newRule.isDiscount ? 'discount' : 'fee'}
                                    onChange={e => setNewRule({...newRule, isDiscount: e.target.value === 'discount'})}
                                >
                                    <option value="fee">Extra Fee (+)</option>
                                    <option value="discount">Discount (-)</option>
                                </select>
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="number" placeholder="Val"
                                        className="w-20 border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                        value={newRule.value} onChange={e => setNewRule({...newRule, value: Number(e.target.value)})}
                                    />
                                    <select 
                                        className="flex-1 border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                        value={newRule.type}
                                        onChange={e => setNewRule({...newRule, type: e.target.value as any})}
                                    >
                                        <option value="percent">%</option>
                                        <option value="fixed">₹</option>
                                    </select>
                                </div>
                                <select 
                                    className="col-span-2 border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                    value={newRule.trigger}
                                    onChange={e => setNewRule({...newRule, trigger: e.target.value as any})}
                                >
                                    <option value="always">Always Apply</option>
                                    <option value="amount_threshold">Apply if Order Total &gt; X</option>
                                    <option value="customer_assigned">Apply if Customer Selected</option>
                                </select>
                                {newRule.trigger === 'amount_threshold' && (
                                     <input 
                                        type="number" placeholder="Threshold Amount"
                                        className="col-span-2 border border-slate-300 dark:border-slate-600 rounded p-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                        value={newRule.threshold} onChange={e => setNewRule({...newRule, threshold: Number(e.target.value)})}
                                    />
                                )}
                            </div>
                            <button onClick={handleAddRule} className="w-full py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700">Add Rule</button>
                        </div>

                        <div className="space-y-3">
                            {chargeRules.length === 0 && <p className="text-center text-slate-400 text-sm">No custom charges configured.</p>}
                            {chargeRules.map(rule => (
                                <div key={rule.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800/50">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rule.isDiscount ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {rule.isDiscount ? 'DISC' : 'FEE'}
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-white text-sm">{rule.name}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            {rule.value}{rule.type === 'percent' ? '%' : ' Fixed'} • {rule.trigger === 'always' ? 'Always' : rule.trigger === 'customer_assigned' ? 'Customer Selected' : `Over ₹${rule.threshold}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button 
                                            onClick={() => updateChargeRule({ ...rule, enabled: !rule.enabled })}
                                            className={`text-xs font-bold px-2 py-1 rounded ${rule.enabled ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}
                                        >
                                            {rule.enabled ? 'ON' : 'OFF'}
                                        </button>
                                        <button onClick={() => deleteChargeRule(rule.id)} className="text-slate-400 hover:text-red-500">
                                            <Icons.Trash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-6">
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                             <h3 className="font-bold text-blue-800 dark:text-blue-300 text-lg mb-2">Automatic Saving</h3>
                             <p className="text-sm text-blue-700 dark:text-blue-200">
                                 Nexus POS saves your data automatically to this browser's database every time you make a change.
                                 <br/><br/>
                                 <strong>Important:</strong> If you clear your browser history or use a different device, you will need a backup file to restore your data.
                             </p>
                         </div>

                         <div className="space-y-4">
                             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                 <div>
                                     <h4 className="font-bold text-slate-800 dark:text-white">Export Backup</h4>
                                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Download a copy of all your products, sales, and customers.</p>
                                 </div>
                                 <button 
                                    onClick={handleExport}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-bold flex items-center gap-2 transition-colors text-slate-700 dark:text-slate-200"
                                 >
                                    <Icons.Download /> Download
                                 </button>
                             </div>

                             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                 <div>
                                     <h4 className="font-bold text-slate-800 dark:text-white">Import Data</h4>
                                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Restore your shop from a previous backup file.</p>
                                 </div>
                                 <label className="cursor-pointer px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 transition-colors">
                                    <Icons.Upload /> Restore
                                    <input 
                                        type="file" 
                                        accept=".json" 
                                        className="hidden" 
                                        onChange={handleImportFile}
                                    />
                                 </label>
                             </div>
                         </div>
                    </div>
                )}

                {activeTab === 'help' && (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-4 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                                <Icons.Sparkles /> AI Assistant
                            </h3>
                            <p className="text-indigo-100 text-xs mb-4">
                                Ask me anything about using Nexus POS.
                            </p>
                            
                            <form onSubmit={handleAiAsk} className="relative mb-3">
                                <input 
                                    type="text" 
                                    placeholder="e.g., How do I add a 5% GST?"
                                    className="w-full py-2 pl-4 pr-10 rounded-lg text-slate-800 outline-none text-sm"
                                    value={aiQuery}
                                    onChange={(e) => setAiQuery(e.target.value)}
                                />
                                <button 
                                  type="submit"
                                  disabled={loadingAi || !aiQuery.trim()} 
                                  className="absolute right-1 top-1 p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                   {loadingAi ? <span className="animate-spin block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : '→'}
                                </button>
                            </form>
                            
                            {aiResponse && (
                                <div className="bg-white/10 rounded p-3 text-xs leading-relaxed animate-fade-in border border-white/20">
                                    {aiResponse}
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3 text-sm uppercase tracking-wide">Quick Guides</h4>
                            <HelpSection title="Managing Inventory">
                                <p><strong>Adding Products:</strong> Go to Inventory and click "Add Product".</p>
                                <p><strong>Variants:</strong> Products with the exact same name are grouped as variants (e.g. 500ml, 1L).</p>
                                <p><strong>Scanning:</strong> Use "Scan Invoice" to upload bills and auto-add items.</p>
                            </HelpSection>
                            <HelpSection title="Customers & Credit">
                                <p><strong>Profiles:</strong> Create customer profiles to track purchase history.</p>
                                <p><strong>Debt:</strong> Select a customer during checkout and choose "Store Credit" to add to their balance.</p>
                            </HelpSection>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};