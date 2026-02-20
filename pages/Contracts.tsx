
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Filter, Download, FileSpreadsheet, Lock, Unlock, Edit2, Share2, CheckCircle, FileText, Calendar, MapPin, DollarSign, Truck, Calculator, Eye, Printer, X, Sprout, FileBarChart, Settings2, FileDown, Send, Banknote } from 'lucide-react';
import { Contract, PricingMode, ContractStatus, MarketData, Producer, Buyer, FreightType, BankAccount } from '../types';
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

// --- COMPONENTE DE IMPRESSÃO ISOLADO (IFRAME) ---
interface PrintIsolationProps {
    children?: React.ReactNode;
    onClose: () => void;
    title: string;
}

const PrintIsolation = ({ children, onClose, title }: PrintIsolationProps) => {
    const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null);
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        if (!contentRef) return;
        const doc = contentRef.contentWindow?.document;
        if (!doc) return;

        // Configurar o documento do iframe
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Inter', sans-serif; background: white; margin: 0; padding: 0; }
                    /* Forçar ajustes de impressão */
                    @media print {
                        @page { size: A4; margin: 0; }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    /* Esconder scrollbar no print preview */
                    ::-webkit-scrollbar { width: 0px; background: transparent; }
                </style>
            </head>
            <body><div id="print-mount"></div></body>
            </html>
        `);
        doc.close();

        // Aguardar o mount point existir
        const mount = doc.getElementById('print-mount');
        setMountNode(mount);

        // Disparar impressão após carregar estilos (Delay seguro para o CDN do Tailwind)
        const timer = setTimeout(() => {
            contentRef.contentWindow?.focus();
            contentRef.contentWindow?.print();
        }, 1500);

        return () => clearTimeout(timer);
    }, [contentRef, title]);

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 text-white">
                <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5" />
                    <span className="font-bold">Visualização de Impressão / PDF</span>
                </div>
                <button 
                    onClick={onClose}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                    <X className="w-4 h-4" /> Fechar
                </button>
            </div>
            
            <iframe 
                ref={setContentRef}
                className="bg-white w-full max-w-[210mm] h-[80vh] shadow-2xl rounded-sm"
                title="Print Frame"
            />
            
            {mountNode && createPortal(children, mountNode)}
            
            <p className="text-white/50 text-xs mt-4">
                A janela de impressão abrirá automaticamente. Se não abrir, verifique bloqueadores de pop-up.
                Selecione "Salvar como PDF" no destino da impressão.
            </p>
        </div>
    );
};

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
      location: true, // Default true now based on feedback
      shipmentPeriod: true // Default true now based on feedback
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
      shipmentMonth: '',
      shipmentYear: ''
  });

  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  
  // NEW: Dedicated Printing State (Agora usa 'type' para saber se é relatório ou individual)
  const [printData, setPrintData] = useState<{ type: 'SINGLE' | 'REPORT', data: any } | null>(null);

  const [filter, setFilter] = useState('');
  
  // Mock Data Lists
  const [producersList, setProducersList] = useState<Producer[]>([]);
  const [buyersList, setBuyersList] = useState<Buyer[]>([]);
  
  // Custom Local State for Form Interaction
  const [isNewLocation, setIsNewLocation] = useState(false);
  const [availableLocations, setAvailableLocations] = useState<{name: string, id?: string}[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<BankAccount[]>([]);

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
  const handlePrintContract = (contract: Contract) => {
    setPrintData({ type: 'SINGLE', data: contract });
  };
  
  const handlePdf = (contract: Contract) => {
    setPrintData({ type: 'SINGLE', data: contract });
  };
  
  const handlePrintReport = () => {
      setPrintData({ type: 'REPORT', data: reportData });
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
        
        // --- LOGIC TO RESTORE SAVED BANK ACCOUNT IN EDIT MODE ---
        let accounts = seller.bankDetails || [];
        
        // Se o contrato tem uma conta salva
        if (contract.sellerBankDetails) {
            // Verifica se essa conta exata existe na lista atual do produtor
            const isAccountPresent = accounts.some(acc => 
                acc.bankName === contract.sellerBankDetails?.bankName && 
                acc.account === contract.sellerBankDetails?.account
            );

            // Se não existir (ex: conta antiga ou produtor editado), adiciona ela na lista temporariamente
            // para que o Select consiga exibir o valor corretamente
            if (!isAccountPresent) {
                accounts = [contract.sellerBankDetails, ...accounts];
            }
        }
        setAvailableAccounts(accounts);

    } else {
        setAvailableLocations([]);
        setAvailableAccounts([]);
        setIsNewLocation(true);
    }
    
    setIsModalOpen(true);
  };

  // Helper para calcular safra atual dinamicamente
  const getCurrentCrop = () => {
      const today = new Date();
      const month = today.getMonth() + 1; // 1-12
      const year = today.getFullYear();
      const shortYear = year.toString().slice(-2);
      const nextShortYear = (year + 1).toString().slice(-2);
      const prevShortYear = (year - 1).toString().slice(-2);
      
      // Se estamos no segundo semestre, geralmente já negociamos a safra seguinte (plantio)
      // Se estamos no primeiro semestre, estamos na colheita da safra plantada no ano anterior
      if (month >= 7) {
          return `${shortYear}/${nextShortYear}`;
      } else {
          return `${prevShortYear}/${shortYear}`;
      }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    
    const defaultCrop = getCurrentCrop();
    const newNumber = await generateContractNumber('SOJA', defaultCrop);
    
    setIsLoading(false);

    setEditingContract(null);
    setFormData({
      number: newNumber,
      pricingMode: PricingMode.FIXED,
      product: 'SOJA',
      crop: defaultCrop,
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
    setAvailableAccounts([]);
    setIsNewLocation(false);
    setIsModalOpen(true);
  };

  const handleSellerChange = (sellerName: string) => {
    const seller = producersList.find(p => p.name === sellerName);
    // AUTO LINK BY DOCUMENT
    setFormData({...formData, sellerName, sellerDoc: seller?.doc, sellerBankDetails: undefined});
    
    if (seller) {
        const locations = seller.farms.map(f => ({name: f.name, id: f.id}));
        setAvailableLocations(locations);
        
        // Load Banks
        const banks = seller.bankDetails || [];
        setAvailableAccounts(banks);
        
        // Auto select first bank if exists
        const defaultBank = banks.length > 0 ? banks[0] : undefined;
        
        if (locations.length > 0) {
            setFormData(prev => ({
                ...prev, 
                sellerName, 
                sellerDoc: seller.doc, 
                pickupLocation: locations[0].name,
                sellerBankDetails: defaultBank
            }));
            setIsNewLocation(false);
        } else {
            setIsNewLocation(true);
            setFormData(prev => ({
                ...prev, 
                sellerName, 
                sellerDoc: seller.doc, 
                pickupLocation: '',
                sellerBankDetails: defaultBank
            }));
        }
    } else {
        setAvailableLocations([]);
        setAvailableAccounts([]);
    }
  };

  const handleBuyerChange = (buyerName: string) => {
      const buyer = buyersList.find(b => b.name === buyerName);
      // AUTO LINK BY DOCUMENT
      setFormData({...formData, buyerName, buyerDoc: buyer?.doc});
  };

  const handleProductChange = async (newProduct: 'SOJA' | 'MILHO' | 'TRIGO') => {
      // Usar a safra que está no formulário, ou a padrão se estiver vazia
      const currentCrop = formData.crop || getCurrentCrop();
      
      setFormData(prev => ({...prev, product: newProduct}));
      
      // Generate new number based on product AND current crop
      const newNum = await generateContractNumber(newProduct, currentCrop);
      setFormData(prev => ({...prev, number: newNum}));
  };
  
  // Atualizar número do contrato quando a Safra muda (no onBlur)
  const handleCropChangeBlur = async (newCrop: string) => {
      if (!newCrop || !formData.product) return;
      setIsLoading(true);
      const newNum = await generateContractNumber(formData.product as string, newCrop);
      setFormData(prev => ({...prev, number: newNum}));
      setIsLoading(false);
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
      sellerBankDetails: formData.sellerBankDetails, // Saves selected account
      status: formData.status as ContractStatus,
      createdAt: editingContract?.createdAt || new Date().toISOString()
    };

    try {
        await saveContract(finalContract);
        await onUpdate(); // Refresh global list
        setIsLoading(false);
        setIsModalOpen(false);
    } catch (error: any) {
        console.error("Failed to save contract", error);
        alert(`Erro ao salvar contrato: ${error.message || 'Erro desconhecido'}`);
        setIsLoading(false);
    }
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

  // --- RENDERERS FOR PRINTING ---
  
  const ContractDocument = ({ contract }: { contract: Contract }) => {
    const seller = getFullSeller(contract.sellerName);
    const buyer = getFullBuyer(contract.buyerName);

    // Use stored bank details or fallback to first available from producer
    const bank = contract.sellerBankDetails || (seller?.bankDetails && seller.bankDetails.length > 0 ? seller.bankDetails[0] : undefined);

    return (
        <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[10mm] mx-auto text-black font-sans text-[11px] leading-tight">
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
                        <div><span className="font-bold">Banco:</span> {bank?.bankName || '-'}</div>
                        <div><span className="font-bold">Ag:</span> {bank?.agency || '-'}</div>
                        <div><span className="font-bold">C.C.:</span> {bank?.account || '-'}</div>
                    </div>
                    <div className="grid grid-cols-[80px_1fr_120px_1fr]">
                        <span className="font-bold">Favorecido:</span> <span className="uppercase">{bank?.holder || '-'}</span>
                        <span className="font-bold text-right pr-2">CPF / CNPJ:</span> <span>{bank?.holderDoc || '-'}</span>
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
                type="text" 
                placeholder="Buscar por número, vendedor ou comprador..." 
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <button 
                onClick={handlePrintReport}
                className="flex items-center px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors text-sm font-medium"
            >
                <FileBarChart className="w-4 h-4 mr-2" />
                Relatório
            </button>
            <button 
                onClick={handleCreate}
                disabled={isLoading}
                className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
                <Plus className="w-4 h-4 mr-2" />
                Novo Contrato
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
                    <tr>
                        <th className="px-6 py-4">Número</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Safra / Produto</th>
                        <th className="px-6 py-4">Vendedor</th>
                        <th className="px-6 py-4 text-right">Volume</th>
                        <th className="px-6 py-4 text-right">Preço</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredContracts.map(contract => (
                        <tr key={contract.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-700">{contract.number}</td>
                            <td className="px-6 py-4">
                                {new Date(contract.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2 ${
                                    contract.product === 'SOJA' ? 'bg-green-100 text-green-800' :
                                    contract.product === 'MILHO' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-amber-100 text-amber-800'
                                }`}>
                                    {contract.product}
                                </span>
                                <span className="text-xs text-slate-500">{contract.crop}</span>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900">{contract.sellerName}</td>
                            <td className="px-6 py-4 text-right">
                                <div className="font-bold text-slate-700">{contract.totalBags.toLocaleString()} scs</div>
                                <div className="text-xs text-slate-400">{contract.totalTons.toLocaleString()} ton</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="font-bold text-emerald-700">R$ {contract.finalPrice.toFixed(2)}</div>
                                <div className="text-xs text-slate-400">
                                    {contract.isFixed ? 'Fixado' : 'A Fixar'}
                                </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    contract.status === ContractStatus.SIGNED ? 'bg-emerald-100 text-emerald-800' :
                                    contract.status === ContractStatus.AWAITING_SIGNATURE ? 'bg-amber-100 text-amber-800' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {contract.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => handlePrintContract(contract)} className="p-1 text-slate-400 hover:text-slate-600" title="Imprimir"><Printer className="w-4 h-4" /></button>
                                    <button onClick={() => handleEdit(contract)} className="p-1 text-slate-400 hover:text-emerald-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleSendLink(contract)} className="p-1 text-slate-400 hover:text-blue-600" title="Enviar Link"><Send className="w-4 h-4" /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredContracts.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                                Nenhum contrato encontrado com os filtros atuais.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
        
      {/* --- MODAL EDIT/CREATE --- */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-center p-6 border-b border-slate-200">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-6 h-6 text-emerald-600" />
                                {editingContract ? `Editar Contrato ${formData.number}` : 'Novo Contrato'}
                            </h2>
                            <p className="text-sm text-slate-500">Preencha os dados do negócio.</p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                  </div>
                  
                  {/* Content - Scrollable */}
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50">
                      
                      {/* Section 1: Basic Info */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase"><FileText className="w-4 h-4 text-slate-400"/> Dados Gerais</h3>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número</label>
                                  <input type="text" disabled value={formData.number || ''} className="w-full bg-slate-100 border border-slate-300 rounded p-2 text-slate-600 cursor-not-allowed" />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Negócio</label>
                                  <input type="date" value={formData.closingDate || ''} onChange={(e) => setFormData({...formData, closingDate: e.target.value})} className="w-full border border-slate-300 rounded p-2" />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Produto</label>
                                  <select value={formData.product} onChange={(e) => handleProductChange(e.target.value as any)} className="w-full border border-slate-300 rounded p-2 bg-white">
                                      <option value="SOJA">SOJA</option>
                                      <option value="MILHO">MILHO</option>
                                      <option value="TRIGO">TRIGO</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Safra</label>
                                  <input 
                                    type="text" 
                                    value={formData.crop || ''} 
                                    onChange={(e) => setFormData({...formData, crop: e.target.value})} 
                                    onBlur={(e) => handleCropChangeBlur(e.target.value)}
                                    className="w-full border border-slate-300 rounded p-2" 
                                    placeholder="Ex: 24/25" 
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Section 2: Parties */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase"><Sprout className="w-4 h-4 text-slate-400"/> Participantes</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendedor (Produtor)</label>
                                    <input 
                                        list="producers" 
                                        className="w-full border border-slate-300 rounded p-2" 
                                        placeholder="Buscar Produtor..."
                                        value={formData.sellerName || ''}
                                        onChange={(e) => handleSellerChange(e.target.value)}
                                    />
                                    <datalist id="producers">
                                        {producersList.map(p => <option key={p.id} value={p.name} />)}
                                    </datalist>
                                    {formData.sellerDoc && <p className="text-xs text-slate-400 mt-1">CPF/CNPJ: {formData.sellerDoc}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comprador</label>
                                    <input 
                                        list="buyers" 
                                        className="w-full border border-slate-300 rounded p-2" 
                                        placeholder="Buscar Comprador..."
                                        value={formData.buyerName || ''}
                                        onChange={(e) => handleBuyerChange(e.target.value)}
                                    />
                                    <datalist id="buyers">
                                        {buyersList.map(b => <option key={b.id} value={b.name} />)}
                                    </datalist>
                                     {formData.buyerDoc && <p className="text-xs text-slate-400 mt-1">CNPJ: {formData.buyerDoc}</p>}
                                </div>
                           </div>
                      </div>

                      {/* Section 3: Logistics */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase"><Truck className="w-4 h-4 text-slate-400"/> Logística e Entrega</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Volume (Sacas)</label>
                                  <input type="number" value={formData.totalBags || ''} onChange={(e) => handleVolumeChange(e.target.value, 'BAGS')} className="w-full border border-slate-300 rounded p-2" />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Volume (Toneladas)</label>
                                  <input type="number" value={formData.totalTons || ''} onChange={(e) => handleVolumeChange(e.target.value, 'TONS')} className="w-full border border-slate-300 rounded p-2" />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Modalidade</label>
                                  <select value={formData.freightType} onChange={(e) => setFormData({...formData, freightType: e.target.value as any})} className="w-full border border-slate-300 rounded p-2 bg-white">
                                      <option value="FOB">FOB (Retira)</option>
                                      <option value="CIF">CIF (Entrega)</option>
                                  </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Local de Embarque / Retirada</label>
                                    {isNewLocation ? (
                                        <div className="flex gap-2">
                                            <input type="text" className="w-full border border-slate-300 rounded p-2" placeholder="Digite o local..." value={formData.pickupLocation || ''} onChange={(e) => setFormData({...formData, pickupLocation: e.target.value})} />
                                            {availableLocations.length > 0 && (
                                                <button onClick={() => setIsNewLocation(false)} className="whitespace-nowrap px-3 py-2 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600">
                                                    Selecionar Existente
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <select 
                                                className="w-full border border-slate-300 rounded p-2 bg-white" 
                                                value={formData.pickupLocation || ''} 
                                                onChange={(e) => {
                                                    if(e.target.value === 'NEW') setIsNewLocation(true);
                                                    else setFormData({...formData, pickupLocation: e.target.value});
                                                }}
                                            >
                                                <option value="">Selecione...</option>
                                                {availableLocations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                                <option value="NEW">+ Outro Local</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <hr className="border-slate-100 my-4" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Início do Embarque</label>
                                    <div className="flex items-center gap-2 mb-2">
                                        <input type="checkbox" id="immediate" checked={isImmediate} onChange={(e) => setIsImmediate(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                        <label htmlFor="immediate" className="text-sm text-slate-700">Imediato</label>
                                    </div>
                                    {!isImmediate && (
                                        <div className="flex gap-2">
                                            <select value={startFortnight} onChange={(e) => setStartFortnight(e.target.value as any)} className="border rounded p-2 text-sm bg-white">
                                                <option value="1">1ª Quinzena</option>
                                                <option value="2">2ª Quinzena</option>
                                            </select>
                                            <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="border rounded p-2 text-sm bg-white flex-1">
                                                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                            </select>
                                            <select value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} className="border rounded p-2 text-sm bg-white w-24">
                                                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Fim do Embarque</label>
                                    <div className="h-[28px] mb-2"></div> {/* Spacer to align with checkbox */}
                                    <div className="flex gap-2">
                                        <select value={endFortnight} onChange={(e) => setEndFortnight(e.target.value as any)} className="border rounded p-2 text-sm bg-white">
                                            <option value="1">1ª Quinzena</option>
                                            <option value="2">2ª Quinzena</option>
                                        </select>
                                        <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="border rounded p-2 text-sm bg-white flex-1">
                                            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                        </select>
                                        <select value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} className="border rounded p-2 text-sm bg-white w-24">
                                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                      </div>

                      {/* Section 4: Pricing */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase"><DollarSign className="w-4 h-4 text-slate-400"/> Preço e Pagamento</h3>
                           
                           <div className="flex gap-4 mb-6 bg-slate-50 p-2 rounded-lg w-fit">
                               <button 
                                  onClick={() => setFormData({...formData, pricingMode: PricingMode.FIXED, isFixed: true})}
                                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${formData.pricingMode === PricingMode.FIXED ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
                               >
                                   Preço Fixo
                               </button>
                               <button 
                                  onClick={() => setFormData({...formData, pricingMode: PricingMode.COMPONENTS, isFixed: false})}
                                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${formData.pricingMode === PricingMode.COMPONENTS ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
                               >
                                   A Fixar (Componentes)
                               </button>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {formData.pricingMode === PricingMode.FIXED ? (
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Fixo (R$/sc)</label>
                                        <input type="number" step="0.01" value={formData.basePrice || ''} onChange={(e) => setFormData({...formData, basePrice: Number(e.target.value), isFixed: true})} className="w-full border border-slate-300 rounded p-2 text-lg font-bold text-slate-800" />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CBOT (¢/bu)</label>
                                            <input type="number" step="0.01" value={formData.cbotComponent || ''} onChange={(e) => setFormData({...formData, cbotComponent: Number(e.target.value)})} className="w-full border border-slate-300 rounded p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Basis (pts)</label>
                                            <input type="number" step="0.01" value={formData.basisComponent || ''} onChange={(e) => setFormData({...formData, basisComponent: Number(e.target.value)})} className="w-full border border-slate-300 rounded p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dólar (R$)</label>
                                            <input type="number" step="0.0001" value={formData.exchangeRate || ''} onChange={(e) => setFormData({...formData, exchangeRate: Number(e.target.value)})} className="w-full border border-slate-300 rounded p-2" />
                                        </div>
                                    </>
                                )}
                                <div className="col-span-1 bg-slate-50 p-4 rounded border border-slate-200">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Preço Final Calculado</p>
                                    <p className="text-2xl font-bold text-emerald-700 mt-1">R$ {calculatedPrice.toFixed(2)}</p>
                                    <p className="text-xs text-slate-400">por saca</p>
                                </div>
                           </div>

                           <hr className="border-slate-100 my-6" />

                           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Pagamento</label>
                                    <input type="date" value={formData.paymentDate || ''} onChange={(e) => setFormData({...formData, paymentDate: e.target.value})} className="w-full border border-slate-300 rounded p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comissão (R$/sc)</label>
                                    <input type="number" step="0.01" value={formData.commissionPerBag || ''} onChange={(e) => setFormData({...formData, commissionPerBag: Number(e.target.value)})} className="w-full border border-slate-300 rounded p-2" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Conta para Pagamento</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded p-2 bg-white"
                                        value={formData.sellerBankDetails ? JSON.stringify(formData.sellerBankDetails) : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData({...formData, sellerBankDetails: val ? JSON.parse(val) : undefined});
                                        }}
                                    >
                                        <option value="">Selecione a conta...</option>
                                        {availableAccounts.map((acc, i) => (
                                            <option key={i} value={JSON.stringify(acc)}>
                                                {acc.bankName} - {acc.account}
                                            </option>
                                        ))}
                                    </select>
                                    {availableAccounts.length === 0 && <p className="text-xs text-red-400 mt-1">Nenhuma conta cadastrada para este produtor.</p>}
                                </div>
                           </div>
                      </div>
                      
                      {/* Section 5: Observations */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                           <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase"><FileText className="w-4 h-4 text-slate-400"/> Observações</h3>
                           <textarea 
                                className="w-full border border-slate-300 rounded p-3 h-24 text-sm" 
                                placeholder="Observações adicionais do contrato..."
                                value={formData.observation || ''}
                                onChange={(e) => setFormData({...formData, observation: e.target.value})}
                           />
                      </div>

                  </div>
                  
                  {/* Footer Actions */}
                  <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-50 rounded font-medium border border-transparent hover:border-slate-200">
                          Cancelar
                      </button>
                      <button onClick={handleSave} disabled={isLoading} className="px-6 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 shadow-sm flex items-center gap-2 disabled:opacity-50">
                          {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                          Salvar Contrato
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- PRINT PREVIEW --- */}
      {printData && (
          <PrintIsolation onClose={() => setPrintData(null)} title={printData.type === 'SINGLE' ? `Contrato ${printData.data.number}` : 'Relatório de Contratos'}>
              {printData.type === 'SINGLE' ? (
                  <ContractDocument contract={printData.data} />
              ) : (
                  <div className="bg-white p-8 w-[297mm] min-h-[210mm] mx-auto">
                      <div className="flex justify-between items-center mb-6 border-b-2 border-slate-800 pb-4">
                           <div className="flex items-center gap-4">
                                <img src={LOGO_URL} alt="Logo" className="h-12 w-auto" />
                                <div>
                                    <h1 className="text-xl font-bold uppercase text-slate-900">{getReportTitle()}</h1>
                                    <p className="text-sm text-slate-500">Emitido em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
                                </div>
                           </div>
                      </div>
                      <table className="w-full text-xs text-left border-collapse">
                          <thead>
                              <tr className="bg-slate-100 border-b border-slate-300">
                                  <th className="p-2 border">Data</th>
                                  <th className="p-2 border">Número</th>
                                  <th className="p-2 border">Vendedor</th>
                                  <th className="p-2 border">Comprador</th>
                                  <th className="p-2 border text-right">Sacas</th>
                                  <th className="p-2 border text-right">Preço</th>
                                  <th className="p-2 border">Local Retirada</th>
                              </tr>
                          </thead>
                          <tbody>
                              {(printData.data as Contract[]).map((c, i) => (
                                  <tr key={i} className="border-b border-slate-200">
                                      <td className="p-2 border">{new Date(c.createdAt).toLocaleDateString()}</td>
                                      <td className="p-2 border font-bold">{c.number}</td>
                                      <td className="p-2 border truncate max-w-[150px]">{c.sellerName}</td>
                                      <td className="p-2 border truncate max-w-[150px]">{c.buyerName}</td>
                                      <td className="p-2 border text-right">{c.totalBags.toLocaleString()}</td>
                                      <td className="p-2 border text-right">{c.finalPrice.toFixed(2)}</td>
                                      <td className="p-2 border truncate max-w-[150px]">{c.pickupLocation}</td>
                                  </tr>
                              ))}
                          </tbody>
                          <tfoot>
                              <tr className="bg-slate-50 font-bold border-t-2 border-slate-800">
                                  <td colSpan={4} className="p-2 text-right">TOTAIS:</td>
                                  <td className="p-2 text-right">{(printData.data as Contract[]).reduce((sum, c) => sum + c.totalBags, 0).toLocaleString()}</td>
                                  <td colSpan={2}></td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>
              )}
          </PrintIsolation>
      )}
    </div>
  );
};
