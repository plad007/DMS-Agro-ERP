
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Contracts } from './pages/Contracts';
import { Logistics } from './pages/Logistics';
import { Registries } from './pages/Registries';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import {
  getContractsWithIntegrity,
  getMarketData,
  getShipmentsWithIntegrity,
  getProducersWithIntegrity,
  getBuyersWithIntegrity
} from './services/mockService';
import { Contract, Shipment, MarketData, Producer, Buyer, SystemDataIntegrity } from './types';

export default function App() {
  const activePageStorage = sessionStorage.getItem('dms_active_page') || 'dashboard';
  const [activePage, setActivePage] = useState(activePageStorage);
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [dataIntegrity, setDataIntegrity] = useState<SystemDataIntegrity | undefined>(undefined);
  const [marketData, setMarketData] = useState<MarketData>({ usd: 0, cbotSoy: 0, cbotCorn: 0 });
  const [loading, setLoading] = useState(true);

  const handleNavigate = (page: string) => {
      setActivePage(page);
      sessionStorage.setItem('dms_active_page', page);
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const [contractsRes, shipmentsRes, producersRes, buyersRes] = await Promise.all([
        getContractsWithIntegrity(),
        getShipmentsWithIntegrity(),
        getProducersWithIntegrity(),
        getBuyersWithIntegrity()
      ]);
      setContracts(contractsRes.data);
      setShipments(shipmentsRes.data);
      setProducers(producersRes.data);
      setBuyers(buyersRes.data);
      setDataIntegrity({
        contracts: contractsRes.integrity,
        shipments: shipmentsRes.integrity,
        producers: producersRes.integrity,
        buyers: buyersRes.integrity,
        hasIncompleteData:
          !contractsRes.integrity.isComplete ||
          !shipmentsRes.integrity.isComplete ||
          !producersRes.integrity.isComplete ||
          !buyersRes.integrity.isComplete
      });
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
      case 'reports':
        return (
          <Reports
            contracts={contracts}
            shipments={shipments}
            producers={producers}
            buyers={buyers}
            dataIntegrity={dataIntegrity}
          />
        );
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
    <Layout activePage={activePage} onNavigate={handleNavigate}>
      {renderContent()}
    </Layout>
  );
}
