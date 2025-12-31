import React, { useState } from 'react';
import { useShop } from '../contexts/ShopContext';
import { APP_NAME, Icons } from '../constants';

export const Login: React.FC = () => {
  const { login, enableCloud, loginCloud, isCloudEnabled } = useShop();
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [useCloud, setUseCloud] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Local Form
  const [formData, setFormData] = useState({
      shopName: '',
      ownerName: '',
      email: ''
  });
  
  // Cloud Form
  const [firebaseConfigStr, setFirebaseConfigStr] = useState('');
  const [configError, setConfigError] = useState('');

  const [error, setError] = useState('');

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email) {
        setError("Email is required.");
        return;
    }

    // Create a consistent ID based on email for local storage keying
    const userId = btoa(formData.email.toLowerCase()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);

    if (isLoginMode) {
        // Login: Check if profile exists
        const storedProfile = localStorage.getItem(`nexus_pos_${userId}_profile`);
        if (storedProfile) {
            try {
                const userProfile = JSON.parse(storedProfile);
                login(userProfile);
            } catch (err) {
                setError("Error loading account data. Please try creating a new shop.");
            }
        } else {
            setError("No local account found with this email. Please switch to 'Create Shop'.");
        }
    } else {
        // Register
        if (!formData.shopName || !formData.ownerName) {
            setError("All fields are required for new shops.");
            return;
        }

        login({
            id: userId,
            name: formData.shopName,
            email: formData.email,
            avatarUrl: ''
        });
    }
  };

  const handleCloudConnect = async () => {
      setConfigError('');
      setLoading(true);
      try {
          // Allow loose JSON parsing (handling potential JS object syntax if pasted from docs)
          const cleanStr = firebaseConfigStr.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":').replace(/'/g, '"');
          const config = JSON.parse(cleanStr);
          
          const success = await enableCloud(config);
          if (success) {
              setUseCloud(true);
              // Auto trigger Google Login
              await handleGoogleLogin();
          } else {
              setConfigError("Failed to initialize Firebase. Check config.");
          }
      } catch (e) {
          setConfigError("Invalid JSON Configuration.");
      }
      setLoading(false);
  };

  const handleGoogleLogin = async () => {
      setLoading(true);
      try {
          await loginCloud();
      } catch (e) {
          setError("Google Sign-In Failed.");
      }
      setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full relative z-10 border border-slate-200 dark:border-slate-700">
        <div className="mb-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/30 mx-auto mb-4">
                N
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{APP_NAME}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                Complete shop management & POS system.
            </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
            <button 
                onClick={() => setUseCloud(false)}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${!useCloud ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Local Device
            </button>
            <button 
                onClick={() => setUseCloud(true)}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${useCloud ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Cloud Sync
            </button>
        </div>

        {useCloud ? (
             <div className="space-y-4 animate-fade-in">
                 {isCloudEnabled ? (
                     <div className="text-center space-y-4">
                         <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-3 rounded-lg text-sm mb-4">
                             Cloud Configuration Loaded
                         </div>
                         <button 
                             onClick={handleGoogleLogin}
                             disabled={loading}
                             className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-3"
                         >
                             {loading ? 'Connecting...' : (
                                 <>
                                     <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.51 19.27 5 15.68 5 12c0-4.4 4.43-8 9.17-8c2.47 0 4.28 1.03 5.19 1.44l3.1-3.1C19.78 0 16.34 0 12.22 0C4.24 0 0 6.48 0 14.88C0 23.36 5.67 24 12.22 24c7.22 0 11.78-4.82 11.78-11.4c0-.98-.1-1.5-.1-1.5z"/></svg>
                                     Sign in with Google
                                 </>
                             )}
                         </button>
                     </div>
                 ) : (
                     <div className="space-y-3">
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-800 dark:text-blue-200">
                             To sync across devices, paste your <strong>Firebase Config</strong> JSON below.
                             <br/>
                             <a href="https://firebase.google.com/docs/web/learn-more#config-object" target="_blank" rel="noreferrer" className="underline font-bold">How to get config?</a>
                         </div>
                         <textarea 
                             className="w-full h-32 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
                             placeholder='{ "apiKey": "...", "authDomain": "...", "projectId": "..." }'
                             value={firebaseConfigStr}
                             onChange={(e) => setFirebaseConfigStr(e.target.value)}
                         />
                         {configError && <p className="text-red-500 text-xs">{configError}</p>}
                         <button 
                             onClick={handleCloudConnect}
                             disabled={!firebaseConfigStr || loading}
                             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                         >
                             {loading ? 'Connecting...' : 'Connect to Cloud'}
                         </button>
                     </div>
                 )}
                 {error && <p className="text-red-500 text-center text-sm">{error}</p>}
             </div>
        ) : (
            <div className="space-y-4 animate-fade-in">
                {/* Toggle Switch */}
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl mb-6">
                    <button 
                        type="button"
                        onClick={() => { setIsLoginMode(false); setError(''); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Create Shop
                    </button>
                    <button 
                        type="button"
                        onClick={() => { setIsLoginMode(true); setError(''); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Existing Login
                    </button>
                </div>

                <form onSubmit={handleLocalSubmit} className="space-y-4">
                    
                    {!isLoginMode && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Shop Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                                    placeholder="e.g. Fresh Mart"
                                    value={formData.shopName}
                                    onChange={e => setFormData({...formData, shopName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Owner Name</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                                    placeholder="Your Name"
                                    value={formData.ownerName}
                                    onChange={e => setFormData({...formData, ownerName: e.target.value})}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email (Account ID)</label>
                        <input 
                            type="email" required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg text-sm font-medium text-center animate-fade-in">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] mt-4"
                    >
                        {isLoginMode ? 'Resume Session' : 'Launch Shop'}
                    </button>
                </form>
            </div>
        )}

        <div className="mt-6 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
                {useCloud ? 'Data is synced with your Google Account.' : 'Data stored locally on this device.'}
            </p>
        </div>
      </div>
    </div>
  );
};