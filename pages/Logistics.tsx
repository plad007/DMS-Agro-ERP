import React, { useState } from 'react';
import { Truck, Scale, MapPin, Plus } from 'lucide-react';
import { Contract, Shipment } from '../types';
import { addShipment } from '../services/mockService';

interface LogisticsProps {
  contracts: Contract[];
  shipments: Shipment[];
  onUpdate: () => void;
}

export const Logistics: React.FC<LogisticsProps> = ({ contracts, shipments, onUpdate }) => {
  const [selectedContractId, setSelectedContractId] = useState<string>(contracts[0]?.id || '');
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form for new ticket
  const [ticketData, setTicketData] = useState({
    plate: '',
    ticketNumber: '',
    weightKg: 0
  });

  const selectedContract = contracts.find(c => c.id === selectedContractId);
  const contractShipments = shipments.filter(s => s.contractId === selectedContractId);

  const handleAddTicket = async () => {
    if(!selectedContract) return;
    
    setIsSubmitting(true);

    // Convert Kg to Bags (Standard 60kg)
    const bags = Math.floor(ticketData.weightKg / 60);

    const newShipment: Shipment = {
        id: Math.random().toString(36), // Temp ID
        contractId: selectedContract.id,
        plate: ticketData.plate,
        ticketNumber: ticketData.ticketNumber,
        weightKg: ticketData.weightKg,
        bagsCount: bags,
        date: new Date().toISOString()
    };

    await addShipment(newShipment);
    await onUpdate();
    setIsSubmitting(false);
    setShowAddTicket(false);
    setTicketData({ plate: '', ticketNumber: '', weightKg: 0 });
  };

  if (!selectedContract) return <div className="text-slate-500 p-8 text-center">Nenhum contrato disponível para logística.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Sidebar: Contract Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5" /> Selecione o Contrato
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {contracts.map(contract => (
                <button
                    key={contract.id}
                    onClick={() => setSelectedContractId(contract.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedContractId === contract.id 
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                        : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex justify-between mb-1">
                        <span className="font-bold text-slate-800">{contract.number}</span>
                        <span className="text-xs font-semibold text-emerald-700">{((contract.deliveredBags / contract.totalBags)*100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{contract.sellerName}</p>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{width: `${(contract.deliveredBags / contract.totalBags)*100}%`}}></div>
                    </div>
                </button>
            ))}
        </div>
      </div>

      {/* Main Content: Shipments */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Contrato {selectedContract.number}</h2>
                    <p className="text-slate-500">{selectedContract.sellerName} <span className="mx-2">•</span> {selectedContract.product}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium text-slate-500">Saldo a Entregar</p>
                    <p className="text-2xl font-bold text-slate-800">{(selectedContract.totalBags - selectedContract.deliveredBags).toLocaleString()} scs</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-xs uppercase text-slate-500 font-semibold">Volume Total</p>
                    <p className="font-bold text-lg">{selectedContract.totalBags.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg text-emerald-700">
                    <p className="text-xs uppercase text-emerald-600 font-semibold">Entregue</p>
                    <p className="font-bold text-lg">{selectedContract.deliveredBags.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                     <p className="text-xs uppercase text-slate-500 font-semibold">Viagens</p>
                     <p className="font-bold text-lg">{contractShipments.length}</p>
                </div>
            </div>
        </div>

        {/* Action Button */}
        <button 
            onClick={() => setShowAddTicket(!showAddTicket)}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
        >
            <Plus className="w-5 h-5" />
            Lançar Ticket de Pesagem
        </button>

        {/* Add Ticket Form */}
        {showAddTicket && (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-in fade-in slide-in-from-top-4">
                <h4 className="font-bold text-lg mb-4 text-slate-800">Novo Embarque</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Placa</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2 mt-1 uppercase"
                            placeholder="ABC-1234"
                            value={ticketData.plate}
                            onChange={(e) => setTicketData({...ticketData, plate: e.target.value.toUpperCase()})}
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Ticket Balança</label>
                        <input 
                            type="text" 
                            className="w-full border border-slate-300 rounded-lg p-2 mt-1"
                            placeholder="Nº 9988"
                            value={ticketData.ticketNumber}
                            onChange={(e) => setTicketData({...ticketData, ticketNumber: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Peso Líquido (Kg)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                className="w-full border border-slate-300 rounded-lg p-2 mt-1 pl-8"
                                placeholder="0"
                                value={ticketData.weightKg || ''}
                                onChange={(e) => setTicketData({...ticketData, weightKg: Number(e.target.value)})}
                            />
                            <Scale className="w-4 h-4 text-slate-400 absolute left-2.5 top-4" />
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setShowAddTicket(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                    <button onClick={handleAddTicket} disabled={isSubmitting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center">
                        {isSubmitting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>}
                        Confirmar Lançamento
                    </button>
                </div>
            </div>
        )}

        {/* History List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <h4 className="font-bold text-slate-800 p-4 border-b border-slate-100 bg-slate-50">Histórico de Embarques</h4>
            {contractShipments.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhum embarque registrado.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-3 font-medium">Data</th>
                                <th className="px-6 py-3 font-medium">Placa</th>
                                <th className="px-6 py-3 font-medium">Ticket</th>
                                <th className="px-6 py-3 font-medium text-right">Peso (Kg)</th>
                                <th className="px-6 py-3 font-medium text-right">Sacas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {contractShipments.map(s => (
                                <tr key={s.id}>
                                    <td className="px-6 py-3 text-slate-600">{new Date(s.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 font-mono font-bold text-slate-700">{s.plate}</td>
                                    <td className="px-6 py-3 text-slate-600">{s.ticketNumber}</td>
                                    <td className="px-6 py-3 text-right">{s.weightKg.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right font-bold text-emerald-700">{s.bagsCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};