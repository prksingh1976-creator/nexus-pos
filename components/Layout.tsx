import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icons } from '../constants';
import { useShop } from '../contexts/ShopContext';
import { SettingsModal } from './SettingsModal';

export const Layout: React.FC = () => {
  const { user, logout } = useShop();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  // MOVED UP before conditional return to satisfy React Hooks rules
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  if (!user) return <Outlet />;

  const navClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 p-3 rounded-lg transition-colors mb-1 ${
      isActive
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 overflow-hidden relative transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white flex items-center justify-between px-4 z-30 shadow-md">
        <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 mr-2 text-slate-300 hover:text-white">
                <Icons.Menu />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Nexus POS
            </h1>
        </div>
        {/* Placeholder for right side balance or user icon if needed */}
        <div className="w-8"></div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:block">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Nexus POS
          </h1>
          <p className="text-xs text-slate-500 mt-1">Shop Management System</p>
        </div>

        {/* Mobile Header inside Sidebar for spacing consistency */}
        <div className="md:hidden h-16 flex items-center px-6 border-b border-slate-800 mb-2">
             <span className="font-bold text-lg">Menu</span>
             <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400"><Icons.X /></button>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto pt-2 md:pt-0">
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
          <NavLink to="/inventory" className={navClasses}>
            <Icons.Inventory />
            <span className="font-medium">Inventory</span>
          </NavLink>
          <NavLink to="/customers" className={navClasses}>
            <Icons.Users />
            <span className="font-medium">Customers</span>
          </NavLink>
        </nav>

        {/* User Profile Section - Clickable to open Settings */}
        <div className="p-4 border-t border-slate-800">
          <div 
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-3 mb-4 cursor-pointer hover:bg-slate-800 p-2 rounded-lg transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg text-white group-hover:bg-blue-400 transition-colors">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate group-hover:text-blue-300 transition-colors">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
            <div className="text-slate-500 group-hover:text-white">
                <Icons.Settings />
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-400 py-2 rounded transition-colors text-sm"
          >
            <Icons.Logout />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative mt-16 md:mt-0 w-full">
        <Outlet />
      </main>

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};