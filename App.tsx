import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contracts } from './pages/Contracts';
import { Logistics } from './pages/Logistics';
import { Registries } from './pages/Registries';
import { Settings } from './pages/Settings';
import { getContracts, getMarketData, getShipments } from './services/mockService';
import { Contract, Shipment, MarketData } from './types';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [marketData, setMarketData] = useState<MarketData>({ usd: 0, cbotSoy: 0, cbotCorn: 0 });
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [contractsData, shipmentsData] = await Promise.all([
        getContracts(),
        getShipments()
      ]);
      setContracts(contractsData);
      setShipments(shipmentsData);
      setMarketData(getMarketData()); // Still sync mock for now
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-emerald-800">
           <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
           <p className="animate-pulse">Carregando dados do sistema...</p>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard marketData={marketData} contracts={contracts} />;
      case 'contracts':
        return <Contracts contracts={contracts} marketData={marketData} onUpdate={refreshData} />;
      case 'logistics':
        return <Logistics contracts={contracts} shipments={shipments} onUpdate={refreshData} />;
      case 'registries':
        return <Registries />;
      case 'settings':
        return <Settings />;
      default:
        return <div className="p-10 text-center text-slate-500">Módulo em desenvolvimento...</div>;
    }
  };

  return (
    <Layout activePage={activePage} onNavigate={setActivePage}>
      {renderContent()}
    </Layout>
  );
}