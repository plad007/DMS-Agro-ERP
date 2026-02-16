import React from 'react';
import { ArrowUp, ArrowDown, DollarSign, Wheat, AlertTriangle, TrendingUp } from 'lucide-react';
import { MarketData, Contract } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  marketData: MarketData;
  contracts: Contract[];
}

export const Dashboard: React.FC<DashboardProps> = ({ marketData, contracts }) => {
  // Mock logic for "To Fix" alerts (simulating 30 days logic)
  const contractsToFix = contracts.filter(c => !c.isFixed && c.status !== 'Concluído');
  
  // Calculate Volume Data for Chart
  const volumeByCrop = contracts.reduce((acc: any[], curr) => {
    const existing = acc.find(item => item.name === curr.crop);
    if (existing) {
      existing.volume += curr.totalBags;
    } else {
      acc.push({ name: curr.crop, volume: curr.totalBags });
    }
    return acc;
  }, []);

  const totalActiveVolume = contracts.reduce((acc, curr) => acc + curr.totalBags, 0);

  return (
    <div className="space-y-6">
      {/* Ticker / Market Data */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">Dólar PTAX</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">R$ {marketData.usd.toFixed(4)}</h3>
            </div>
            <div className="bg-red-50 p-2 rounded-lg text-red-600">
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-red-600 mt-2 font-medium">-0.45% hoje</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">CBOT Soja</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{marketData.cbotSoy.toFixed(2)} ¢</h3>
            </div>
            <div className="bg-green-50 p-2 rounded-lg text-green-600">
              <ArrowUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2 font-medium">+1.20% hoje</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">CBOT Milho</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{marketData.cbotCorn.toFixed(2)} ¢</h3>
            </div>
             <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">Estável</p>
        </div>

        <div className="bg-emerald-600 p-4 rounded-xl shadow-sm border border-emerald-500 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-emerald-100 uppercase">Volume Total Ativo</p>
              <h3 className="text-2xl font-bold mt-1">{totalActiveVolume.toLocaleString()} scs</h3>
            </div>
            <div className="bg-emerald-500/50 p-2 rounded-lg">
              <Wheat className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-xs text-emerald-100 mt-2">{contracts.length} contratos vigentes</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Volume por Safra</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeByCrop}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis tick={{fontSize: 12}} />
                <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                    {volumeByCrop.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#10b981" />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800">Alerta de Fixação</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">Contratos não fixados próximos ao limite de 30 dias.</p>
          
          <div className="space-y-3">
            {contractsToFix.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Nenhum alerta pendente.</p>
            ) : (
                contractsToFix.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                    <p className="font-bold text-slate-800 text-sm">{c.number}</p>
                    <p className="text-xs text-slate-600">{c.sellerName}</p>
                    </div>
                    <div className="text-right">
                    <p className="text-xs font-bold text-amber-700">A FIXAR</p>
                    <p className="text-xs text-slate-500">{c.totalBags} scs</p>
                    </div>
                </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};