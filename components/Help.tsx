import React, { useState } from 'react';
import { Icons } from '../constants';
import { askAppHelp } from '../services/geminiService';

const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
        </div>
        <div className="p-4 text-slate-600 dark:text-slate-300 text-sm space-y-3 leading-relaxed">
            {children}
        </div>
    </div>
);

export const Help: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'guide' | 'ai'>('guide');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAiAsk = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiQuery.trim()) return;
      
      setLoading(true);
      const answer = await askAppHelp(aiQuery);
      setAiResponse(answer);
      setLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-full flex flex-col">
      <header className="mb-6">
         <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Help & Support</h2>
         <p className="text-slate-500 dark:text-slate-400">Master Nexus POS with guides or ask our AI assistant.</p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button 
            onClick={() => setActiveTab('guide')}
            className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === 'guide' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              User Guide
              {activeTab === 'guide' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`pb-3 px-4 font-bold text-sm transition-colors relative ${activeTab === 'ai' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              <span className="flex items-center gap-2"><Icons.Sparkles /> AI Assistant</span>
              {activeTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full"></div>}
          </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
          {activeTab === 'guide' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                      <HelpSection title="1. Getting Started">
                          <p><strong>Initial Setup:</strong> When you first login, enter your Shop Name and your Email. This creates a secure profile in your browser.</p>
                          <p><strong>Configuration:</strong> Go to Settings (click your name in the sidebar) to set your UPI ID for payments and customize tax rules (e.g., GST).</p>
                      </HelpSection>

                      <HelpSection title="2. Managing Inventory">
                          <p><strong>Adding Products:</strong> Click "Add Product" in the Inventory tab. You can create a new item manually.</p>
                          <p><strong>Variants:</strong> If you add multiple items with the exact same Name (e.g., "Milk"), they will be grouped together automatically as variants (e.g., 500ml, 1L).</p>
                          <p><strong>Invoice Scanning:</strong> Click "Scan Invoice" to upload a photo of a supplier bill. The AI will read it and fill in product details for you.</p>
                      </HelpSection>
                  </div>

                  <div className="space-y-6">
                      <HelpSection title="3. Point of Sale (POS)">
                          <p><strong>Selling:</strong> Tap items in the grid to add to the cart. You can filter by category at the top.</p>
                          <p><strong>Checkout:</strong> Click Checkout to choose payment:
                            <ul className="list-disc list-inside mt-2 ml-2 space-y-1 text-slate-500 dark:text-slate-400">
                                <li><strong>Cash:</strong> Standard cash sale.</li>
                                <li><strong>UPI:</strong> Generates a QR code using your UPI ID for the customer to scan.</li>
                                <li><strong>Store Credit:</strong> Assigns the cost to the selected customer's debt balance.</li>
                            </ul>
                          </p>
                      </HelpSection>

                      <HelpSection title="4. Customers & Credit">
                          <p><strong>Profiles:</strong> Create profiles for regular customers in the Customers tab.</p>
                          <p><strong>Settling Debt:</strong> When a customer pays you back for previous credit, go to their profile and click "Settle Debt".</p>
                      </HelpSection>
                  </div>
              </div>
          ) : (
              <div className="max-w-2xl mx-auto mt-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl mb-8">
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                              <Icons.Sparkles />
                          </div>
                          <h3 className="text-xl font-bold">Ask Nexus AI</h3>
                      </div>
                      <p className="text-indigo-100 mb-6">
                          I know everything about Nexus POS. Ask me how to perform tasks, find settings, or manage your shop data.
                      </p>
                      
                      <form onSubmit={handleAiAsk} className="relative">
                          <input 
                              type="text" 
                              placeholder="e.g., How do I add a 5% GST tax?"
                              className="w-full py-4 pl-6 pr-12 rounded-xl text-slate-800 outline-none shadow-lg focus:ring-2 focus:ring-indigo-300"
                              value={aiQuery}
                              onChange={(e) => setAiQuery(e.target.value)}
                          />
                          <button 
                            type="submit"
                            disabled={loading || !aiQuery.trim()} 
                            className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                          >
                             {loading ? <span className="animate-spin block w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></span> : '→'}
                          </button>
                      </form>
                  </div>

                  {aiResponse && (
                      <div className="bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-6 shadow-sm animate-fade-in">
                          <h4 className="text-xs font-bold text-indigo-500 uppercase mb-2">AI Response</h4>
                          <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                              {aiResponse}
                          </p>
                      </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
};