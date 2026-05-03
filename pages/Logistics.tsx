import React, { useState, useEffect, createRef } from 'react';
import { Truck, Scale, Plus, AlertTriangle, CalendarClock, CheckCircle2, FileText, Printer, X, Search, BarChart2, DollarSign, Edit2, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Contract, Shipment } from '../types';
import { addShipment, markPromissoryNoteIssued, generatePromissoryNumber, getBuyers, markShipmentPaid, updateShipment, deleteShipment } from '../services/mockService';

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

// --- Componente de impressão do Relatório de Embarques ---
interface ShipmentReportPrintProps {
  shipments: Shipment[];
  contract: Contract;
  filters: { dateFrom: string; dateTo: string; paymentStatus: 'all' | 'paid' | 'unpaid' };
  onClose: () => void;
}

const ShipmentReportPrint: React.FC<ShipmentReportPrintProps> = ({ shipments, contract, filters, onClose }) => {
  const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const currency = contract.currency === 'USD' ? 'US$' : 'R$';
  const totalBags = shipments.reduce((sum, s) => sum + s.bagsCount, 0);
  const totalWeight = shipments.reduce((sum, s) => sum + s.weightKg, 0);
  const totalValue = totalBags * (contract.finalPrice || 0);
  const totalPaid = shipments.filter(s => s.paid).reduce((sum, s) => sum + s.bagsCount * (contract.finalPrice || 0), 0);
  const totalPending = totalValue - totalPaid;

  const periodoLabel = filters.dateFrom && filters.dateTo
    ? `${new Date(filters.dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(filters.dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}`
    : filters.dateFrom
    ? `A partir de ${new Date(filters.dateFrom + 'T00:00:00').toLocaleDateString('pt-BR')}`
    : filters.dateTo
    ? `Até ${new Date(filters.dateTo + 'T00:00:00').toLocaleDateString('pt-BR')}`
    : 'Todos os períodos';

  const statusLabel = filters.paymentStatus === 'paid' ? 'Apenas pagos' : filters.paymentStatus === 'unpaid' ? 'Apenas não pagos' : 'Todos';

  const reportContent = (
    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', padding: '12mm', background: 'white', color: 'black', maxWidth: '297mm', margin: '0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '2px solid #1a1a1a', paddingBottom: '10px' }}>
        <div>
          <img src={LOGO_URL} alt="DMS Agro" style={{ height: '48px', objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Relatório de Embarques</h1>
          <p style={{ margin: '0', fontSize: '11px', color: '#444' }}>Contrato {contract.number} — {contract.product} — Safra {contract.crop}</p>
          <p style={{ margin: '2px 0 0 0', fontSize: '10px', color: '#666' }}>Emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>

      {/* Dados do contrato */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '10px' }}>
        <div><strong>Vendedor:</strong> {contract.sellerName}</div>
        <div><strong>Comprador:</strong> {contract.buyerName}</div>
        <div><strong>Tipo de Pagamento:</strong> {PAYMENT_TYPE_LABEL[contract.paymentType || ''] || '-'}{contract.paymentDays ? ` (${contract.paymentDays}d)` : ''}</div>
        <div><strong>Preço:</strong> {currency} {(contract.finalPrice || 0).toFixed(2)}/sc</div>
        <div><strong>Período filtrado:</strong> {periodoLabel}</div>
        <div><strong>Status:</strong> {statusLabel}</div>
      </div>

      {/* Tabela de embarques */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#2d2d2d', color: 'white' }}>
            <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #555' }}>Data Embarque</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #555' }}>Placa</th>
            <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #555' }}>Ticket</th>
            <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #555' }}>Sacas</th>
            <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #555' }}>Peso (kg)</th>
            <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #555' }}>Valor ({currency})</th>
            <th style={{ padding: '5px 6px', textAlign: 'center', border: '1px solid #555' }}>Pgto Previsto</th>
            <th style={{ padding: '5px 6px', textAlign: 'center', border: '1px solid #555' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((s, i) => {
            const valor = s.bagsCount * (contract.finalPrice || 0);
            return (
              <tr key={s.id} style={{ background: s.paid ? '#f0fdf4' : i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd' }}>{new Date(s.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.plate}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd' }}>{s.ticketNumber}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'right' }}>{s.bagsCount.toLocaleString('pt-BR')}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'right' }}>{s.weightKg.toLocaleString('pt-BR')}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'right' }}>{valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{s.paymentDueDate ? new Date(s.paymentDueDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                <td style={{ padding: '4px 6px', border: '1px solid #ddd', textAlign: 'center', color: s.paid ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                  {s.paid ? '✓ PAGO' : 'PENDENTE'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#e8e8e8', fontWeight: 'bold' }}>
            <td colSpan={3} style={{ padding: '5px 6px', border: '1px solid #aaa', textAlign: 'right' }}>TOTAIS:</td>
            <td style={{ padding: '5px 6px', border: '1px solid #aaa', textAlign: 'right' }}>{totalBags.toLocaleString('pt-BR')}</td>
            <td style={{ padding: '5px 6px', border: '1px solid #aaa', textAlign: 'right' }}>{totalWeight.toLocaleString('pt-BR')}</td>
            <td style={{ padding: '5px 6px', border: '1px solid #aaa', textAlign: 'right' }}>{totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td colSpan={2} style={{ padding: '5px 6px', border: '1px solid #aaa' }}></td>
          </tr>
        </tfoot>
      </table>

      {/* Resumo financeiro */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
        <div style={{ padding: '10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#166534', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Pago</p>
          <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#16a34a' }}>{currency} {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div style={{ padding: '10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 'bold' }}>Saldo Pendente</p>
          <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>{currency} {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div style={{ padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Geral</p>
          <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{currency} {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ borderTop: '1px solid #ccc', marginTop: '20px', paddingTop: '8px', fontSize: '9px', color: '#888', textAlign: 'center' }}>
        <p style={{ margin: 0 }}>DMS AGRO COMÉRCIO DE CEREAIS — CNPJ: 33.082.718/0001-23 — 311 Sul. Orla 14 Graciosa. Lt 17. Al 12. Sala 1. CEP 77026-070. Palmas/TO</p>
      </div>
    </div>
  );

  useEffect(() => {
    if (!contentRef) return;
    const doc = contentRef.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
    <style>body{margin:0;padding:0;background:white;}@media print{@page{size:A4 landscape;margin:0;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style>
    </head><body><div id="report-mount"></div></body></html>`);
    doc.close();
    const mount = doc.getElementById('report-mount');
    setMountNode(mount);
    const timer = setTimeout(() => {
      const fileName = `LOGISTICA_${contract.number}_${contract.sellerName}_${periodoLabel.replace(/\//g, '-')}`.toUpperCase();
      const originalTitle = document.title;
      document.title = fileName;
      if (contentRef.contentWindow?.document) {
        contentRef.contentWindow.document.title = fileName;
      }
      contentRef.contentWindow?.focus();
      contentRef.contentWindow?.print();
      if (contentRef.contentWindow) {
        contentRef.contentWindow.addEventListener('afterprint', () => { document.title = originalTitle; }, { once: true });
      }
      setTimeout(() => { if (document.title === fileName) document.title = originalTitle; }, 30000);
    }, 1500);
    return () => clearTimeout(timer);
  }, [contentRef]);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[297mm] flex justify-between items-center mb-4 text-white">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          <span className="font-bold">Relatório de Embarques — Contrato {contract.number}</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
          <X className="w-4 h-4" /> Fechar
        </button>
      </div>
      <iframe ref={setContentRef} className="bg-white w-full max-w-[297mm] h-[80vh] shadow-2xl rounded-sm" title="Report Frame" />
      {mountNode && createPortal(reportContent, mountNode)}
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
  const [contractSearch, setContractSearch] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportFilters, setReportFilters] = useState<{ dateFrom: string; dateTo: string; paymentStatus: 'all' | 'paid' | 'unpaid' }>({ dateFrom: '', dateTo: '', paymentStatus: 'all' });
  const [printReportData, setPrintReportData] = useState<{ shipments: Shipment[]; contract: Contract; filters: typeof reportFilters } | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState<string | null>(null);
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [editForm, setEditForm] = useState({ plate: '', ticketNumber: '', weightKg: 0, deliveryDate: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingShipmentId, setDeletingShipmentId] = useState<string | null>(null);
  const [confirmDeleteShipment, setConfirmDeleteShipment] = useState<Shipment | null>(null);

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
        setSelectedContractId(selectedContractId);
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

  const handleMarkPaid = async (shipment: Shipment) => {
    setIsMarkingPaid(shipment.id);
    await markShipmentPaid(shipment.id, !shipment.paid);
    await onUpdate();
    setSelectedContractId(selectedContractId);
    setIsMarkingPaid(null);
  };

  const handleOpenReport = () => {
    setReportFilters({ dateFrom: '', dateTo: '', paymentStatus: 'all' });
    setShowReportModal(true);
  };

  const handleGenerateReport = () => {
    let filtered = contractShipments;
    if (reportFilters.dateFrom) {
      filtered = filtered.filter(s => s.deliveryDate >= reportFilters.dateFrom);
    }
    if (reportFilters.dateTo) {
      filtered = filtered.filter(s => s.deliveryDate <= reportFilters.dateTo);
    }
    if (reportFilters.paymentStatus === 'paid') {
      filtered = filtered.filter(s => s.paid);
    } else if (reportFilters.paymentStatus === 'unpaid') {
      filtered = filtered.filter(s => !s.paid);
    }
    setPrintReportData({ shipments: filtered, contract: selectedContract!, filters: reportFilters });
    setShowReportModal(false);
  };

  const handleEditShipment = (s: Shipment) => {
    setEditingShipment(s);
    setEditForm({
      plate: s.plate,
      ticketNumber: s.ticketNumber,
      weightKg: s.weightKg,
      deliveryDate: s.deliveryDate,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingShipment || !selectedContract) return;
    setIsSavingEdit(true);
    const updated: Shipment = {
      ...editingShipment,
      plate: editForm.plate,
      ticketNumber: editForm.ticketNumber,
      weightKg: editForm.weightKg,
      deliveryDate: editForm.deliveryDate,
      bagsCount: Math.floor(editForm.weightKg / 60),
    };
    await updateShipment(updated, editingShipment.bagsCount);
    await onUpdate();
    setSelectedContractId(selectedContractId);
    setIsSavingEdit(false);
    setEditingShipment(null);
  };

  const handleDeleteShipment = (s: Shipment) => {
    if (s.promissoryNoteIssued) {
      setConfirmDeleteShipment({ ...s, _blockedByNP: true } as any);
      return;
    }
    setConfirmDeleteShipment(s);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteShipment) return;
    setDeletingShipmentId(confirmDeleteShipment.id);
    setConfirmDeleteShipment(null);
    await deleteShipment(confirmDeleteShipment.id, confirmDeleteShipment.bagsCount, confirmDeleteShipment.contractId);
    await onUpdate();
    setSelectedContractId(selectedContractId);
    setDeletingShipmentId(null);
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
    // Guarda o ID antes do update para garantir que não muda
    const contractIdToKeep = selectedContract.id;
    const bags = Math.floor(ticketData.weightKg / 60);
    const newShipment: Shipment = {
      id: Math.random().toString(36),
      contractId: contractIdToKeep,
      plate: ticketData.plate,
      ticketNumber: ticketData.ticketNumber,
      weightKg: ticketData.weightKg,
      bagsCount: bags,
      date: new Date().toISOString(),
      deliveryDate: ticketData.deliveryDate,
    };
    await addShipment(newShipment, selectedContract);
    await onUpdate();
    // Restaura explicitamente o contrato selecionado após o update
    setSelectedContractId(contractIdToKeep);
    setIsSubmitting(false);
    setShowAddTicket(false);
    setTicketData({ plate: '', ticketNumber: '', weightKg: 0, deliveryDate: today });
  };

  if (!selectedContract) return <div className="text-slate-500 p-8 text-center">Nenhum contrato disponível para logística.</div>;

  const selectedAlert = getCriticalAlert(selectedContract, contractShipments);
  const pendingBags = selectedContract.totalBags - selectedContract.deliveredBags;
  const progressPct = Math.min((selectedContract.deliveredBags / selectedContract.totalBags) * 100, 100);

  const filteredContracts = contracts
    .filter(c => {
      if (!contractSearch.trim()) return true;
      const term = contractSearch.toLowerCase();
      return (
        c.number.toLowerCase().includes(term) ||
        c.sellerName.toLowerCase().includes(term) ||
        c.buyerName.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // Prioridade 1: em carregamento (deliveredBags > 0 e < totalBags)
      const aInProgress = a.deliveredBags > 0 && a.deliveredBags < a.totalBags;
      const bInProgress = b.deliveredBags > 0 && b.deliveredBags < b.totalBags;
      if (aInProgress && !bInProgress) return -1;
      if (!aInProgress && bInProgress) return 1;

      // Prioridade 2: com alerta de prazo
      const aAlert = contractAlert(a);
      const bAlert = contractAlert(b);
      if (aAlert && !bAlert) return -1;
      if (!aAlert && bAlert) return 1;

      // Prioridade 3: com embarques mas concluídos
      const aHasShipments = a.deliveredBags > 0;
      const bHasShipments = b.deliveredBags > 0;
      if (aHasShipments && !bHasShipments) return -1;
      if (!aHasShipments && bHasShipments) return 1;

      return 0;
    });

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

      {printReportData && (
        <ShipmentReportPrint
          shipments={printReportData.shipments}
          contract={printReportData.contract}
          filters={printReportData.filters}
          onClose={() => setPrintReportData(null)}
        />
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-slate-600" /> Configurar Relatório
              </h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período — Data Início</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  value={reportFilters.dateFrom}
                  onChange={e => setReportFilters({ ...reportFilters, dateFrom: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período — Data Fim</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  value={reportFilters.dateTo}
                  onChange={e => setReportFilters({ ...reportFilters, dateTo: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status de Pagamento</label>
                <div className="flex gap-3 mt-2">
                  {(['all', 'unpaid', 'paid'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" checked={reportFilters.paymentStatus === opt}
                        onChange={() => setReportFilters({ ...reportFilters, paymentStatus: opt })}
                        className="text-emerald-600" />
                      {opt === 'all' ? 'Todos' : opt === 'unpaid' ? 'Não pagos' : 'Pagos'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
              <button onClick={handleGenerateReport}
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 flex items-center gap-2 font-medium">
                <Printer className="w-4 h-4" /> Gerar Relatório
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-2 bg-red-100 rounded-lg shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                {(confirmDeleteShipment as any)._blockedByNP ? (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Exclusão bloqueada</h3>
                    <p className="text-sm text-slate-600">
                      O embarque da placa <strong>{confirmDeleteShipment.plate}</strong> possui uma Nota Promissória emitida e não pode ser excluído.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Confirmar exclusão</h3>
                    <p className="text-sm text-slate-600">
                      Deseja excluir o embarque da placa <strong>{confirmDeleteShipment.plate}</strong> ({confirmDeleteShipment.bagsCount.toLocaleString()} sacas)?
                    </p>
                    <p className="text-xs text-red-500 mt-2 font-medium">Esta ação não pode ser desfeita.</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteShipment(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
              >
                {(confirmDeleteShipment as any)._blockedByNP ? 'Fechar' : 'Cancelar'}
              </button>
              {!(confirmDeleteShipment as any)._blockedByNP && (
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-slate-600" /> Editar Embarque
              </h3>
              <button onClick={() => setEditingShipment(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editingShipment.promissoryNoteIssued && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Este embarque já possui NP emitida. Editar os dados pode gerar inconsistência com o documento emitido.</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Placa</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2 uppercase"
                  value={editForm.plate}
                  onChange={e => setEditForm({ ...editForm, plate: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ticket Balança</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg p-2"
                  value={editForm.ticketNumber}
                  onChange={e => setEditForm({ ...editForm, ticketNumber: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Peso Líquido (Kg)</label>
                <input type="number" className="w-full border border-slate-300 rounded-lg p-2"
                  value={editForm.weightKg || ''}
                  onChange={e => setEditForm({ ...editForm, weightKg: Number(e.target.value) })} />
                {editForm.weightKg > 0 && (
                  <p className="text-xs text-slate-400 mt-1">= {Math.floor(editForm.weightKg / 60).toLocaleString()} sacas</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data do Embarque</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg p-2"
                  value={editForm.deliveryDate}
                  onChange={e => setEditForm({ ...editForm, deliveryDate: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditingShipment(null)} className="px-4 py-2 text-slate-500">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={isSavingEdit || !editForm.plate || !editForm.deliveryDate || editForm.weightKg <= 0}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 font-medium">
                {isSavingEdit && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit">
          <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Truck className="w-5 h-5" /> Contratos</h3>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nº, vendedor ou comprador..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={contractSearch}
              onChange={(e) => setContractSearch(e.target.value)}
            />
          </div>
          <div className="space-y-2 max-h-[560px] overflow-y-auto">
            {filteredContracts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">Nenhum contrato encontrado.</p>
            ) : null}
            {filteredContracts.map(contract => {
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
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">Contrato {selectedContract.number}</h2>
                {contractShipments.length > 0 && (
                  <button onClick={handleOpenReport} title="Gerar relatório de embarques"
                    className="text-slate-400 hover:text-slate-700 transition-colors">
                    <BarChart2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div>
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
                      <th className="px-4 py-3 font-medium text-center">Pago</th>
                      {isPosRetirada && <th className="px-4 py-3 font-medium text-center">NP</th>}
                      <th className="px-4 py-3 font-medium text-center">Ações</th>
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
                        <tr key={s.id} className={`${s.paid ? 'bg-emerald-50' : ''} ${isUrgent && !s.paid ? 'bg-red-50' : ''} ${isChecked ? 'bg-blue-50' : ''}`}>
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
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleMarkPaid(s)}
                              disabled={isMarkingPaid === s.id}
                              title={s.paid ? 'Marcar como não pago' : 'Marcar como pago'}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                                s.paid
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
                              } disabled:opacity-50`}
                            >
                              {isMarkingPaid === s.id ? (
                                <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              ) : (
                                <DollarSign className="w-3 h-3" />
                              )}
                              {s.paid ? 'Pago' : 'Pendente'}
                            </button>
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
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEditShipment(s)}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Editar embarque"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteShipment(s)}
                                disabled={deletingShipmentId === s.id}
                                className="text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                title={s.promissoryNoteIssued ? 'Embarque com NP emitida não pode ser excluído' : 'Excluir embarque'}
                              >
                                {deletingShipmentId === s.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />
                                }
                              </button>
                            </div>
                          </td>
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
