
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Filter, Download, FileSpreadsheet, Lock, Unlock, Edit2, Share2, CheckCircle, FileText, Calendar, MapPin, DollarSign, Truck, Calculator, Eye, Printer, X, Sprout, FileBarChart, Settings2, FileDown, Send } from 'lucide-react';
import { Contract, PricingMode, ContractStatus, MarketData, Producer, Buyer, FreightType } from '../types';
import { generateContractNumber, saveContract, getProducers, getBuyers } from '../services/mockService';

interface ContractsProps {
  contracts: Contract[];
  marketData: MarketData;
  onUpdate: () => void;
}

// LOGO DMS AGRO PARA IMPRESSÃO
const LOGO_URL = "https://i.postimg.cc/8CmMzM9c/LOGO-DMS-SF.png"; 


const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

export const Contracts: React.FC<ContractsProps> = ({ contracts, marketData, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Report State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportColumns, setReportColumns] = useState({
      date: true,
      contract: true,
      crop: true,
      seller: true,
      buyer: true,
      volume: true,
      price: true,
      status: true,
      freight: false,
      location: false // NEW
  });

  // Report Specific Filters
  const [reportFilters, setReportFilters] = useState({
      product: '',
      crop: '',
      seller: '',
      buyer: '',
      status: '',
      freight: '',
      currency: '',
      shipmentMonth: '', // NEW
      shipmentYear: ''   // NEW
  });

  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  
  // NEW: Dedicated Printing State
  const [printingContract, setPrintingContract] = useState<Contract | null>(null);

  const [filter, setFilter] = useState('');
  
  // Mock Data Lists
  const [producersList, setProducersList] = useState<Producer[]>([]);
  const [buyersList, setBuyersList] = useState<Buyer[]>([]);
  
  // Custom Local State for Form Interaction
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<{name: string, id?: string}[]>([]);

  // Shipment Period State (UI Only)
  const [isImmediate, setIsImmediate] = useState(false);
  const [startFortnight, setStartFortnight] = useState<'1' | '2'>('1');
  const [startMonth, setStartMonth] = useState(new Date().getMonth());
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  
  const [endFortnight, setEndFortnight] = useState<'1' | '2'>('2');
  const [endMonth, setEndMonth] = useState(new Date().getMonth());
  const [endYear, setEndYear] = useState(new Date().getFullYear());

  // Form State
  const [formData, setFormData] = useState<Partial<Contract>>({
    pricingMode: PricingMode.FIXED,
    isFixed: false,
    currency: 'BRL',
    product: 'SOJA',
    crop: '23/24',
    freightType: 'FOB',
    closingDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadAuxData = async () => {
        const [p, b] = await Promise.all([getProducers(), getBuyers()]);
        setProducersList(p);
        setBuyersList(b);
    };
    loadAuxData();
  }, []);

  // Update underlying dates when UI selectors change
  useEffect(() => {
    if (!isModalOpen) return;

    let startDateStr = '';
    
    if (isImmediate) {
        startDateStr = new Date().toISOString().split('T')[0];
    } else {
        const day = startFortnight === '1' ? 1 : 16;
        const d = new Date(startYear, startMonth, day);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        startDateStr = d.toISOString().split('T')[0];
    }

    let endDay = 15;
    if (endFortnight === '2') {
        endDay = new Date(endYear, endMonth + 1, 0).getDate();
    }
    const endDateObj = new Date(endYear, endMonth, endDay);
    endDateObj.setMinutes(endDateObj.getMinutes() - endDateObj.getTimezoneOffset());
    const endDateStr = endDateObj.toISOString().split('T')[0];

    setFormData(prev => ({
        ...prev,
        shipmentStartDate: startDateStr,
        shipmentEndDate: endDateStr
    }));

  }, [isImmediate, startFortnight, startMonth, startYear, endFortnight, endMonth, endYear, isModalOpen]);

  // Handlers
  const handlePrint = (contract: Contract) => {
    setPrintingContract(contract);
  };

  const handlePdf = (contract: Contract) => {
      setPrintingContract(contract);
  };

  const handleSendLink = (contract: Contract) => {
      const link = `https://dms-agro.app/contratos/${contract.id}/assinar`;
      alert(`LINK GERADO COM SUCESSO!\n\n${link}\n\nO link foi copiado para a área de transferência e enviado via integração WhatsApp.`);
  };

  const handleEdit = (contract: Contract) => {
    setEditingContract(contract);
    setFormData({ ...contract });
    
    const start = new Date(contract.shipmentStartDate);
    const end = new Date(contract.shipmentEndDate);
    
    const startDay = start.getUTCDate();
    if (startDay !== 1 && startDay !== 16) {
        setIsImmediate(true);
    } else {
        setIsImmediate(false);
        setStartFortnight(startDay <= 15 ? '1' : '2');
    }
    
    setStartMonth(start.getUTCMonth());
    setStartYear(start.getUTCFullYear());

    const endDay = end.getUTCDate();
    setEndFortnight(endDay <= 15 ? '1' : '2');
    setEndMonth(end.getUTCMonth());
    setEndYear(end.getUTCFullYear());
    
    const seller = producersList.find(p => p.name === contract.sellerName);
    if(seller) {
        setAvailableLocations(seller.farms.map(f => ({name: f.name, id: f.id})));
        const exists = seller.farms.some(f => f.name === contract.pickupLocation);
        setIsNewLocation(!exists);
    } else {
        setAvailableLocations([]);
        setIsNewLocation(true);
    }
    
    setIsModalOpen(true);
  };

  const handleCreate = async () => {
    setIsLoading(true);
    const newNumber = await generateContractNumber('SOJA', '23/24');
    setIsLoading(false);

    setEditingContract(null);
    setFormData({
      number: newNumber,
      pricingMode: PricingMode.FIXED,
      product: 'SOJA',
      crop: '23/24',
      isFixed: false,
      currency: 'BRL',
      freightType: 'FOB',
      status: ContractStatus.DRAFT,
      commissionPerBag: 0.50,
      exchangeRate: marketData.usd,
      closingDate: new Date().toISOString().split('T')[0] // Default Today
    });

    const today = new Date();
    setStartMonth(today.getMonth());
    setStartYear(today.getFullYear());
    setStartFortnight('1');
    setIsImmediate(false);
    
    setEndMonth(today.getMonth());
    setEndYear(today.getFullYear());
    setEndFortnight('2');

    setAvailableLocations([]);
    setIsNewLocation(false);
    setIsModalOpen(true);
  };

  const handleSellerChange = (sellerName: string) => {
    const seller = producersList.find(p => p.name === sellerName);
    // AUTO LINK BY DOCUMENT
    setFormData({...formData, sellerName, sellerDoc: seller?.doc});
    
    if (seller) {
        const locations = seller.farms.map(f => ({name: f.name, id: f.id}));
        setAvailableLocations(locations);
        if (locations.length > 0) {
            setFormData(prev => ({...prev, sellerName, sellerDoc: seller.doc, pickupLocation: locations[0].name}));
            setIsNewLocation(false);
        } else {
            setIsNewLocation(true);
            setFormData(prev => ({...prev, sellerName, sellerDoc: seller.doc, pickupLocation: ''}));
        }
    } else {
        setAvailableLocations([]);
    }
  };

  const handleBuyerChange = (buyerName: string) => {
      const buyer = buyersList.find(b => b.name === buyerName);
      // AUTO LINK BY DOCUMENT
      setFormData({...formData, buyerName, buyerDoc: buyer?.doc});
  };

  const handleProductChange = async (newProduct: 'SOJA' | 'MILHO' | 'TRIGO') => {
      setFormData({...formData, product: newProduct});
      // Generate new number based on product
      const newNum = await generateContractNumber(newProduct, formData.crop || '23/24');
      setFormData(prev => ({...prev, number: newNum}));
  };

  const handleVolumeChange = (value: string, unit: 'BAGS' | 'TONS') => {
      const val = Number(value);
      if (unit === 'BAGS') {
          const tons = (val * 60) / 1000;
          setFormData({ ...formData, totalBags: val, totalTons: parseFloat(tons.toFixed(3)) });
      } else {
          const bags = (val * 1000) / 60;
          setFormData({ ...formData, totalTons: val, totalBags: parseFloat(bags.toFixed(2)) });
      }
  };

  const handleSave = async () => {
    if (!formData.sellerName || !formData.buyerName || !formData.totalBags || !formData.pickupLocation || !formData.closingDate) {
        alert("Preencha os campos obrigatórios (Data, Vendedor, Comprador, Volume, Local)");
        return;
    }

    setIsLoading(true);

    const paymentDate = formData.paymentDate || new Date().toISOString().split('T')[0];
    const commissionDate = new Date(paymentDate);
    commissionDate.setDate(commissionDate.getDate() + 1);

    if (editingContract?.isFixed && formData.finalPrice !== editingContract.finalPrice) {
        if(!confirm("ALERTA DE AUDITORIA: Você está alterando o preço de um contrato já fixado. Confirma a alteração?")) {
            setIsLoading(false);
            return;
        }
    }

    const finalContract: Contract = {
      id: editingContract?.id || Math.random().toString(36).substr(2, 9),
      number: formData.number!,
      product: formData.product as any,
      crop: formData.crop!,
      sellerName: formData.sellerName!,
      sellerDoc: formData.sellerDoc, // Saving Doc
      buyerName: formData.buyerName!,
      buyerDoc: formData.buyerDoc, // Saving Doc
      totalBags: Number(formData.totalBags),
      totalTons: Number(formData.totalTons || 0),
      deliveredBags: formData.deliveredBags || 0,
      freightType: formData.freightType as FreightType,
      pickupLocation: formData.pickupLocation!,
      shipmentStartDate: formData.shipmentStartDate!,
      shipmentEndDate: formData.shipmentEndDate!,
      observation: formData.observation || '',
      currency: formData.currency as any,
      exchangeRate: Number(formData.exchangeRate),
      pricingMode: formData.pricingMode as PricingMode,
      isFixed: formData.isFixed || false,
      basePrice: Number(formData.basePrice || 0),
      cbotComponent: Number(formData.cbotComponent || 0),
      basisComponent: Number(formData.basisComponent || 0),
      costComponent: Number(formData.costComponent || 0),
      finalPrice: Number(calculatePrice()), 
      commissionPerBag: Number(formData.commissionPerBag),
      paymentDate: paymentDate,
      commissionDueDate: commissionDate.toISOString().split('T')[0],
      closingDate: formData.closingDate!,
      status: formData.status as ContractStatus,
      createdAt: editingContract?.createdAt || new Date().toISOString()
    };

    await saveContract(finalContract);
    await onUpdate(); // Refresh global list
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const calculatePrice = () => {
    if (formData.pricingMode === PricingMode.FIXED) {
      return formData.basePrice || 0;
    } else {
      const cbot = Number(formData.cbotComponent || 0);
      const basis = Number(formData.basisComponent || 0);
      const cost = Number(formData.costComponent || 0);
      return (cbot + basis + cost);
    }
  };

  const calculatedPrice = calculatePrice();
  
  const filteredContracts = contracts.filter(c => 
    c.number.toLowerCase().includes(filter.toLowerCase()) || 
    c.sellerName.toLowerCase().includes(filter.toLowerCase())
  );

  const reportData = useMemo(() => {
      return filteredContracts.filter(c => {
          if (reportFilters.crop && c.crop !== reportFilters.crop) return false;
          if (reportFilters.product && c.product !== reportFilters.product) return false;
          if (reportFilters.seller && c.sellerName !== reportFilters.seller) return false;
          if (reportFilters.buyer && c.buyerName !== reportFilters.buyer) return false;
          if (reportFilters.status && c.status !== reportFilters.status) return false;
          if (reportFilters.freight && c.freightType !== reportFilters.freight) return false;
          if (reportFilters.currency && c.currency !== reportFilters.currency) return false;
          
          // Filter by Shipment Period
          if (reportFilters.shipmentYear) {
              const start = new Date(c.shipmentStartDate);
              if (start.getUTCFullYear().toString() !== reportFilters.shipmentYear) return false;
          }
          if (reportFilters.shipmentMonth) {
              const start = new Date(c.shipmentStartDate);
              // shipmentMonth is "0" for Jan, "1" for Feb... same as getUTCMonth
              if (start.getUTCMonth().toString() !== reportFilters.shipmentMonth) return false;
          }

          return true;
      });
  }, [filteredContracts, reportFilters]);

  const getReportTitle = () => {
      const parts = ["RELATÓRIO DE CONTRATOS"];
      if (reportFilters.crop) parts.push(`SAFRA ${reportFilters.crop}`);
      if (reportFilters.product) parts.push(`PRODUTO: ${reportFilters.product}`);
      if (reportFilters.seller) parts.push(`VENDEDOR: ${reportFilters.seller}`);
      return parts.join(" - ");
  };

  const toggleReportColumn = (col: keyof typeof reportColumns) => {
      setReportColumns(prev => ({...prev, [col]: !prev[col]}));
  };

  const getFullSeller = (name: string) => producersList.find(p => p.name === name);
  const getFullBuyer = (name: string) => buyersList.find(b => b.name === name);

  const formatFortnightDate = (dateStr: string, type: 'START' | 'END'): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = date.getUTCDate();
    const month = MONTHS[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const shortYear = year.toString().slice(-2);

    if (type === 'START') {
        if (day !== 1 && day !== 16) return "Imediato";
        const quin = day === 1 ? '1ª' : '2ª';
        return `${quin} Quinzena ${month}/${shortYear}`;
    } else {
        const quin = day <= 15 ? '1ª' : '2ª';
        return `${quin} Quinzena ${month}/${shortYear}`;
    }
  };

  const getPeriodDisplay = (start: string, end: string) => {
    const startTxt = formatFortnightDate(start, 'START');
    const endTxt = formatFortnightDate(end, 'END');
    
    if (startTxt === 'Imediato') return `Imediato até ${endTxt}`;
    return `${startTxt} a ${endTxt}`;
  };

  // --- PORTAL COMPONENT FOR PRINTING ---
  const PrintableContract = ({ contract, onClose }: { contract: Contract, onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            window.print();
        }, 500);
        return () => clearTimeout(timer);
    }, []);

    const seller = getFullSeller(contract.sellerName);
    const buyer = getFullBuyer(contract.buyerName);

    return (
        <div className="fixed inset-0 z-[10000] bg-white overflow-auto">
            {/* Toolbar for the Overlay (Visible on screen, hidden on print) */}
             <div className="fixed top-4 right-4 z-[10001] flex gap-2 no-print bg-slate-900/90 p-2 rounded-lg backdrop-blur shadow-xl border border-slate-700">
                <button 
                    onClick={() => window.print()}
                    className="flex items-center px-4 py-2 bg-white text-slate-900 rounded font-medium shadow hover:bg-slate-100"
                >
                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                </button>
                 <button 
                    onClick={() => handleSendLink(contract)}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded font-medium shadow hover:bg-green-700"
                >
                    <Send className="w-4 h-4 mr-2" /> Enviar Link
                </button>
                <div className="w-px bg-slate-600 mx-2"></div>
                <button 
                    onClick={onClose}
                    className="flex items-center px-4 py-2 bg-slate-700 text-white rounded font-medium shadow hover:bg-slate-600"
                >
                    <X className="w-4 h-4 mr-2" /> Fechar
                </button>
             </div>

             {/* The Actual A4 Paper Content */}
             <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[10mm] mx-auto text-black font-sans text-[11px] leading-tight mt-16 print:mt-0 shadow-2xl print:shadow-none">
                 <div className="border border-black">
                    {/* Header */}
                    <div className="flex justify-between items-center p-2 border-b border-black h-28">
                        <div className="text-emerald-800 h-full flex items-center pl-2">
                            <img 
                                src={LOGO_URL} 
                                alt="DMS Agro" 
                                className="h-24 w-auto object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <Sprout className="w-16 h-16 hidden" />
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold uppercase border-2 border-black px-2 py-1 inline-block">Confirmação de Negócio</h2>
                        </div>
                    </div>

                    {/* Green Info Bar */}
                    <div className="grid grid-cols-3 bg-green-100 border-b border-black text-center py-1 font-bold text-xs uppercase text-black print:bg-green-100 print:text-black print:color-adjust-exact">
                        <div className="border-r border-black">NÚMERO: {contract.number}</div>
                        <div className="border-r border-black">SAFRA: {contract.crop}</div>
                        <div>DATA FECHAMENTO: {new Date(contract.closingDate || contract.createdAt).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>
                    </div>

                    {/* Elementos do Negocio */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">ELEMENTOS DO NEGÓCIO</div>
                    <div className="grid grid-cols-2 text-xs border-b border-black">
                        <div className="border-r border-black p-1">
                            <p><span className="font-bold">De:</span> DMS AGRO – Marcos Gaviraghi</p>
                            <p><span className="font-bold">Contrato:</span> {contract.number}</p>
                        </div>
                        <div className="p-1">
                            <p><span className="font-bold">Para:</span> {contract.buyerName}</p>
                            <div className="flex justify-between">
                                <span><span className="font-bold">Nº Ctro:</span> -</span>
                                <span><span className="font-bold">Hedge:</span> -</span>
                                <span><span className="font-bold">Produto:</span> {contract.product}</span>
                            </div>
                        </div>
                    </div>

                    {/* VENDEDOR */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">VENDEDOR</div>
                    <div className="p-1 border-b border-black text-xs relative">
                        <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                            <span className="font-bold">Nome:</span> <span className="uppercase">{seller?.name || contract.sellerName}</span>
                            <span className="font-bold text-right pr-2">CPF / CNPJ:</span> <span>{contract.sellerDoc || seller?.doc || '-'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr]">
                            <span className="font-bold">Email:</span> <span>{seller?.email || '-'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                            <span className="font-bold">Fazenda:</span> <span className="uppercase">{contract.pickupLocation}</span>
                            <span className="font-bold text-right pr-2">Insc. Estadual:</span> <span>{seller?.stateInsc}</span>
                        </div>
                    </div>

                    {/* COMPRADOR */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">COMPRADOR</div>
                    <div className="p-1 border-b border-black text-xs relative">
                        <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                            <span className="font-bold">Nome:</span> <span className="uppercase">{buyer?.name || contract.buyerName}</span>
                            <span className="font-bold text-right pr-2">CPF / CNPJ:</span> <span>{contract.buyerDoc || buyer?.doc || '-'}</span>
                        </div>
                        <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                            <span className="font-bold">Endereço:</span> <span className="uppercase">{buyer?.address}</span>
                            <span className="font-bold text-right pr-2">Insc. Estadual:</span> <span>{buyer?.stateInsc}</span>
                        </div>
                    </div>

                    {/* DETALHES DO PRODUTO */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">DETALHES DO PRODUTO</div>
                    <div className="border-b border-black text-xs">
                        <div className="flex border-b border-black border-dashed last:border-0">
                            <div className="w-24 p-1 font-bold border-r border-black border-dashed flex items-center">Quantidade e Qualidade:</div>
                            <div className="p-1 flex-1">
                                <p className="uppercase mb-1">
                                    {contract.totalBags.toLocaleString('pt-BR')} SACAS ({contract.totalTons.toLocaleString('pt-BR')} TONELADAS) DE {contract.product} EM GRÃOS.
                                </p>
                                <p>Qualidade: padrão exportação ANEC, umidade até 14%, impureza até 1%, Avariados e ou ardidos até 8%.</p>
                            </div>
                        </div>
                        <div className="flex p-1 items-center">
                            <span className="font-bold w-24">Preço:</span>
                            <span>R$ {contract.finalPrice.toFixed(2)} por saca (Livre de Funrural).</span>
                        </div>
                    </div>

                    {/* DADOS BANCÁRIOS */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">DADOS BANCÁRIOS</div>
                    <div className="p-1 border-b border-black text-xs">
                        <div className="grid grid-cols-4 gap-2 mb-1">
                            <div><span className="font-bold">Data Pagtº:</span> {new Date(contract.paymentDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>
                            <div><span className="font-bold">Banco:</span> {seller?.bankDetails?.bankName}</div>
                            <div><span className="font-bold">Ag:</span> {seller?.bankDetails?.agency}</div>
                            <div><span className="font-bold">C.C.:</span> {seller?.bankDetails?.account}</div>
                        </div>
                        <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                            <span className="font-bold">Favorecido:</span> <span className="uppercase">{seller?.bankDetails?.holder}</span>
                            <span className="font-bold text-right pr-2">CPF / CNPJ:</span> <span>{seller?.bankDetails?.holderDoc}</span>
                        </div>
                    </div>

                    {/* EMBARQUE PRODUTO */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">EMBARQUE PRODUTO</div>
                    <div className="p-1 border-b border-black text-xs">
                            <div className="grid grid-cols-[120px_1fr] mb-1">
                            <span className="font-bold">Modalidade:</span> 
                            <span className="uppercase font-bold">{contract.freightType === 'CIF' ? 'CIF (Frete por conta do Vendedor)' : 'FOB (Frete por conta do Comprador)'}</span>
                            </div>
                            <div className="grid grid-cols-[120px_1fr] mb-1">
                            <span className="font-bold">Local de Embarque:</span> <span className="uppercase">{contract.pickupLocation}</span>
                        </div>
                        <div className="grid grid-cols-[120px_1fr]">
                            <span className="font-bold">Período de Embarque:</span> 
                            <span className="uppercase">
                                {getPeriodDisplay(contract.shipmentStartDate, contract.shipmentEndDate)}
                            </span>
                        </div>
                    </div>

                    {/* OBSERVAÇÕES */}
                    <div className="bg-gray-300 border-b border-black text-center font-bold text-xs py-0.5 uppercase print:bg-gray-300 print:color-adjust-exact">OBSERVAÇÕES</div>
                    <div className="p-2 border-b border-black text-xs min-h-[80px] whitespace-pre-line">
                        {contract.observation}
                    </div>

                    {/* Assinaturas */}
                    <div className="grid grid-cols-3 gap-4 p-8 mt-4 text-center text-[10px] uppercase font-bold">
                        <div className="pt-2 border-t border-black">
                            <p>CLIENTE COMPRADOR</p>
                            <p>{buyer?.name}</p>
                        </div>
                        <div className="pt-2 border-t border-black">
                            <p>CORRETOR</p>
                            <p>MARCOS RODRIGO GAVIRAGHI</p>
                        </div>
                        <div className="pt-2 border-t border-black relative">
                            <p>CLIENTE VENDEDOR</p>
                            <p>{seller?.name}</p>
                            {contract.status === ContractStatus.SIGNED && contract.signatureData && (
                                <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 w-full text-emerald-600 normal-case bg-white/80">
                                    (Assinado Digitalmente)
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-black p-2 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-xs uppercase">DMS AGRO COMÉRCIO DE CEREAIS</h3>
                            <p className="text-[10px] font-bold mt-0.5">CNPJ: 33.082.718/0001-23</p>
                            <p className="text-[9px] mt-1">WhatsApp: 63 99979 8113 | 63 98113 3000</p>
                            <p className="text-[9px]">311 Sul. Orla 14 Graciosa. Lt 17 . Al 12 . Sala 1. CEP 77026 070 . Palmas TO</p>
                        </div>
                        <div className="text-emerald-800">
                                {/* LOGO IMAGE SUPPORT FOR FOOTER */}
                                <img 
                                    src={LOGO_URL} 
                                    alt="DMS Agro" 
                                    className="h-8 w-auto object-contain"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                />
                                <Sprout className="w-8 h-8 hidden" />
                                <span className="font-black text-sm block -mt-1">DMS AGRO</span>
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Styles for Printing */}
      <style>{`
        @media print {
          /* Hide EVERYTHING in the root */
          #root {
            display: none !important;
          }
          
          /* Only show the portal children */
          body > *:not(#root) {
            display: block !important;
          }

          body {
            background: white !important;
            overflow: visible !important;
          }

          @page {
             size: A4;
             margin: 0;
          }
          
          /* Force colors */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar contratos..." 
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
           <button onClick={() => setIsReportModalOpen(true)} className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shadow-sm transition-colors border border-slate-700">
            <FileBarChart className="w-5 h-5 mr-2" />
            Relatório PDF
          </button>
           <button className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Importar CSV
          </button>
          <button className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            <Download className="w-5 h-5 mr-2" />
            Exportar
          </button>
          <button onClick={handleCreate} disabled={isLoading} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors disabled:opacity-50">
            <Plus className="w-5 h-5 mr-2" />
            Novo Contrato
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
              <tr>
                <th className="px-6 py-4">Contrato</th>
                <th className="px-6 py-4">Safra/Prod</th>
                <th className="px-6 py-4">Partes</th>
                <th className="px-6 py-4">Volume (scs)</th>
                <th className="px-6 py-4">Preço (R$)</th>
                <th className="px-6 py-4">Embarque (Quinzena)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <button 
                        onClick={() => setViewingContract(contract)}
                        className="font-medium text-emerald-700 hover:underline"
                    >
                        {contract.number}
                    </button>
                     <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(contract.closingDate || contract.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">{contract.crop} <span className="text-xs text-slate-400">({contract.product})</span></td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-medium">{contract.sellerName}</div>
                    <div className="text-xs text-slate-500">→ {contract.buyerName}</div>
                  </td>
                  <td className="px-6 py-4">
                    {contract.totalBags.toLocaleString()} 
                    <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500" 
                            style={{ width: `${(contract.deliveredBags / contract.totalBags) * 100}%` }}
                        ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {contract.isFixed ? (
                        <span className="flex items-center gap-1 font-bold text-slate-800">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            {contract.finalPrice.toFixed(2)}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-xs font-semibold">
                            <Unlock className="w-3 h-3" />
                            A Fixar
                        </span>
                    )}
                     <span className="text-xs text-slate-400 ml-1">({contract.currency})</span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                     <span className="font-semibold block text-slate-800">{contract.freightType}</span>
                     <span className="text-slate-500">{getPeriodDisplay(contract.shipmentStartDate, contract.shipmentEndDate)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        contract.status === ContractStatus.SIGNED ? 'bg-green-100 text-green-800' :
                        contract.status === ContractStatus.DRAFT ? 'bg-slate-100 text-slate-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                      {contract.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-2">
                    {/* BUTTONS: Print, PDF, Send Link, View, Edit */}
                    <button 
                        onClick={() => handlePdf(contract)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Gerar PDF"
                    >
                        <FileDown className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handlePrint(contract)}
                        className="text-slate-400 hover:text-slate-800 transition-colors"
                        title="Imprimir"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleSendLink(contract)}
                        className="text-slate-400 hover:text-green-600 transition-colors"
                        title="Enviar Link Assinatura"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setViewingContract(contract)} 
                        className="text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Visualizar"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleEdit(contract)} 
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="Editar"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PORTAL PRINTING */}
      {printingContract && createPortal(
          <PrintableContract contract={printingContract} onClose={() => setPrintingContract(null)} />,
          document.body
      )}

      {/* REPORT GENERATION MODAL - MOVED TO PORTAL TO FIX PRINTING ISSUE */}
      {isReportModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex bg-slate-900/80 backdrop-blur-sm no-print items-start justify-center overflow-y-auto">
             <div className="w-full max-w-[1200px] my-10 flex gap-6">
                
                {/* Configuration Sidebar */}
                <div className="w-80 bg-white rounded-xl shadow-xl flex flex-col overflow-hidden shrink-0 sticky top-10">
                    <div className="p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-emerald-600" />
                            Configurar Relatório
                        </h3>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto max-h-[70vh] space-y-6">
                        
                        {/* DATA FILTERS SECTION - ADDED */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-xs font-bold text-slate-400 uppercase">Filtros de Dados</p>
                                <button 
                                    onClick={() => setReportFilters({product:'', crop:'', seller:'', buyer:'', status:'', freight:'', currency:'', shipmentMonth: '', shipmentYear: ''})}
                                    className="text-[10px] text-blue-600 hover:underline"
                                >
                                    Limpar
                                </button>
                            </div>
                            <div className="space-y-3">
                                {/* Safra */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Safra</label>
                                    <input 
                                        type="text" 
                                        className="w-full text-xs border border-slate-300 rounded p-1.5"
                                        placeholder="Ex: 23/24"
                                        value={reportFilters.crop}
                                        onChange={e => setReportFilters({...reportFilters, crop: e.target.value})}
                                    />
                                </div>
                                {/* Período de Embarque (NEW) */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Período de Embarque</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                            value={reportFilters.shipmentMonth}
                                            onChange={e => setReportFilters({...reportFilters, shipmentMonth: e.target.value})}
                                        >
                                            <option value="">Mês</option>
                                            {MONTHS.map((m, i) => <option key={i} value={i.toString()}>{m}</option>)}
                                        </select>
                                        <select 
                                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                            value={reportFilters.shipmentYear}
                                            onChange={e => setReportFilters({...reportFilters, shipmentYear: e.target.value})}
                                        >
                                            <option value="">Ano</option>
                                            {YEARS.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {/* Produto */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Produto</label>
                                    <select 
                                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                        value={reportFilters.product}
                                        onChange={e => setReportFilters({...reportFilters, product: e.target.value})}
                                    >
                                        <option value="">Todos</option>
                                        <option value="SOJA">Soja</option>
                                        <option value="MILHO">Milho</option>
                                        <option value="TRIGO">Trigo</option>
                                    </select>
                                </div>
                                {/* Vendedor */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Vendedor</label>
                                    <select 
                                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                        value={reportFilters.seller}
                                        onChange={e => setReportFilters({...reportFilters, seller: e.target.value})}
                                    >
                                        <option value="">Todos</option>
                                        {producersList.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                                {/* Comprador */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Comprador</label>
                                    <select 
                                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                        value={reportFilters.buyer}
                                        onChange={e => setReportFilters({...reportFilters, buyer: e.target.value})}
                                    >
                                        <option value="">Todos</option>
                                        {buyersList.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                    </select>
                                </div>
                                {/* Status */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-600">Status</label>
                                    <select 
                                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                                        value={reportFilters.status}
                                        onChange={e => setReportFilters({...reportFilters, status: e.target.value})}
                                    >
                                        <option value="">Todos</option>
                                        {Object.values(ContractStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <hr className="border-slate-100" />

                        {/* COLUMNS SECTION */}
                        <div>
                             <p className="text-xs font-bold text-slate-400 uppercase mb-3">Colunas Visíveis</p>
                             <div className="space-y-2">
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.date} onChange={() => toggleReportColumn('date')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Data Emissão
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.contract} onChange={() => toggleReportColumn('contract')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Nº Contrato
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.crop} onChange={() => toggleReportColumn('crop')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Safra / Produto
                                    </label>
                                </div>
                                 <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.seller} onChange={() => toggleReportColumn('seller')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Vendedor
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.buyer} onChange={() => toggleReportColumn('buyer')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Comprador
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.volume} onChange={() => toggleReportColumn('volume')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Volume
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.price} onChange={() => toggleReportColumn('price')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Preço
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.status} onChange={() => toggleReportColumn('status')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Status
                                    </label>
                                </div>
                                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                                    <label className="flex items-center gap-2 text-sm text-slate-800 font-medium cursor-pointer">
                                        <input type="checkbox" checked={reportColumns.location} onChange={() => toggleReportColumn('location')} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        Local de Embarque
                                    </label>
                                </div>
                             </div>
                        </div>

                    </div>
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-2">
                        <button onClick={() => window.print()} className="w-full flex justify-center items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
                            <Printer className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
                        </button>
                        <button onClick={() => setIsReportModalOpen(false)} className="w-full px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                            Fechar
                        </button>
                    </div>
                </div>

                {/* Preview Area (A4) */}
                <div className="flex-1 flex justify-center">
                    <div id="printable-report" className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[10mm] mx-auto text-slate-800">
                        <div className="flex justify-between items-start border-b-2 border-emerald-800 pb-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="text-emerald-800">
                                    {/* LOGO IMAGE SUPPORT FOR REPORT */}
                                    <img 
                                        src={LOGO_URL} 
                                        alt="DMS Agro" 
                                        className="h-16 w-auto object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                    <Sprout className="w-12 h-12 hidden" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-emerald-900 leading-none">DMS AGRO</h1>
                                    <p className="text-xs text-emerald-700 font-bold tracking-[0.2em] uppercase mt-1">Comércio de Cereais</p>
                                    <p className="text-[10px] text-slate-500 mt-1 font-medium">CNPJ: 33.082.718/0001-23</p>
                                </div>
                            </div>
                            <div className="text-right text-[10px] text-slate-500">
                                <p>311 Sul. Orla 14 Graciosa. Lt 17</p>
                                <p>Palmas - TO, 77026-070</p>
                                <p className="mt-1 font-bold">Contato: (63) 99979-8113</p>
                            </div>
                        </div>

                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 uppercase border-b border-slate-200 inline-block pb-1">
                                {getReportTitle()}
                            </h2>
                            <p className="text-xs text-slate-500 mt-2">
                                Gerado em: {new Date().toLocaleString()} | Registros: {reportData.length}
                            </p>
                        </div>

                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-emerald-50 border-y border-emerald-200 text-emerald-900">
                                    {reportColumns.date && <th className="p-2 font-bold">Data</th>}
                                    {reportColumns.contract && <th className="p-2 font-bold">Contrato</th>}
                                    {reportColumns.crop && <th className="p-2 font-bold">Safra/Prod</th>}
                                    {reportColumns.seller && <th className="p-2 font-bold">Vendedor</th>}
                                    {reportColumns.buyer && <th className="p-2 font-bold">Comprador</th>}
                                    {reportColumns.volume && <th className="p-2 font-bold text-right">Volume</th>}
                                    {reportColumns.price && <th className="p-2 font-bold text-right">Preço</th>}
                                    {reportColumns.status && <th className="p-2 font-bold text-center">Status</th>}
                                    {reportColumns.freight && <th className="p-2 font-bold">Frete</th>}
                                    {reportColumns.location && <th className="p-2 font-bold">Local Emb.</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {reportData.map((c, idx) => (
                                    <tr key={c.id} className={idx % 2 === 0 ? 'bg-white text-slate-800' : 'bg-slate-50 text-slate-800'}>
                                        {reportColumns.date && <td className="p-2">{new Date(c.closingDate || c.createdAt).toLocaleDateString()}</td>}
                                        {reportColumns.contract && <td className="p-2 font-bold">{c.number}</td>}
                                        {reportColumns.crop && <td className="p-2">{c.crop} ({c.product.charAt(0)})</td>}
                                        {reportColumns.seller && <td className="p-2 truncate max-w-[120px]">{c.sellerName}</td>}
                                        {reportColumns.buyer && <td className="p-2 truncate max-w-[120px]">{c.buyerName}</td>}
                                        {reportColumns.volume && <td className="p-2 text-right">{c.totalBags.toLocaleString()}</td>}
                                        {reportColumns.price && <td className="p-2 text-right">{c.currency} {c.finalPrice.toFixed(2)}</td>}
                                        {reportColumns.status && (
                                            <td className="p-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                    c.status === ContractStatus.SIGNED ? 'bg-green-50 text-green-700 border-green-200' :
                                                    c.status === ContractStatus.DRAFT ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}>
                                                    {c.status.toUpperCase()}
                                                </span>
                                            </td>
                                        )}
                                        {reportColumns.freight && <td className="p-2 text-[10px]">{c.freightType}</td>}
                                        {reportColumns.location && <td className="p-2 text-[10px] truncate max-w-[100px]">{c.pickupLocation}</td>}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800">
                                <tr>
                                    <td colSpan={Object.values(reportColumns).filter(v => v).length} className="p-2 text-right">
                                        Total Volume: {reportData.reduce((acc, c) => acc + c.totalBags, 0).toLocaleString()} scs
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
             </div>
        </div>,
        document.body
      )}

      {/* Contract EDIT/CREATE Modal (Existing) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 no-print">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {editingContract ? `Editar Contrato ${editingContract.number}` : 'Novo Contrato'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
             
            <div className="p-6 space-y-8">
                {/* 1. Parties & Product (Updated) */}
                <section>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Negociação & Partes</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Fields... */}
                        {/* Product/Crop */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                            <select 
                                className="w-full rounded-lg border border-slate-300 p-2.5 bg-slate-50 focus:bg-white"
                                value={formData.product}
                                onChange={(e) => handleProductChange(e.target.value as any)}
                            >
                                <option value="SOJA">Soja</option>
                                <option value="MILHO">Milho</option>
                                <option value="TRIGO">Trigo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Safra</label>
                            <input 
                                type="text" 
                                className="w-full rounded-lg border border-slate-300 p-2.5"
                                value={formData.crop}
                                onChange={(e) => setFormData({...formData, crop: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nº Contrato</label>
                            <input 
                                type="text" 
                                readOnly
                                className="w-full rounded-lg border border-slate-300 bg-slate-100 text-slate-500 p-2.5 font-mono"
                                value={formData.number}
                            />
                        </div>

                        {/* NEW: Closing Date */}
                        <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                             <label className="block text-xs font-bold text-amber-800 uppercase mb-1">Data Fechamento</label>
                             <input 
                                type="date" 
                                className="w-full rounded border border-amber-300 p-1.5 text-sm bg-white"
                                value={formData.closingDate || ''}
                                onChange={(e) => setFormData({...formData, closingDate: e.target.value})}
                            />
                        </div>

                        {/* Volume Inputs (Sacas / Tons) */}
                        <div className="md:col-span-1 grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                             <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sacas (60kg)</label>
                                <input 
                                    type="number" 
                                    className="w-full rounded border border-slate-300 p-1.5 text-sm"
                                    placeholder="0"
                                    value={formData.totalBags || ''}
                                    onChange={(e) => handleVolumeChange(e.target.value, 'BAGS')}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Toneladas</label>
                                <div className="relative">
                                     <input 
                                        type="number" 
                                        className="w-full rounded border border-slate-300 p-1.5 text-sm"
                                        placeholder="0.00"
                                        value={formData.totalTons || ''}
                                        onChange={(e) => handleVolumeChange(e.target.value, 'TONS')}
                                    />
                                    <Calculator className="w-3 h-3 text-emerald-400 absolute right-1.5 top-2.5" />
                                </div>
                            </div>
                        </div>

                        {/* Seller / Buyer */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vendedor (Produtor)</label>
                            <select 
                                className="w-full rounded-lg border border-slate-300 p-2.5 bg-white"
                                value={formData.sellerName || ''}
                                onChange={(e) => handleSellerChange(e.target.value)}
                            >
                                <option value="">Selecione o Produtor</option>
                                {producersList.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                            {/* Hidden Doc Display for Verification */}
                            {formData.sellerDoc && <p className="text-[10px] text-slate-400 mt-1 ml-1">Vinculado ao CPF/CNPJ: {formData.sellerDoc}</p>}
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Comprador (Trading/Fábrica)</label>
                             <select 
                                className="w-full rounded-lg border border-slate-300 p-2.5 bg-white"
                                value={formData.buyerName || ''}
                                onChange={(e) => handleBuyerChange(e.target.value)}
                            >
                                <option value="">Selecione o Comprador</option>
                                {buyersList.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                            {formData.buyerDoc && <p className="text-[10px] text-slate-400 mt-1 ml-1">Vinculado ao CNPJ: {formData.buyerDoc}</p>}
                        </div>
                    </div>
                </section>
                
                {/* 2. Pricing & Payment (No changes needed, but context maintained) */}
                 <section className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Preço e Pagamento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <div className="flex justify-between mb-4">
                                <label className="text-sm font-bold text-slate-700">Modo de Precificação</label>
                                <div className="flex bg-white rounded p-0.5 border border-slate-200">
                                    <button 
                                        className={`px-2 py-1 text-xs font-bold rounded ${formData.pricingMode === PricingMode.FIXED ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
                                        onClick={() => setFormData({...formData, pricingMode: PricingMode.FIXED})}
                                    >FIXO</button>
                                    <button 
                                        className={`px-2 py-1 text-xs font-bold rounded ${formData.pricingMode === PricingMode.COMPONENTS ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
                                        onClick={() => setFormData({...formData, pricingMode: PricingMode.COMPONENTS})}
                                    >COMP</button>
                                </div>
                            </div>

                            {formData.pricingMode === PricingMode.FIXED ? (
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase font-bold mb-1">Preço Fixo (R$/sc)</label>
                                    <input 
                                        type="number" 
                                        className="w-full text-xl font-bold text-emerald-700 border-b-2 border-emerald-500 bg-transparent outline-none p-1"
                                        value={formData.basePrice || ''}
                                        onChange={(e) => setFormData({...formData, basePrice: parseFloat(e.target.value)})}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold">CBOT (Pts)</label>
                                            <input type="number" className="w-full border rounded p-1 text-sm" value={formData.cbotComponent || ''} onChange={(e) => setFormData({...formData, cbotComponent: parseFloat(e.target.value)})} />
                                        </div>
                                         <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold">Basis (Pts)</label>
                                            <input type="number" className="w-full border rounded p-1 text-sm" value={formData.basisComponent || ''} onChange={(e) => setFormData({...formData, basisComponent: parseFloat(e.target.value)})} />
                                        </div>
                                    </div>
                                    <div>
                                         <label className="text-[10px] uppercase text-slate-500 font-bold">Custos (R$/sc)</label>
                                         <input type="number" className="w-full border rounded p-1 text-sm" value={formData.costComponent || ''} onChange={(e) => setFormData({...formData, costComponent: parseFloat(e.target.value)})} />
                                    </div>
                                </div>
                            )}

                             <div className="mt-4 pt-4 border-t border-slate-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-700">Preço Final</span>
                                    <span className="text-xl font-black text-slate-800">R$ {calculatedPrice.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <button 
                                        onClick={() => setFormData({...formData, isFixed: !formData.isFixed})}
                                        className={`flex-1 py-1.5 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${formData.isFixed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                                    >
                                        {formData.isFixed ? <><Lock className="w-3 h-3"/> PREÇO FIXADO</> : <><Unlock className="w-3 h-3"/> A FIXAR</>}
                                    </button>
                                </div>
                             </div>
                        </div>

                        {/* Payment Terms */}
                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Data Pagamento</label>
                                <input type="date" className="w-full border rounded-lg p-2.5" value={formData.paymentDate || ''} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Comissão (R$/sc)</label>
                                <div className="relative">
                                    <input type="number" className="w-full border rounded-lg p-2.5 pl-8" value={formData.commissionPerBag || ''} onChange={(e) => setFormData({...formData, commissionPerBag: parseFloat(e.target.value)})} />
                                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-3.5" />
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Moeda do Contrato</label>
                                <select className="w-full border rounded-lg p-2.5 bg-white" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value as any})}>
                                    <option value="BRL">BRL - Real</option>
                                    <option value="USD">USD - Dólar</option>
                                </select>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Taxa Câmbio (Ref)</label>
                                <input type="number" className="w-full border rounded-lg p-2.5" value={formData.exchangeRate || ''} onChange={(e) => setFormData({...formData, exchangeRate: parseFloat(e.target.value)})} />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Logistics */}
                <section className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Logística de Retirada</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Modalidade Frete</label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg w-full hover:bg-slate-50">
                                    <input type="radio" name="freight" checked={formData.freightType === 'FOB'} onChange={() => setFormData({...formData, freightType: 'FOB'})} className="text-emerald-600 focus:ring-emerald-500" />
                                    <div>
                                        <span className="block font-bold text-slate-800">FOB</span>
                                        <span className="text-xs text-slate-500">Retira na Fazenda</span>
                                    </div>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg w-full hover:bg-slate-50">
                                    <input type="radio" name="freight" checked={formData.freightType === 'CIF'} onChange={() => setFormData({...formData, freightType: 'CIF'})} className="text-emerald-600 focus:ring-emerald-500" />
                                    <div>
                                        <span className="block font-bold text-slate-800">CIF</span>
                                        <span className="text-xs text-slate-500">Entregue no Destino</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Local de Embarque (Fazenda)</label>
                            {isNewLocation ? (
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="w-full border rounded-lg p-2.5" 
                                        placeholder="Digite o nome da fazenda..."
                                        value={formData.pickupLocation || ''} 
                                        onChange={(e) => setFormData({...formData, pickupLocation: e.target.value})} 
                                    />
                                    <button onClick={() => setIsNewLocation(false)} className="text-slate-400 hover:text-slate-600 whitespace-nowrap text-xs">
                                        Selecionar da Lista
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <select 
                                        className="w-full border rounded-lg p-2.5 bg-white"
                                        value={formData.pickupLocation || ''}
                                        onChange={(e) => {
                                            if(e.target.value === 'NEW') setIsNewLocation(true);
                                            else setFormData({...formData, pickupLocation: e.target.value});
                                        }}
                                    >
                                        {availableLocations.map(l => (
                                            <option key={l.id} value={l.name}>{l.name}</option>
                                        ))}
                                        <option value="NEW">+ Cadastrar Novo Local</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-slate-700 mb-3">Período de Embarque</label>
                             <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                                {/* Start Date Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-600">INÍCIO:</span>
                                    <select 
                                        className="border rounded p-1.5 text-sm bg-white"
                                        value={isImmediate ? 'IMEDIATO' : startFortnight}
                                        onChange={(e) => {
                                            if (e.target.value === 'IMEDIATO') setIsImmediate(true);
                                            else {
                                                setIsImmediate(false);
                                                setStartFortnight(e.target.value as any);
                                            }
                                        }}
                                    >
                                        <option value="IMEDIATO">Imediato</option>
                                        <option value="1">1ª Quinzena</option>
                                        <option value="2">2ª Quinzena</option>
                                    </select>
                                    {!isImmediate && (
                                        <>
                                            <select 
                                                className="border rounded p-1.5 text-sm bg-white"
                                                value={startMonth}
                                                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                                            >
                                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>
                                            <select 
                                                className="border rounded p-1.5 text-sm bg-white"
                                                value={startYear}
                                                onChange={(e) => setStartYear(parseInt(e.target.value))}
                                            >
                                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </>
                                    )}
                                </div>

                                <span className="text-slate-400">Até</span>

                                {/* End Date Selector */}
                                 <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-600">FIM:</span>
                                    <select 
                                        className="border rounded p-1.5 text-sm bg-white"
                                        value={endFortnight}
                                        onChange={(e) => setEndFortnight(e.target.value as any)}
                                    >
                                        <option value="1">1ª Quinzena</option>
                                        <option value="2">2ª Quinzena</option>
                                    </select>
                                    <select 
                                        className="border rounded p-1.5 text-sm bg-white"
                                        value={endMonth}
                                        onChange={(e) => setEndMonth(parseInt(e.target.value))}
                                    >
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                    <select 
                                        className="border rounded p-1.5 text-sm bg-white"
                                        value={endYear}
                                        onChange={(e) => setEndYear(parseInt(e.target.value))}
                                    >
                                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                             </div>
                        </div>
                    </div>
                </section>

                {/* 4. Observations */}
                <section className="pt-4 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Observações do Contrato</label>
                    <textarea 
                        className="w-full border rounded-lg p-3 h-24" 
                        placeholder="Detalhes adicionais, instruções de pagamento, qualidade..."
                        value={formData.observation || ''}
                        onChange={(e) => setFormData({...formData,observation: e.target.value})}
                    ></textarea>
                </section>
                
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl sticky bottom-0">
                    <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Cancelar</button>
                    <button onClick={handleSave} disabled={isLoading} className="px-5 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-sm flex items-center">
                        {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>}
                        Salvar Contrato
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
