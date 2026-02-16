
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contracts } from './pages/Contracts';
import { Logistics } from './pages/Logistics';
import { Registries } from './pages/Registries';
import { getContracts, getMarketData, getShipments } from './services/mockService';
import { Contract, Shipment, MarketData } from './types';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  
  // Simulated Global State (would be Context API or Redux in larger app)
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [marketData, setMarketData] = useState<MarketData>({ usd: 0, cbotSoy: 0, cbotCorn: 0 });

  const refreshData = () => {
    setContracts(getContracts());
    setShipments(getShipments());
    setMarketData(getMarketData());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard marketData={marketData} contracts={contracts} />;
      case 'contracts':
        return <Contracts contracts={contracts} marketData={marketData} onUpdate={refreshData} />;
      case 'logistics':
        return <Logistics contracts={contracts} shipments={shipments} onUpdate={refreshData} />;
      case 'registries':
        return <Registries />;
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
