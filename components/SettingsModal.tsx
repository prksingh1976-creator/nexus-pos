
import React, { useState, useEffect } from 'react';
import { useShop } from '../contexts/ShopContext';
import { Icons } from '../constants';
import { ChargeRule, SmsTemplate } from '../types';
import { askAppHelp } from '../services/geminiService';
import { loadFaceModels } from '../services/faceRecService';
import { api } from '../services/api';

interface SettingsModalProps {
  onClose: () => void;
}

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
  const [apiServerUrl, setApiServerUrl] = useState(user?.preferences?.apiServerUrl || '');
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
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');

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
        setApiServerUrl(user.preferences?.apiServerUrl || '');
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
                apiServerUrl,
            }
        });
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    }, 500);
  };

  const testServerConnection = async () => {
      if (!apiServerUrl) return;
      setConnStatus('testing');
      const isOnline = await api.testConnection(apiServerUrl);
      setConnStatus(isOnline ? 'online' : 'offline');
      // Status remains visible until user changes url or clicks again
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
          isDefault: smsTemplates.length === 0 
      };
      setSmsTemplates([...smsTemplates, tpl]);
      setNewTemplate({ name: '', content: '' });
  };

  const deleteTemplate = (id: string) => {
    setSmsTemplates(prev => prev.filter(t => t.id !== id));
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

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                                <label className="block text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                                    Hybrid PC-Sync Server URL
                                </label>
                                <p className="text-[10px] text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">Sync with your PC via Ngrok HTTPS</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="url" 
                                        value={apiServerUrl}
                                        onChange={(e) => setApiServerUrl(e.target.value)}
                                        className="flex-1 border border-blue-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors text-sm"
                                        placeholder="https://xxxx-xxxx.ngrok-free.app"
                                    />
                                    <button 
                                        type="button"
                                        onClick={testServerConnection}
                                        className={`px-4 rounded-lg font-bold text-xs transition-all ${
                                            connStatus === 'online' ? 'bg-green-600 text-white shadow-md' : 
                                            connStatus === 'offline' ? 'bg-red-600 text-white shadow-md' : 
                                            'bg-white text-slate-600 border border-slate-200'
                                        }`}
                                    >
                                        {connStatus === 'testing' ? '...' : connStatus === 'online' ? 'Online' : connStatus === 'offline' ? 'Offline' : 'Test'}
                                    </button>
                                </div>
                                {apiServerUrl && apiServerUrl.startsWith('http:') && (
                                    <p className="text-[10px] text-red-500 mt-2 font-bold flex items-center gap-1">
                                        ⚠️ HTTPS required for GitHub Pages. Use Ngrok's HTTPS link.
                                    </p>
                                )}
                            </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

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

                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                                UI Preferences
                            </label>
                            
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-3">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">Auto Show Receipt</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Show receipt popup after sale.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={autoShowReceipt} 
                                        onChange={(e) => setAutoShowReceipt(e.target.checked)} 
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 mb-4 p-3">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">Face Recognition</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Auto-detect customers at POS.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={enableFaceRec} 
                                            onChange={(e) => setEnableFaceRec(e.target.checked)} 
                                            className="sr-only peer" 
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
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
                    </form>
                )}
                {activeTab === 'help' && (
                    <div className="space-y-4">
                        <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-xl">
                            <h3 className="text-lg font-bold mb-2">Nexus AI Support</h3>
                            <p className="text-indigo-100 text-xs mb-4">I can help with GitHub Pages, Ngrok setup, and PC-Sync issues.</p>
                            <form onSubmit={handleAiAsk} className="relative">
                                <input 
                                    type="text" 
                                    placeholder="Ask me anything..." 
                                    className="w-full p-3 rounded-lg text-slate-800 outline-none"
                                    value={aiQuery}
                                    onChange={e => setAiQuery(e.target.value)}
                                />
                                <button type="submit" className="absolute right-2 top-2 p-1.5 bg-indigo-600 text-white rounded">
                                    <Icons.Sparkles />
                                </button>
                            </form>
                        </div>
                        {aiResponse && (
                            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl animate-fade-in">
                                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{aiResponse}</p>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'data' && (
                     <div className="space-y-6">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800">
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <h3 className="font-bold text-purple-800 dark:text-purple-300 text-lg">Local Folder Sync</h3>
                                     <p className="text-sm text-purple-700 dark:text-purple-200">
                                        Secondary backup to a local folder in your browser.
                                     </p>
                                 </div>
                                 <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                     <Icons.Upload />
                                 </div>
                             </div>
                             
                             <div className="mt-4">
                                {isLocalSyncEnabled || syncStatus === 'connected' ? (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                        <span>✓ Folder Connected</span>
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
                             </div>
                         </div>
                         <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                 <div>
                                     <h4 className="font-bold text-slate-800 dark:text-white">Export to JSON</h4>
                                 </div>
                                 <button onClick={handleExport} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg font-bold flex items-center gap-2 text-sm">
                                    <Icons.Download /> Export
                                 </button>
                             </div>
                             <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                 <div>
                                     <h4 className="font-bold text-slate-800 dark:text-white">Import Data</h4>
                                 </div>
                                 <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2 text-sm">
                                    <Icons.Upload /> Import
                                    <input type="file" accept=".json" className="hidden" onChange={handleImportFile} />
                                 </label>
                             </div>
                         </div>
                    </div>
                )}
                {activeTab === 'charges' && (
                    <div className="space-y-4">
                        {chargeRules.map(rule => (
                            <div key={rule.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{rule.name}</p>
                                    <p className="text-xs text-slate-500">{rule.value}{rule.type === 'percent' ? '%' : ' Fixed'}</p>
                                </div>
                                <button onClick={() => deleteChargeRule(rule.id)} className="text-red-500"><Icons.Trash /></button>
                            </div>
                        ))}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-xs font-bold mb-2">New Tax/Fee</p>
                            <input 
                                className="w-full mb-2 p-2 rounded text-xs border bg-white dark:bg-slate-800" 
                                placeholder="Rule Name" 
                                value={newRule.name} 
                                onChange={e => setNewRule({...newRule, name: e.target.value})}
                            />
                            <button onClick={handleAddRule} className="w-full bg-blue-600 text-white py-1.5 rounded text-xs font-bold">Add Rule</button>
                        </div>
                    </div>
                )}
                 {activeTab === 'sms' && (
                    <div className="space-y-4">
                        {smsTemplates.map(tpl => (
                            <div key={tpl.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{tpl.name}</p>
                                    <p className="text-[10px] text-slate-500 line-clamp-1">{tpl.content}</p>
                                </div>
                                <button onClick={() => deleteTemplate(tpl.id)} className="text-red-500"><Icons.Trash /></button>
                            </div>
                        ))}
                        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                            <p className="text-xs font-bold mb-2">New SMS Template</p>
                            <input 
                                className="w-full mb-2 p-2 rounded text-xs border bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-blue-500" 
                                placeholder="Template Name" 
                                value={newTemplate.name} 
                                onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                            />
                            <textarea 
                                className="w-full mb-2 p-2 rounded text-xs border bg-white dark:bg-slate-800 outline-none focus:ring-1 focus:ring-blue-500" 
                                placeholder="Message Content (use <customername>, <totalcreditamount>, <shopname>)" 
                                value={newTemplate.content} 
                                onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                                rows={3}
                            />
                            <button onClick={handleAddTemplate} className="w-full bg-blue-600 text-white py-1.5 rounded text-xs font-bold transition-transform active:scale-95 shadow-md shadow-blue-500/20">Add Template</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
