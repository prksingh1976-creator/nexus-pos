import React, { useState, useEffect } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Icons, isMobile } from '../constants';
import { ChargeRule, SmsTemplate } from '../types';
import { askAppHelp } from '../services/geminiService';
import { loadFaceModels } from '../services/faceRecService';

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
  const { 
    user, updateUser, deleteAccount, 
    chargeRules, addChargeRule, updateChargeRule, deleteChargeRule, 
    products, customers, transactions, categories, tags, 
    importData, connectLocalFolder, isLocalSyncEnabled 
  } = useShop();
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'account' | 'charges' | 'sms' | 'data' | 'help'>('account');

  // Account State
  const [name, setName] = useState(user?.name || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');
  const [theme, setTheme] = useState<'light' | 'dark'>(user?.preferences?.theme || 'light');
  const [autoShowReceipt, setAutoShowReceipt] = useState(user?.preferences?.autoShowReceipt ?? true);
  const [enableFaceRec, setEnableFaceRec] = useState(user?.preferences?.enableFaceRecognition ?? false);
  const [camPreviewSize, setCamPreviewSize] = useState<'small' | 'medium' | 'large'>(user?.preferences?.camPreviewSize || 'small');
  const [showCamPreview, setShowCamPreview] = useState(user?.preferences?.showCamPreview ?? true);
  
  // SMS Settings
  const [masterSmsEnabled, setMasterSmsEnabled] = useState(user?.preferences?.masterSmsEnabled ?? false);
  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>(user?.preferences?.smsTemplates || []);
  
  const [newTemplate, setNewTemplate] = useState<{name: string, content: string}>({ name: '', content: '' });

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

  // Local Sync UI
  const [syncStatus, setSyncStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Sync state if user context updates from outside
  useEffect(() => {
    if (user) {
        setName(user.name);
        setUpiId(user.upiId || '');
        setTheme(user.preferences?.theme || 'light');
        setAutoShowReceipt(user.preferences?.autoShowReceipt ?? true);
        setEnableFaceRec(user.preferences?.enableFaceRecognition ?? false);
        setCamPreviewSize(user.preferences?.camPreviewSize || 'small');
        setShowCamPreview(user.preferences?.showCamPreview ?? true);
        setMasterSmsEnabled(user.preferences?.masterSmsEnabled ?? false);
        setSmsTemplates(user.preferences?.smsTemplates || []);
    }
  }, [user]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');

    // If enabling face rec, try loading models first
    if (enableFaceRec) {
        await loadFaceModels();
    }

    setTimeout(() => {
        updateUser({
            name,
            upiId,
            preferences: { 
                ...user?.preferences, 
                theme,
                autoShowReceipt,
                enableFaceRecognition: enableFaceRec,
                camPreviewSize,
                showCamPreview,
                masterSmsEnabled,
                smsTemplates,
            }
        });
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    }, 500);
  };
  
  const handleDeleteAccount = async () => {
    if (window.confirm("Are you sure you want to delete your account? This will permanently remove all your data.")) {
        if (window.confirm("This action cannot be undone. All inventory, sales history, and customer data will be lost immediately. Confirm deletion?")) {
            await deleteAccount();
            onClose();
        }
    }
  };

  const handleAddTemplate = () => {
      if (!newTemplate.name || !newTemplate.content) return;
      const tpl: SmsTemplate = {
          id: crypto.randomUUID(),
          name: newTemplate.name,
          content: newTemplate.content,
          isDefault: smsTemplates.length === 0 // First one is default
      };
      setSmsTemplates([...smsTemplates, tpl]);
      setNewTemplate({ name: '', content: '' });
  };

  const deleteTemplate = (id: string) => {
      setSmsTemplates(smsTemplates.filter(t => t.id !== id));
  };

  const setAsDefault = (id: string) => {
      setSmsTemplates(smsTemplates.map(t => ({ ...t, isDefault: t.id === id })));
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
    a.download = `${user?.name.replace(/[^a-z0-9]/gi, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
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

  const handleLocalConnect = async () => {
      setSyncStatus('connecting');
      const success = await connectLocalFolder();
      if (success) setSyncStatus('connected');
      else setSyncStatus('error');
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
                        onClick={() => setActiveTab('sms')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'sms' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        SMS Alerts
                     </button>
                     <button 
                        onClick={() => setActiveTab('data')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'data' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Backup & Sync
                     </button>
                     <button 
                        onClick={() => setActiveTab('help')}
                        className={`text-sm font-bold pb-1 whitespace-nowrap ${activeTab === 'help' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                     >
                        Help
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
                                Preferences
                            </label>
                            
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">Auto Show Receipt</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Show receipt popup after every sale.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={autoShowReceipt} 
                                        onChange={(e) => setAutoShowReceipt(e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-4 p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">Face Recognition</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Auto-select customers in POS using camera.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={enableFaceRec} 
                                            onChange={(e) => setEnableFaceRec(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                
                                {enableFaceRec && (
                                    <div className="pl-2 border-l-2 border-blue-500/20 space-y-3 pt-1 animate-fade-in">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Show Camera Feed</p>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={showCamPreview} 
                                                    onChange={(e) => setShowCamPreview(e.target.checked)} 
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-9 h-5 bg-slate-200 rounded-full peer dark:bg-slate-600 peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                                            </label>
                                        </div>
                                        {showCamPreview && (
                                            <div>
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Camera Size</p>
                                                <div className="flex gap-2">
                                                    {(['small', 'medium', 'large'] as const).map(size => (
                                                        <button 
                                                            key={size}
                                                            type="button"
                                                            onClick={() => setCamPreviewSize(size)}
                                                            className={`px-3 py-1.5 rounded text-xs capitalize border transition-all ${
                                                                camPreviewSize === size 
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-slate-400'
                                                            }`}
                                                        >
                                                            {size}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

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
                        
                        {/* Danger Zone */}
                        <div className="mt-8 pt-6 border-t border-red-100 dark:border-red-900/30">
                            <h3 className="text-red-600 dark:text-red-400 font-bold text-sm uppercase mb-2">Danger Zone</h3>
                            <p className="text-xs text-slate-500 mb-4">Deleting your account is irreversible. All data (sales, customers, inventory) will be permanently removed.</p>
                            <button 
                                type="button"
                                onClick={handleDeleteAccount}
                                className="w-full py-3 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold rounded-xl border border-red-200 dark:border-red-800 transition-colors"
                            >
                                Delete Account & Data
                            </button>
                        </div>
                    </form>
                )}

                {activeTab === 'sms' && (
                    <div className="space-y-6">
                        {/* Master Toggle */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white">Master SMS Switch</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Enable/Disable SMS alerts globally for the shop.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={masterSmsEnabled} 
                                    onChange={(e) => {
                                        setMasterSmsEnabled(e.target.checked);
                                        // Auto-save setting change immediately for UX
                                        updateUser({ preferences: { ...user?.preferences, masterSmsEnabled: e.target.checked }});
                                    }} 
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Native SMS Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-2">
                                <Icons.Sparkles /> Native SMS
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-200">
                                Nexus POS uses your device's default Messaging App to send alerts directly from your SIM card. 
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-2 font-medium">
                                No external gateway configuration required. Standard SMS charges may apply.
                            </p>
                        </div>

                        {/* Template Creator */}
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <h3 className="font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2 mb-2">Create New Template</h3>
                            <input 
                                type="text" 
                                placeholder="Template Name (e.g., Default Credit Alert)"
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                value={newTemplate.name}
                                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                            />
                            <textarea
                                placeholder={`<shopname>
Dear <customername>, your purchase of <latestcreditamount> was credited...`}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono h-32"
                                value={newTemplate.content}
                                onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                            />
                            
                            {/* Variable Guide */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-[10px] text-blue-800 dark:text-blue-200 flex flex-wrap gap-2">
                                <span className="font-bold">Variables:</span>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;shopname&gt;</code>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;customername&gt;</code>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;latestcreditamount&gt;</code>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;totalcreditamount&gt;</code>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;latestcredititems&gt;</code>
                                <code className="bg-white dark:bg-slate-800 px-1 rounded">&lt;date&gt;</code>
                            </div>

                            <button 
                                onClick={() => {
                                    handleAddTemplate();
                                    updateUser({ preferences: { ...user?.preferences, smsTemplates: [...smsTemplates, {
                                        id: crypto.randomUUID(),
                                        name: newTemplate.name,
                                        content: newTemplate.content,
                                        isDefault: smsTemplates.length === 0
                                    }] }});
                                }} 
                                disabled={!newTemplate.name || !newTemplate.content}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                                Save Template
                            </button>
                        </div>

                        {/* Existing Templates */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">Saved Templates</h3>
                            {smsTemplates.length === 0 ? (
                                <p className="text-center text-slate-400 text-sm py-4">No templates found. Create one above.</p>
                            ) : (
                                smsTemplates.map(tpl => (
                                    <div key={tpl.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                                                    {tpl.name}
                                                    {tpl.isDefault && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>}
                                                </h4>
                                            </div>
                                            <div className="flex gap-2">
                                                {!tpl.isDefault && (
                                                    <button 
                                                        onClick={() => {
                                                            const updated = smsTemplates.map(t => ({ ...t, isDefault: t.id === tpl.id }));
                                                            setSmsTemplates(updated);
                                                            updateUser({ preferences: { ...user?.preferences, smsTemplates: updated }});
                                                        }}
                                                        className="text-xs text-blue-600 hover:underline"
                                                    >
                                                        Set Default
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => {
                                                        const updated = smsTemplates.filter(t => t.id !== tpl.id);
                                                        setSmsTemplates(updated);
                                                        updateUser({ preferences: { ...user?.preferences, smsTemplates: updated }});
                                                    }}
                                                    className="text-slate-400 hover:text-red-500"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900 p-2 rounded whitespace-pre-wrap">
                                            {tpl.content}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
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
                         {/* Local Sync Section */}
                         <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <h3 className="font-bold text-purple-800 dark:text-purple-300 text-lg">Local Folder Sync</h3>
                                     <p className="text-sm text-purple-700 dark:text-purple-200">
                                        Securely save all your data to a folder on this computer.
                                     </p>
                                 </div>
                                 <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                     <Icons.Upload />
                                 </div>
                             </div>
                             
                             <div className="mt-4">
                                {isLocalSyncEnabled || syncStatus === 'connected' ? (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <span>✓ Synced to "{user?.name.replace(/[^a-z0-9]/gi, '_')}" folder</span>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleLocalConnect}
                                        disabled={syncStatus === 'connecting'}
                                        className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
                                    >
                                        {syncStatus === 'connecting' ? 'Requesting Access...' : 'Select Folder to Sync'}
                                    </button>
                                )}
                                {syncStatus === 'error' && (
                                    <p className="text-xs text-red-500 mt-2 text-center">Failed to connect. Please try again.</p>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                                    Requires a modern browser (Chrome/Edge). Files are saved instantly.
                                </p>
                             </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                             <h4 className="font-bold text-slate-800 dark:text-white">Manual Backup</h4>
                             
                             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                 <div>
                                     <h4 className="font-bold text-slate-800 dark:text-white">Export to JSON</h4>
                                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Download a single backup file.</p>
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
                                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Restore from a backup file.</p>
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
            </div>
        </div>
    </div>
  );
};