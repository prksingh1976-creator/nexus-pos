import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ShopProvider, useShop } from './contexts/ShopContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { POS } from './components/POS';
import { Customers } from './components/Customers';
import { Orders } from './components/Orders';
import { Login } from './components/Login';
import { LoadingScreen } from './components/LoadingScreen';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useShop();
  
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
};

// Login Route Wrapper
const LoginRoute: React.FC = () => {
    const { user, isLoading } = useShop();
    
    if (isLoading) return <LoadingScreen />;
    if (user) return <Navigate to="/" replace />;
    
    return <Login />;
}

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<Layout />}>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ShopProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </ShopProvider>
  );
};

export default App;