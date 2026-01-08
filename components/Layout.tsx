import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icons } from '../constants';
import { useShop } from '../contexts/ShopContext';
import { SettingsModal } from './SettingsModal';

export const Layout: React.FC = () => {
  const { user, logout } = useShop();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!user) return <Outlet />;

  const navClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-2.5 p-2.5 rounded-lg transition-all duration-200 mb-1 text-sm ${
      isActive
        ? 'bg-blue-50 dark:bg-blue-600 text-blue-700 dark:text-white shadow-sm translate-x-1 font-bold'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:translate-x-1 font-medium'
    }`;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative transition-colors duration-300 font-sans">
      {/* Mobile Header with Glassmorphism */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-800 dark:text-white flex items-center justify-between px-4 z-30 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="p-2 -ml-2 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg active:scale-95 transition-transform"
            >
                <Icons.Menu />
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                Nexus POS
            </h1>
        </div>
        <div 
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md cursor-pointer"
        >
            {user.name.charAt(0)}
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 text-slate-800 dark:text-white flex flex-col transition-transform duration-300 ease-out md:relative md:translate-x-0 shadow-2xl md:shadow-none border-r border-slate-200 dark:border-slate-800
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:block">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-white font-bold text-sm">N</div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Nexus POS
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pl-10 uppercase tracking-wide">Shop Manager</p>
        </div>

        {/* Mobile Sidebar Header */}
        <div className="md:hidden h-16 flex items-center px-6 mb-2 border-b border-slate-100 dark:border-slate-800">
             <span className="font-bold text-lg text-slate-800 dark:text-white">Menu</span>
             <button onClick={() => setSidebarOpen(false)} className="ml-auto p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg"><Icons.X /></button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto py-4">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Apps</p>
          <NavLink to="/" className={navClasses}>
            <Icons.Dashboard />
            <span className="font-medium">Dashboard</span>
          </NavLink>
          <NavLink to="/pos" className={navClasses}>
            <Icons.Cart />
            <span className="font-medium">Point of Sale</span>
          </NavLink>
          <NavLink to="/orders" className={navClasses}>
            <Icons.Orders />
            <span className="font-medium">Orders</span>
          </NavLink>
          
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Management</p>
          <NavLink to="/inventory" className={navClasses}>
            <Icons.Inventory />
            <span className="font-medium">Inventory</span>
          </NavLink>
          <NavLink to="/customers" className={navClasses}>
            <Icons.Users />
            <span className="font-medium">Customers</span>
          </NavLink>
          
          {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="w-full mt-6 flex items-center space-x-2.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-colors text-sm font-bold"
              >
                  <Icons.Download />
                  <span>Install App</span>
              </button>
          )}
        </nav>

        {/* User Profile Section */}
        <div className="p-3 m-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div 
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-2.5 mb-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 p-2 rounded-lg transition-all group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm text-white shadow-lg">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">Settings</p>
            </div>
            <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-colors scale-90">
                <Icons.Settings />
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 text-slate-500 dark:text-slate-400 py-2 rounded-lg transition-all text-xs font-medium border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-500/30"
          >
            <Icons.Logout />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto relative mt-14 md:mt-0 w-full scroll-smooth">
        <Outlet />
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};