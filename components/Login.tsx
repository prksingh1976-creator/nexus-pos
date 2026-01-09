import React, { useState, useEffect } from 'react';
import { useShop } from '../contexts/ShopContext';
import { APP_NAME, Icons, isMobile } from '../constants';
import { User } from '../types';

export const Login: React.FC = () => {
  const { login, enableCloud, loginCloud, isCloudEnabled, connectLocalFolder, isLocalSyncEnabled } = useShop();
  
  // Wizard State
  const [step, setStep] = useState<1 | 2>(1);
  const [detectedAccounts, setDetectedAccounts] = useState<User[]>([]);
  
  // Form State
  const [email, setEmail] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [error, setError] = useState('');

  // Pending User (Passed to Step 2)
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Cloud Form
  const [useCloud, setUseCloud] = useState(false);
  const [firebaseConfigStr, setFirebaseConfigStr] = useState('');
  const [configError, setConfigError] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);

  // 1. Detect Local Accounts on Mount
  useEffect(() => {
    const accs: User[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('nexus_pos_') && key?.endsWith('_profile')) {
            try {
                const u = JSON.parse(localStorage.getItem(key) || '{}');
                if (u.id && u.name) accs.push(u);
            } catch (e) {}
        }
    }
    setDetectedAccounts(accs);
  }, []);

  // 2. Handle Email Input Logic
  const handleEmailBlur = () => {
      if (!email) return;
      const userId = btoa(email.trim().toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      
      // Check if we have this user in our detected list (or check localstorage directly)
      const existingStr = localStorage.getItem(`nexus_pos_${userId}_profile`);
      
      if (existingStr) {
          const existing = JSON.parse(existingStr);
          setIsNewAccount(false);
          setShopName(existing.name);
          // Auto-select if not selected
      } else {
          setIsNewAccount(true);
          setShopName('');
      }
  };

  const selectAccount = (u: User) => {
      setEmail(u.email);
      setShopName(u.name);
      setIsNewAccount(false);
      setError('');
  };

  const handleStep1Submit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!email) {
          setError("Email/ID is required.");
          return;
      }
      
      if (isNewAccount && (!shopName || !ownerName)) {
           setError("Shop Name and Owner Name are required for new accounts.");
           return;
      }

      const userId = btoa(email.trim().toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

      // Construct User Object
      // Check for existing one last time to preserve preferences
      const existingStr = localStorage.getItem(`nexus_pos_${userId}_profile`);
      let userObj: User;

      if (existingStr) {
          userObj = JSON.parse(existingStr);
      } else {
          userObj = {
              id: userId,
              name: shopName,
              email: email.trim(),
              avatarUrl: '',
              preferences: { 
                  theme: 'system', 
                  autoShowReceipt: true, 
                  enableFaceRecognition: false,
                  masterSmsEnabled: false
              }
          };
      }

      setPendingUser(userObj);
      setStep(2);
  };

  const handleCloudConnect = async () => {
      setConfigError('');
      setCloudLoading(true);
      try {
          const cleanStr = firebaseConfigStr.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
          const config = JSON.parse(cleanStr);
          const success = await enableCloud(config);
          if (success) {
              await loginCloud();
          } else {
              setConfigError("Failed to initialize Firebase.");
          }
      } catch (e) {
          setConfigError("Invalid JSON Configuration.");
      }
      setCloudLoading(false);
  };

  const handleLaunch = () => {
      if (pendingUser) {
          login(pendingUser);
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 dark:bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-600/10 dark:bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md relative z-10 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden transition-all duration-500">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/30 mx-auto mb-3">
                N
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{APP_NAME}</h1>
            <div className="flex justify-center gap-2 mt-4">
                <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-300 dark:bg-slate-600'}`}></div>
            </div>
        </div>

        <div className="p-6">
            {step === 1 && (
                <div className="animate-fade-in space-y-6">
                    {/* Detected Accounts */}
                    {detectedAccounts.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detected Accounts</p>
                            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                                {detectedAccounts.map(acc => (
                                    <button
                                        key={acc.id}
                                        onClick={() => selectAccount(acc)}
                                        className={`flex items-center p-3 rounded-xl border transition-all ${email === acc.email ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 mr-3">
                                            {acc.name.charAt(0)}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{acc.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{acc.email}</p>
                                        </div>
                                        {email === acc.email && <span className="text-blue-600 font-bold text-lg">✓</span>}
                                    </button>
                                ))}
                            </div>
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                                <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-800 px-2 text-xs text-slate-400">Or use another</span></div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleStep1Submit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email / ID</label>
                            <input 
                                type="email" required
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                                placeholder="name@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onBlur={handleEmailBlur}
                            />
                        </div>

                        {isNewAccount && (
                             <div className="space-y-4 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Shop Name</label>
                                    <input 
                                        type="text" required
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="e.g. Fresh Mart"
                                        value={shopName}
                                        onChange={e => setShopName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Owner Name</label>
                                    <input 
                                        type="text" required
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all"
                                        placeholder="Your Name"
                                        value={ownerName}
                                        onChange={e => setOwnerName(e.target.value)}
                                    />
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs rounded-lg">
                                    Creating a new local account for this device.
                                </div>
                             </div>
                        )}

                        {error && <p className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}

                        <button 
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                        >
                            Next Step &rarr;
                        </button>
                    </form>
                </div>
            )}

            {step === 2 && pendingUser && (
                <div className="animate-fade-in space-y-6">
                    <div className="text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Welcome,</p>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{pendingUser.name}</h2>
                    </div>

                    <div className="space-y-4">
                        {/* 1. Local Folder Sync (Desktop Only) */}
                        {!isMobile && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                                        <Icons.Upload /> Local Folder Sync
                                    </h3>
                                    {isLocalSyncEnabled && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">Connected</span>}
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                        Automatically save all your data to a folder on this computer for backup.
                                    </p>
                                    {isLocalSyncEnabled ? (
                                        <div className="w-full py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm font-bold text-center border border-green-200 dark:border-green-800">
                                            ✓ Folder Connected
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={connectLocalFolder}
                                            className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Select Folder
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 2. Cloud Sync */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <button 
                                onClick={() => setUseCloud(!useCloud)}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center"
                            >
                                <h3 className="font-bold text-sm text-slate-700 dark:text-white flex items-center gap-2">
                                    <div className="text-blue-500"><Icons.Sparkles /></div> Cloud Sync (Optional)
                                </h3>
                                <Icons.ChevronDown />
                            </button>
                            
                            {useCloud && (
                                <div className="p-4 bg-white dark:bg-slate-800 animate-fade-in">
                                    {isCloudEnabled ? (
                                        <div className="text-center">
                                            <p className="text-green-600 font-bold text-sm mb-2">Cloud Configured!</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-slate-500">Paste Firebase Config JSON to sync across devices.</p>
                                            <textarea 
                                                className="w-full h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-[10px] font-mono"
                                                placeholder='{ "apiKey": "..." }'
                                                value={firebaseConfigStr}
                                                onChange={e => setFirebaseConfigStr(e.target.value)}
                                            />
                                            {configError && <p className="text-red-500 text-xs">{configError}</p>}
                                            <button 
                                                onClick={handleCloudConnect}
                                                disabled={!firebaseConfigStr || cloudLoading}
                                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold"
                                            >
                                                {cloudLoading ? 'Connecting...' : 'Connect Cloud'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button 
                            onClick={() => setStep(1)}
                            className="px-4 py-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold text-sm"
                        >
                            Back
                        </button>
                        <button 
                            onClick={handleLaunch}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                        >
                            Enter Shop
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};