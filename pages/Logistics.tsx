import React, { useState, useEffect, createRef } from 'react';
import { Truck, Scale, Plus, AlertTriangle, CalendarClock, CheckCircle2, FileText, Printer, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Contract, Shipment } from '../types';
import { addShipment, markPromissoryNoteIssued, generatePromissoryNumber, getBuyers } from '../services/mockService';

interface LogisticsProps {
  contracts: Contract[];
  shipments: Shipment[];
  onUpdate: () => void;
}

const LOGO_URL = 'https://i.postimg.cc/8CmMzM9c/LOGO-DMS-SF.png';

const daysUntil = (dateStr: string): number => {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  DATA_FIXA: 'Data Fixa',
  SOB_RODAS: 'Sob Rodas',
  POS_RETIRADA: 'Pós Retirada',
};

// --- Componente de impressão da NP ---
// --- Utilitário: valor por extenso em BRL ---
const valorPorExtenso = (valor: number): string => {
  const inteiros = Math.floor(valor);
  const centavos = Math.round((valor - inteiros) * 100);

  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const numToWords = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return dezenas[d] + (u ? ' e ' + unidades[u] : '');
    }
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return centenas[c] + (resto ? ' e ' + numToWords(resto) : '');
  };

  const milhoes = Math.floor(inteiros / 1000000);
  const milhares = Math.floor((inteiros % 1000000) / 1000);
  const resto = inteiros % 1000;

  let partes: string[] = [];
  if (milhoes > 0) partes.push(numToWords(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões'));
  if (milhares > 0) partes.push(numToWords(milhares) + ' mil');
  if (resto > 0) partes.push(numToWords(resto));

  const inteirosPorExtenso = partes.join(' e ') || 'zero';
  const sufixo = inteiros === 1 ? 'real' : 'reais';

  if (centavos === 0) return `${inteirosPorExtenso} ${sufixo}`;
  const centavosSufixo = centavos === 1 ? 'centavo' : 'centavos';
  return `${inteirosPorExtenso} ${sufixo} e ${numToWords(centavos)} ${centavosSufixo}`;
};

const dataPorExtenso = (date: Date): string => {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
};

interface PromissoryPrintProps {
  shipments: Shipment[];
  contract: Contract & { buyerPartners?: any[] };
  noteNumber: string;
  onClose: () => void;
}

const PromissoryNotePrint: React.FC<PromissoryPrintProps> = ({ shipments, contract, noteNumber, onClose }) => {
  const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const totalWeightKg = shipments.reduce((sum, s) => sum + s.weightKg, 0);
  const totalBags = shipments.reduce((sum, s) => sum + s.bagsCount, 0);
  const totalValue = totalBags * (contract.finalPrice || 0);
  const currency = contract.currency === 'USD' ? 'US$' : 'R$';
  const bank = contract.sellerBankDetails;

  const latestDueDate = shipments.reduce((max, s) =>
    (s.paymentDueDate && s.paymentDueDate > max) ? s.paymentDueDate : max,
    shipments[0]?.paymentDueDate || ''
  );

  const dueDateFormatted = latestDueDate
    ? new Date(latestDueDate + 'T00:00:00').toLocaleDateString('pt-BR')
    : '-';

  const embarqueDates = [...new Set(shipments.map(s =>
    new Date(s.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')
  ))].join(', ');

  const hoje = new Date();

  const npContent = (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', padding: '15mm', background: 'white', color: 'black', maxWidth: '210mm', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid black', paddingBottom: '8px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '2px' }}>NOTA PROMISSÓRIA</h1>
        <p style={{ margin: 0, fontSize: '11px' }}>
          Carregamentos Unificados – Confirmação de Negócio nº {contract.number} – DMS Agro
        </p>
      </div>

      {/* Linha de valores */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', padding: '6px 0', borderBottom: '1px solid #ccc' }}>
        <span><strong>Nº {noteNumber}</strong></span>
        <span><strong>VALOR TOTAL: {currency} {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
        <span>Vencimento: {dueDateFormatted}</span>
        <span>Local de emissão: Palmas/TO</span>
      </div>

      {/* Corpo do texto */}
      <p style={{ textAlign: 'justify', marginBottom: '16px', lineHeight: '1.6' }}>
        Pagaremos por esta <strong>NOTA PROMISSÓRIA</strong>, a <strong>{contract.sellerName}</strong>, CPF nº <strong>{contract.sellerDoc || '-'}</strong>, ou à sua ordem, a quantia total de <strong>{currency} {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({valorPorExtenso(totalValue)})</strong>, em moeda corrente nacional, referente aos carregamentos de {contract.product.toLowerCase()} em grãos realizados em {embarqueDates}, detalhados na tabela abaixo, conforme Confirmação de Negócio nº {contract.number} – DMS Agro, safra {contract.crop}. O pagamento deverá ser realizado em até {contract.paymentDays} ({contract.paymentDays === 1 ? 'um' : contract.paymentDays === 2 ? 'dois' : contract.paymentDays === 3 ? 'três' : contract.paymentDays === 7 ? 'sete' : String(contract.paymentDays)}) dias corridos após o embarque, com vencimento em {dueDateFormatted}, em favor do beneficiário: {bank?.bankName || '-'}, Ag: {bank?.agency || '-'}, C/C: {bank?.account || '-'}, favorecido: {bank?.holder || contract.sellerName}, CPF: {bank?.holderDoc || contract.sellerDoc || '-'}. A dívida ora reconhecida é de responsabilidade de <strong>{contract.buyerName}</strong>, CNPJ nº <strong>{contract.buyerDoc || '-'}</strong>, sendo esta nota emitida pelos devedores solidários abaixo identificados.
      </p>

      {/* Tabela de carregamentos */}
      <p style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>DETALHAMENTO DOS CARREGAMENTOS:</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'left' }}>Data Embarque</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'left' }}>Placa</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'left' }}>Romaneio</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>Peso Líq. (kg)</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>Valor ({currency})</th>
            <th style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center' }}>Vencimento</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s, i) => (
            <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={{ border: '1px solid black', padding: '4px 6px' }}>{new Date(s.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td style={{ border: '1px solid black', padding: '4px 6px', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.plate}</td>
              <td style={{ border: '1px solid black', padding: '4px 6px' }}>{s.ticketNumber}</td>
              <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>{s.weightKg.toLocaleString('pt-BR')}</td>
              <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>{currency} {(s.bagsCount * (contract.finalPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'center' }}>{s.paymentDueDate ? new Date(s.paymentDueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e8e8e8', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>TOTAL</td>
            <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>{totalWeightKg.toLocaleString('pt-BR')}</td>
            <td style={{ border: '1px solid black', padding: '4px 6px', textAlign: 'right' }}>{currency} {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style={{ border: '1px solid black', padding: '4px 6px' }}></td>
          </tr>
        </tfoot>
      </table>

      {/* Devedor Principal */}
      <p style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>DEVEDOR PRINCIPAL:</p>
      <div style={{ marginBottom: '16px', fontSize: '11px', lineHeight: '1.8' }}>
        <p style={{ margin: '0' }}><strong>Empresa:</strong> {contract.buyerName}</p>
        <p style={{ margin: '0' }}><strong>CNPJ:</strong> {contract.buyerDoc || '-'}</p>
        <p style={{ margin: '0' }}><strong>Ref. Contrato:</strong> Confirmação de Negócio nº {contract.number} – DMS Agro</p>
      </div>

      {/* Emitentes / Devedores Solidários */}
      {contract.buyerPartners && contract.buyerPartners.length > 0 && (
        <>
          <p style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>EMITENTES / DEVEDORES SOLIDÁRIOS:</p>
          <div style={{ marginBottom: '16px' }}>
            {contract.buyerPartners.map((partner: any, i: number) => (
              <div key={i} style={{ marginBottom: '8px', fontSize: '11px', lineHeight: '1.8' }}>
                <p style={{ margin: '0' }}><strong>Nome:</strong> {partner.name}</p>
                <p style={{ margin: '0' }}><strong>CPF:</strong> {partner.cpf}{partner.rg ? <span> &nbsp;&nbsp;<strong>RG:</strong> {partner.rg}</span> : ''}</p>
                {partner.address && <p style={{ margin: '0' }}><strong>Endereço:</strong> {partner.address}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sem protesto */}
      <p style={{ marginBottom: '24px', fontStyle: 'italic', fontSize: '10px' }}>
        Esta nota promissória é emitida sem protesto, na praça de Palmas/TO.
      </p>

      {/* Assinaturas */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(2, (contract.buyerPartners?.length || 0) + 2)}, 1fr)`, gap: '32px', marginTop: '32px', marginBottom: '24px' }}>

        {/* Devedor Principal: Comprador (empresa) */}
        <div style={{ borderTop: '1px solid black', paddingTop: '6px', textAlign: 'center', fontSize: '10px' }}>
          <p style={{ margin: '0', fontWeight: 'bold', textTransform: 'uppercase' }}>{contract.buyerName}</p>
          <p style={{ margin: '0', color: '#555' }}>CNPJ: {contract.buyerDoc || '-'}</p>
          <p style={{ margin: '0', color: '#555' }}>Devedor Principal</p>
        </div>

        {/* Devedores Solidários: sócios do comprador */}
        {(contract.buyerPartners || []).map((partner: any, i: number) => (
          <div key={i} style={{ borderTop: '1px solid black', paddingTop: '6px', textAlign: 'center', fontSize: '10px' }}>
            <p style={{ margin: '0', fontWeight: 'bold', textTransform: 'uppercase' }}>{partner.name}</p>
            <p style={{ margin: '0', color: '#555' }}>CPF: {partner.cpf}</p>
            {partner.rg && <p style={{ margin: '0', color: '#555' }}>RG: {partner.rg}</p>}
            <p style={{ margin: '0', color: '#777', fontSize: '9px' }}>Devedor Solidário</p>
          </div>
        ))}

        {/* Credor / Beneficiário: Vendedor */}
        <div style={{ borderTop: '1px solid black', paddingTop: '6px', textAlign: 'center', fontSize: '10px' }}>
          <p style={{ margin: '0', fontWeight: 'bold', textTransform: 'uppercase' }}>{contract.sellerName}</p>
          <p style={{ margin: '0', color: '#555' }}>CPF: {contract.sellerDoc || '-'}</p>
          <p style={{ margin: '0', color: '#555', fontStyle: 'italic' }}>Credor / Beneficiário</p>
        </div>

      </div>

      {/* Data e local */}
      <p style={{ textAlign: 'right', fontSize: '11px', marginTop: '16px' }}>
        Palmas/TO, {dataPorExtenso(hoje)}
      </p>
    </div>
  );

  useEffect(() => {
    if (!contentRef) return;
    const doc = contentRef.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>NP ${noteNumber} - Contrato ${contract.number}</title>
    <style>body{margin:0;padding:0;background:white;}@media print{@page{size:A4;margin:0;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
    </head><body><div id="np-mount"></div></body></html>`);
    doc.close();
    const mount = doc.getElementById('np-mount');
    setMountNode(mount);
    const timer = setTimeout(() => {
      const npNumber = noteNumber.replace('/', '-');
      const fileName = `NP_${npNumber}_${contract.buyerName}_${contract.sellerName}_${contract.product}`.toUpperCase();

      const originalTitle = document.title;

      // Altera o título do documento pai — isso define o nome sugerido do PDF
      document.title = fileName;

      // Altera também o título dentro do iframe
      if (contentRef.contentWindow?.document) {
        contentRef.contentWindow.document.title = fileName;
      }

      contentRef.contentWindow?.focus();
      contentRef.contentWindow?.print();

      // Aguarda o diálogo de impressão fechar antes de restaurar o título
      // O evento afterprint é o mais confiável para isso
      const restoreTitle = (origTitle: string) => {
        document.title = origTitle;
      };

      if (contentRef.contentWindow) {
        contentRef.contentWindow.addEventListener('afterprint', () => {
          restoreTitle(originalTitle);
        }, { once: true });
      }

      // Fallback: restaura após 30 segundos caso o evento não dispare
      setTimeout(() => {
        if (document.title === fileName) {
          document.title = originalTitle;
        }
      }, 30000);
    }, 1500);
    return () => clearTimeout(timer);
  }, [contentRef]);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 text-white">
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5" />
          <span className="font-bold">Nota Promissória Nº {noteNumber} — {shipments.length} embarque(s)</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
          <X className="w-4 h-4" /> Fechar
        </button>
      </div>
      <iframe ref={setContentRef} className="bg-white w-full max-w-[210mm] h-[80vh] shadow-2xl rounded-sm" title="NP Frame" />
      {mountNode && createPortal(npContent, mountNode)}
      <p className="text-white/50 text-xs mt-4">A janela de impressão abrirá automaticamente. Selecione "Salvar como PDF".</p>
    </div>
  );
};

// --- Componente principal ---
export const Logistics: React.FC<LogisticsProps> = ({ contracts, shipments, onUpdate }) => {
  const [selectedContractId, setSelectedContractId] = useState<string>(contracts[0]?.id || '');
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<Set<string>>(new Set());
  const [printNPData, setPrintNPData] = useState<{ shipments: Shipment[]; contract: Contract & { buyerPartners?: any[] }; noteNumber: string; onCloseFn: () => Promise<void> } | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [ticketData, setTicketData] = useState({ plate: '', ticketNumber: '', weightKg: 0, deliveryDate: today });

  const selectedContract = contracts.find(c => c.id === selectedContractId);
  const contractShipments = shipments.filter(s => s.contractId === selectedContractId);
  const isPosRetirada = selectedContract?.paymentType === 'POS_RETIRADA';

  // Embarques sem NP emitida (apenas para contratos Pós Retirada)
  const shipmentsWithoutNP = contractShipments.filter(s => !s.promissoryNoteIssued);
  const selectedCount = selectedShipmentIds.size;

  // Limpar seleção ao trocar de contrato
  const handleContractSelect = (id: string) => {
    setSelectedContractId(id);
    setSelectedShipmentIds(new Set());
  };

  const toggleShipmentSelection = (id: string) => {
    setSelectedShipmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedShipmentIds.size === shipmentsWithoutNP.length) {
      setSelectedShipmentIds(new Set());
    } else {
      setSelectedShipmentIds(new Set(shipmentsWithoutNP.map(s => s.id)));
    }
  };

  const handleGenerateNP = async () => {
    if (!selectedContract || selectedShipmentIds.size === 0) return;
    const selected = contractShipments.filter(s => selectedShipmentIds.has(s.id));
    const noteNumber = await generatePromissoryNumber();
    const ids = Array.from(selectedShipmentIds);

    // Busca os dados atuais do comprador para pegar os sócios
    const allBuyers = await getBuyers();
    const buyer = allBuyers.find(b => b.doc === selectedContract.buyerDoc || b.name === selectedContract.buyerName);
    const contractWithPartners = { ...selectedContract, buyerPartners: buyer?.partners || [] };

    // Marca no banco ANTES de abrir o print para não perder o registro caso o usuário feche o browser
    await markPromissoryNoteIssued(ids, noteNumber);

    // Abre o print — onUpdate só é chamado quando o usuário fechar a janela
    setPrintNPData({
      shipments: selected,
      contract: contractWithPartners as any,
      noteNumber,
      onCloseFn: async () => {
        await onUpdate();
        setSelectedShipmentIds(new Set());
      }
    });
  };

  const handleReprintNP = async (shipment: Shipment) => {
    if (!selectedContract || !shipment.promissoryNoteNumber) return;
    const allBuyers = await getBuyers();
    const buyer = allBuyers.find(b => b.doc === selectedContract.buyerDoc || b.name === selectedContract.buyerName);
    const contractWithPartners = { ...selectedContract, buyerPartners: buyer?.partners || [] };

    setPrintNPData({
      shipments: [shipment],
      contract: contractWithPartners as any,
      noteNumber: shipment.promissoryNoteNumber,
      onCloseFn: async () => { /* reimpressão não precisa atualizar dados */ }
    });
  };

  const getCriticalAlert = (contract: Contract, contractShips: Shipment[]) => {
    const pendingBags = contract.totalBags - contract.deliveredBags;
    if (pendingBags <= 0) return null;
    const nearDue = contractShips.find(s => {
      if (!s.paymentDueDate) return false;
      const days = daysUntil(s.paymentDueDate);
      return days >= 0 && days <= 7;
    });
    if (nearDue && nearDue.paymentDueDate) {
      return { days: daysUntil(nearDue.paymentDueDate), date: nearDue.paymentDueDate, pending: pendingBags };
    }
    return null;
  };

  const contractAlert = (contract: Contract) => {
    const ships = shipments.filter(s => s.contractId === contract.id);
    return getCriticalAlert(contract, ships);
  };

  const handleAddTicket = async () => {
    if (!selectedContract) return;
    setIsSubmitting(true);
    const bags = Math.floor(ticketData.weightKg / 60);
    const newShipment: Shipment = {
      id: Math.random().toString(36),
      contractId: selectedContract.id,
      plate: ticketData.plate,
      ticketNumber: ticketData.ticketNumber,
      weightKg: ticketData.weightKg,
      bagsCount: bags,
      date: new Date().toISOString(),
      deliveryDate: ticketData.deliveryDate,
    };
    await addShipment(newShipment, selectedContract);
    await onUpdate();
    setIsSubmitting(false);
    setShowAddTicket(false);
    setTicketData({ plate: '', ticketNumber: '', weightKg: 0, deliveryDate: today });
  };

  if (!selectedContract) return <div className="text-slate-500 p-8 text-center">Nenhum contrato disponível para logística.</div>;

  const selectedAlert = getCriticalAlert(selectedContract, contractShipments);
  const pendingBags = selectedContract.totalBags - selectedContract.deliveredBags;
  const progressPct = Math.min((selectedContract.deliveredBags / selectedContract.totalBags) * 100, 100);

  return (
    <>
      {printNPData && (
        <PromissoryNotePrint
          shipments={printNPData.shipments}
          contract={printNPData.contract}
          noteNumber={printNPData.noteNumber}
          onClose={async () => {
            await printNPData.onCloseFn();
            setPrintNPData(null);
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Truck className="w-5 h-5" /> Contratos</h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {contracts.map(contract => {
              const alert = contractAlert(contract);
              const pct = Math.min((contract.deliveredBags / contract.totalBags) * 100, 100);
              const isSelected = selectedContractId === contract.id;
              return (
                <button key={contract.id} onClick={() => handleContractSelect(contract.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : alert ? 'bg-red-50 border-red-300 hover:border-red-400' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 text-sm">{contract.number}</span>
                    <div className="flex items-center gap-1">
                      {alert && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                  <span className={`text-xs font-semibold ${alert ? 'text-red-600' : 'text-emerald-700'}`}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{contract.sellerName}</p>
                  {contract.paymentType && <p className="text-xs text-slate-400 mt-0.5">{PAYMENT_TYPE_LABEL[contract.paymentType]}</p>}
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${alert ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAlert && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-red-700 text-sm">Atenção: prazo de pagamento próximo</p>
                <p className="text-red-600 text-sm mt-0.5">
                  Faltam <strong>{selectedAlert.days} {selectedAlert.days === 1 ? 'dia' : 'dias'}</strong> para o pagamento previsto em{' '}
                  <strong>{new Date(selectedAlert.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong> e ainda há{' '}
                  <strong>{selectedAlert.pending.toLocaleString()} sacas</strong> pendentes de embarque.
                </p>
              </div>
            </div>
          )}

          {/* Card resumo */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Contrato {selectedContract.number}</h2>
                <p className="text-slate-500 text-sm mt-0.5">
                  {selectedContract.sellerName}<span className="mx-2">•</span>{selectedContract.product}
                  {selectedContract.paymentType && (
                    <><span className="mx-2">•</span><span className="text-slate-400">{PAYMENT_TYPE_LABEL[selectedContract.paymentType]}</span>
                    {selectedContract.paymentType === 'POS_RETIRADA' && selectedContract.paymentDays && <span className="text-slate-400"> ({selectedContract.paymentDays}d)</span>}</>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-500">Saldo a Embarcar</p>
                <p className={`text-2xl font-bold ${pendingBags <= 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {pendingBags <= 0 ? <span className="flex items-center gap-1 justify-end"><CheckCircle2 className="w-6 h-6" /> Concluído</span> : `${pendingBags.toLocaleString()} scs`}
                </p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full mb-4 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs uppercase text-slate-500 font-semibold">Volume Total</p>
                <p className="font-bold text-lg">{selectedContract.totalBags.toLocaleString()}</p>
                <p className="text-xs text-slate-400">sacas</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg text-emerald-700">
                <p className="text-xs uppercase text-emerald-600 font-semibold">Embarcado</p>
                <p className="font-bold text-lg">{selectedContract.deliveredBags.toLocaleString()}</p>
                <p className="text-xs text-emerald-500">sacas</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-xs uppercase text-slate-500 font-semibold">Viagens</p>
                <p className="font-bold text-lg">{contractShipments.length}</p>
                <p className="text-xs text-slate-400">tickets</p>
              </div>
            </div>
            {selectedContract.paymentType === 'DATA_FIXA' && selectedContract.paymentDate && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 border-t border-slate-100 pt-4">
                <CalendarClock className="w-4 h-4" />
                <span>Pagamento fixo em <strong className="text-slate-700">{new Date(selectedContract.paymentDate + 'T00:00:00').toLocaleDateString('pt-BR')}</strong></span>
              </div>
            )}
          </div>

          {/* Botão lançar ticket */}
          <button onClick={() => setShowAddTicket(!showAddTicket)}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
            <Plus className="w-5 h-5" /> Lançar Ticket de Pesagem
          </button>

          {/* Formulário novo embarque */}
          {showAddTicket && (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100">
              <h4 className="font-bold text-lg mb-4 text-slate-800">Novo Embarque</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Placa</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2 mt-1 uppercase" placeholder="ABC-1234"
                    value={ticketData.plate} onChange={(e) => setTicketData({ ...ticketData, plate: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Ticket Balança</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-2 mt-1" placeholder="Nº 9988"
                    value={ticketData.ticketNumber} onChange={(e) => setTicketData({ ...ticketData, ticketNumber: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Peso Líquido (Kg)</label>
                  <div className="relative">
                    <input type="number" className="w-full border border-slate-300 rounded-lg p-2 mt-1 pl-8" placeholder="0"
                      value={ticketData.weightKg || ''} onChange={(e) => setTicketData({ ...ticketData, weightKg: Number(e.target.value) })} />
                    <Scale className="w-4 h-4 text-slate-400 absolute left-2.5 top-4" />
                  </div>
                  {ticketData.weightKg > 0 && <p className="text-xs text-slate-400 mt-1">= {Math.floor(ticketData.weightKg / 60).toLocaleString()} sacas</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Data do Embarque</label>
                  <input type="date" className="w-full border border-slate-300 rounded-lg p-2 mt-1"
                    value={ticketData.deliveryDate} onChange={(e) => setTicketData({ ...ticketData, deliveryDate: e.target.value })} />
                  {selectedContract.paymentType && ticketData.deliveryDate && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {selectedContract.paymentType === 'SOB_RODAS' && `Pagamento previsto: ${new Date(ticketData.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                      {selectedContract.paymentType === 'POS_RETIRADA' && selectedContract.paymentDays && (() => {
                        const d = new Date(ticketData.deliveryDate);
                        d.setDate(d.getDate() + selectedContract.paymentDays!);
                        return `Pagamento previsto: ${d.toLocaleDateString('pt-BR')}`;
                      })()}
                      {selectedContract.paymentType === 'DATA_FIXA' && selectedContract.paymentDate && `Pagamento fixo: ${new Date(selectedContract.paymentDate + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddTicket(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                <button onClick={handleAddTicket} disabled={isSubmitting || !ticketData.plate || !ticketData.deliveryDate || ticketData.weightKg <= 0}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Confirmar Lançamento
                </button>
              </div>
            </div>
          )}

          {/* Histórico de embarques */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h4 className="font-bold text-slate-800">Histórico de Embarques</h4>
              {isPosRetirada && selectedCount > 0 && (
                <button onClick={handleGenerateNP}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                  <FileText className="w-4 h-4" />
                  Gerar NP ({selectedCount} embarque{selectedCount > 1 ? 's' : ''})
                </button>
              )}
            </div>
            {contractShipments.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Nenhum embarque registrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-slate-500 border-b border-slate-100">
                    <tr>
                      {isPosRetirada && (
                        <th className="px-4 py-3">
                          <input type="checkbox"
                            checked={shipmentsWithoutNP.length > 0 && selectedShipmentIds.size === shipmentsWithoutNP.length}
                            onChange={toggleSelectAll}
                            className="rounded text-blue-600"
                            title="Selecionar todos sem NP"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 font-medium">Data Embarque</th>
                      <th className="px-4 py-3 font-medium">Placa</th>
                      <th className="px-4 py-3 font-medium">Ticket</th>
                      <th className="px-4 py-3 font-medium text-right">Sacas</th>
                      <th className="px-4 py-3 font-medium text-right">Pgto Previsto</th>
                      {isPosRetirada && <th className="px-4 py-3 font-medium text-center">NP</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {contractShipments.map(s => {
                      const dueDays = s.paymentDueDate ? daysUntil(s.paymentDueDate) : null;
                      const isUrgent = dueDays !== null && dueDays >= 0 && dueDays <= 7;
                      const isOverdue = dueDays !== null && dueDays < 0;
                      const isChecked = selectedShipmentIds.has(s.id);
                      const canSelect = isPosRetirada && !s.promissoryNoteIssued;

                      return (
                        <tr key={s.id} className={`${isUrgent ? 'bg-red-50' : ''} ${isChecked ? 'bg-blue-50' : ''}`}>
                          {isPosRetirada && (
                            <td className="px-4 py-3">
                              {canSelect ? (
                                <input type="checkbox" checked={isChecked} onChange={() => toggleShipmentSelection(s.id)} className="rounded text-blue-600" />
                              ) : (
                                <span className="w-4 h-4 block" />
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-slate-600">{new Date(s.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">{s.plate}</td>
                          <td className="px-4 py-3 text-slate-600">{s.ticketNumber}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">{s.bagsCount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {s.paymentDueDate ? (
                              <span className={`font-medium ${isOverdue ? 'text-slate-400' : isUrgent ? 'text-red-600' : 'text-slate-600'}`}>
                                {isUrgent && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                {new Date(s.paymentDueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                {isUrgent && dueDays !== null && <span className="text-xs block text-red-500">{dueDays === 0 ? 'Hoje' : `${dueDays}d`}</span>}
                              </span>
                            ) : <span className="text-slate-300">-</span>}
                          </td>
                          {isPosRetirada && (
                            <td className="px-4 py-3 text-center">
                              {s.promissoryNoteIssued ? (
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {s.promissoryNoteNumber || 'Emitida'}
                                  </span>
                                  <button
                                    onClick={() => handleReprintNP(s)}
                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Reimprimir NP"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300">Pendente</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
