import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Sprout } from 'lucide-react';
import {
  CommissionAnalyticsResult,
  CommissionMatrixData,
  ProducerIntelligenceResult,
  VolumeAnalyticsResult,
  VolumeMatrixResult,
  VolumeUnit,
  formatDateBR,
  formatMonthLabel
} from '../../services/reportsAnalytics';
import { ExternalLogisticsSections, ExternalProducerSections } from '../../services/reportsExport';
import {
  LogisticsAnalyticsSummary,
  LogisticsContractRow,
  LogisticsGanttData,
  LogisticsMatrixResult,
  ProducerLogisticsExternalView
} from '../../services/logisticsScheduleAnalytics';

const LOGO_URL = 'https://i.postimg.cc/8CmMzM9c/LOGO-DMS-SF.png';

export type PrintReportPayload =
  | {
      kind: 'COMMISSION_INTERNAL';
      title: string;
      filtersSummary: string[];
      mode: 'SYNTHETIC' | 'ANALYTICAL' | 'MATRIX';
      includeCharts: boolean;
      selectedColumns: Record<string, boolean>;
      analytics: CommissionAnalyticsResult;
      matrix: CommissionMatrixData;
    }
  | {
      kind: 'VOLUME_INTERNAL';
      title: string;
      filtersSummary: string[];
      mode: 'SYNTHETIC' | 'MATRIX';
      includeCharts: boolean;
      unit: VolumeUnit;
      metricLabel: string;
      analytics: VolumeAnalyticsResult;
      matrix: VolumeMatrixResult;
    }
  | {
      kind: 'PRODUCER_EXTERNAL';
      title: string;
      producerOrGroupTitle: string;
      producerDocsLabel: string;
      periodLabel: string;
      filtersSummary: string[];
      unit: VolumeUnit;
      sections: ExternalProducerSections;
      intel: ProducerIntelligenceResult;
    }
  | {
      kind: 'LOGISTICS_INTERNAL';
      title: string;
      filtersSummary: string[];
      mode: 'SYNTHETIC' | 'GANTT' | 'ANALYTICAL' | 'TRACKING';
      includeCharts: boolean;
      unit: VolumeUnit;
      metricLabel: string;
      selectedColumns: Record<string, boolean>;
      summary: LogisticsAnalyticsSummary;
      matrix: LogisticsMatrixResult;
      gantt: LogisticsGanttData;
      analyticalRows: LogisticsContractRow[];
    }
  | {
      kind: 'LOGISTICS_EXTERNAL';
      title: string;
      filtersSummary: string[];
      sections: ExternalLogisticsSections;
      selectedColumns: Record<string, boolean>;
      producerView: ProducerLogisticsExternalView;
    };

interface ReportPrintModalProps {
  payload: PrintReportPayload;
  onClose: () => void;
}

const formatBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatQty = (v: number, unit: VolumeUnit) =>
  `${v.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} ${unit === 'TON' ? 'ton' : 'scs'}`;

// Vector SVG bar chart for reliable crisp rendering inside Print Iframe
const SimplePrintBarSvg: React.FC<{
  title: string;
  items: Array<{ label: string; value: number; displayValue: string }>;
  barColor?: string;
}> = ({ title, items, barColor = '#059669' }) => {
  if (items.length === 0) return null;
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const sliced = items.slice(0, 12);
  const width = 680;
  const height = 180;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 22;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const barSlot = plotW / sliced.length;
  const barW = Math.min(36, barSlot * 0.65);

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', marginBottom: '12px', pageBreakInside: 'avoid' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
        {title}
      </p>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
        <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} stroke="#94a3b8" strokeWidth="1" />
        {sliced.map((item, idx) => {
          const barH = Math.max(2, (item.value / maxVal) * plotH);
          const x = padLeft + idx * barSlot + (barSlot - barW) / 2;
          const y = padTop + plotH - barH;
          return (
            <g key={idx}>
              <rect x={x} y={y} width={barW} height={barH} fill={barColor} rx="2" />
              <text
                x={x + barW / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill="#334155"
              >
                {item.displayValue}
              </text>
              <text
                x={x + barW / 2}
                y={padTop + plotH + 14}
                textAnchor="middle"
                fontSize="8.5"
                fill="#475569"
              >
                {item.label.length > 9 ? item.label.slice(0, 9) : item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const ReportPrintModal: React.FC<ReportPrintModalProps> = ({ payload, onClose }) => {
  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const isLandscape =
    payload.kind !== 'PRODUCER_EXTERNAL' && payload.kind !== 'LOGISTICS_EXTERNAL';
  const pageSizeCss = isLandscape ? 'A4 landscape' : 'A4 portrait';

  useEffect(() => {
    if (!iframeEl) return;
    const doc = iframeEl.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>${payload.title}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 0; font-size: 10.5px; line-height: 1.4; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #cbd5e1; padding: 4px 6px; }
          th { background: #f1f5f9; color: #1e293b; font-weight: 700; text-align: left; }
          .num { text-align: right; font-variant-numeric: tabular-nums; }
          .center { text-align: center; }
          .section-box { page-break-inside: avoid; margin-bottom: 14px; }
          @media print {
            @page {
              size: ${pageSizeCss};
              margin: 12mm 10mm 14mm 10mm;
              @bottom-right {
                content: "Página " counter(page) " de " counter(pages);
                font-size: 8.5px;
                color: #64748b;
              }
            }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body><div id="report-print-root"></div></body>
      </html>
    `);
    doc.close();

    const root = doc.getElementById('report-print-root');
    setMountNode(root);

    const timer = setTimeout(() => {
      const originalTitle = document.title;
      document.title = payload.title;
      iframeEl.contentWindow?.focus();
      iframeEl.contentWindow?.print();
      const restore = () => {
        document.title = originalTitle;
      };
      iframeEl.contentWindow?.addEventListener('afterprint', restore, { once: true });
      setTimeout(restore, 15000);
    }, 900);

    return () => clearTimeout(timer);
  }, [iframeEl, payload.title, pageSizeCss]);

  const issuedAt = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;

  const renderHeader = (subtitle: string, extraLines: string[] = []) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #065f46', paddingBottom: '10px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src={LOGO_URL}
          alt="DMS Agro"
          style={{ height: '46px', width: 'auto', objectFit: 'contain' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div>
          <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase' }}>
            {payload.title}
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '10.5px', color: '#475569' }}>{subtitle}</p>
          {extraLines.map((line, i) => (
            <p key={i} style={{ margin: '1px 0 0 0', fontSize: '9.5px', color: '#64748b' }}>{line}</p>
          ))}
        </div>
      </div>
      <div style={{ textAlign: 'right', fontSize: '9.5px', color: '#475569' }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#065f46' }}>DMS AGRO COMÉRCIO DE CEREAIS</p>
        <p style={{ margin: '2px 0 0 0' }}>Emissão: {issuedAt}</p>
      </div>
    </div>
  );

  const renderFiltersBar = (filters: string[]) => (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '6px 8px', marginBottom: '12px', fontSize: '9.5px', color: '#334155' }}>
      <strong>Filtros aplicados:</strong> {filters.length > 0 ? filters.join(' | ') : 'Todos os registros (sem restrição de filtro)'}
    </div>
  );

  const renderFooter = () => (
    <div style={{ borderTop: '1px solid #cbd5e1', marginTop: '18px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#64748b' }}>
      <span>DMS AGRO COMÉRCIO DE CEREAIS — CNPJ 33.082.718/0001-23 — Palmas/TO</span>
      <span>Documento gerado pelo módulo de Relatórios DMS Agro ERP</span>
    </div>
  );

  const renderContent = () => {
    if (payload.kind === 'PRODUCER_EXTERNAL') {
      const { intel, unit, sections, producerOrGroupTitle, producerDocsLabel, periodLabel } = payload;
      const currSym = intel.currency === 'USD' ? 'US$' : 'R$';

      return (
        <div style={{ padding: '4mm' }}>
          {renderHeader(`Relatório Comercial do Produtor — ${producerOrGroupTitle}`, [
            producerDocsLabel ? `Documento(s): ${producerDocsLabel}` : '',
            `Período analisado: ${periodLabel}`
          ].filter(Boolean))}
          {renderFiltersBar(payload.filtersSummary)}

          {sections.executiveSummary && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                1. Resumo Executivo de Comercialização
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Volume Negociado</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>{formatQty(intel.totalVolume, unit)}</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>{intel.dealsCount} negócio(s)</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Preço Médio Ponderado</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#065f46' }}>
                    {intel.weightedAvgPrice !== null
                      ? `${currSym} ${intel.weightedAvgPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/sc`
                      : 'Separado por cultura/moeda'}
                  </div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>Cobertura: {intel.priceCoveragePct.toFixed(1)}% do volume</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Fixado × A Fixar</div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, marginTop: '2px' }}>{formatQty(intel.fixedVolume, unit)} fix.</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>{formatQty(intel.toFixVolume, unit)} a fixar</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Valor Bruto Negociado</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
                    {intel.currency
                      ? `${currSym} ${intel.grossNegotiatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Separado por moeda'}
                  </div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>Valores históricos nominais</div>
                </div>
              </div>
              {intel.bestCropByVolume && (
                <p style={{ fontSize: '9.5px', color: '#334155', margin: '0 0 4px 0' }}>
                  <strong>Destaques do período:</strong> Maior volume na Safra {intel.bestCropByVolume.crop} ({formatQty(intel.bestCropByVolume.volume, unit)})
                  {intel.bestCropByAvgPrice && intel.bestCropByAvgPrice.weightedAvgPrice !== null
                    ? ` • Melhor preço médio ponderado na Safra ${intel.bestCropByAvgPrice.crop} (${currSym} ${intel.bestCropByAvgPrice.weightedAvgPrice.toFixed(2)}/sc)`
                    : ''}
                  {intel.highlights.peakVolumeMonth
                    ? ` • Mês de maior volume: ${intel.highlights.peakVolumeMonth.label} (${formatQty(intel.highlights.peakVolumeMonth.volume, unit)})`
                    : ''}.
                </p>
              )}
            </div>
          )}

          {sections.charts && intel.cropComparison.length > 0 && (
            <SimplePrintBarSvg
              title={`Volume Negociado por Safra (${unit === 'TON' ? 'Toneladas' : 'Sacas'})`}
              items={intel.cropComparison.map((c) => ({
                label: `Safra ${c.crop}`,
                value: c.volume,
                displayValue: c.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
              }))}
              barColor="#059669"
            />
          )}

          {sections.cropComparison && intel.cropComparison.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                2. Comparativo Histórico entre Safras
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Safra</th>
                    <th className="num">Volume ({unit === 'TON' ? 'ton' : 'scs'})</th>
                    <th className="num">Negócios</th>
                    <th className="num">Preço Médio Pond.</th>
                    <th className="num">Maior Preço</th>
                    <th className="num">Menor Preço</th>
                    <th className="num">Valor Bruto Negociado</th>
                    <th className="num">Evolução</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.cropComparison.map((c) => (
                    <tr key={c.crop}>
                      <td style={{ fontWeight: 700 }}>Safra {c.crop}</td>
                      <td className="num">{c.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num">{c.dealsCount}</td>
                      <td className="num">{c.weightedAvgPrice !== null ? `${currSym} ${c.weightedAvgPrice.toFixed(2)}` : '-'}</td>
                      <td className="num">{c.maxPrice !== null ? `${currSym} ${c.maxPrice.toFixed(2)}` : '-'}</td>
                      <td className="num">{c.minPrice !== null ? `${currSym} ${c.minPrice.toFixed(2)}` : '-'}</td>
                      <td className="num">{intel.distinctCurrencies.length <= 1 ? `${currSym} ${c.grossNegotiatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td className="num">{c.volumeEvolutionPct !== null ? `${c.volumeEvolutionPct >= 0 ? '+' : ''}${c.volumeEvolutionPct.toFixed(1)}%` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.monthlyStrategy && intel.monthlyStrategy.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                3. Distribuição Mensal de Comercialização
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="num">Volume ({unit === 'TON' ? 'ton' : 'scs'})</th>
                    <th className="num">Contratos</th>
                    <th className="num">Preço Médio Pond.</th>
                    <th className="num">Part. (%)</th>
                    <th className="num">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.monthlyStrategy.map((m) => (
                    <tr key={m.monthKey}>
                      <td style={{ fontWeight: 700 }}>{m.label}</td>
                      <td className="num">{m.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num">{m.dealsCount}</td>
                      <td className="num">{m.weightedAvgPrice !== null ? `${currSym} ${m.weightedAvgPrice.toFixed(2)}` : '-'}</td>
                      <td className="num">{m.sharePct.toFixed(1)}%</td>
                      <td className="num">{m.cumulativeVolume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.byProduct && intel.byProduct.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                4. Desempenho por Produto / Moeda
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Produto (Moeda)</th>
                    <th className="num">Volume ({unit === 'TON' ? 'ton' : 'scs'})</th>
                    <th className="num">Negócios</th>
                    <th className="num">Preço Médio Pond. (/sc)</th>
                    <th className="num">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.byProduct.map((p) => (
                    <tr key={p.key}>
                      <td style={{ fontWeight: 700 }}>{p.label}</td>
                      <td className="num">{p.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num">{p.dealsCount}</td>
                      <td className="num">{p.weightedAvgPrice !== null ? p.weightedAvgPrice.toFixed(2) : '-'}</td>
                      <td className="num">{p.sharePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.byFarm && intel.byFarmAndProduct.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                5. Desempenho por Fazenda
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Fazenda</th>
                    <th>Produto</th>
                    <th className="num">Volume ({unit === 'TON' ? 'ton' : 'scs'})</th>
                    <th className="num">Negócios</th>
                    <th className="num">Preço Médio Pond. (/sc)</th>
                    <th className="num">Part. (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.byFarmAndProduct.map((f) => (
                    <tr key={f.key}>
                      <td style={{ fontWeight: 700 }}>{f.label}</td>
                      <td>{f.product}</td>
                      <td className="num">{f.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num">{f.dealsCount}</td>
                      <td className="num">{f.weightedAvgPrice !== null ? f.weightedAvgPrice.toFixed(2) : '-'}</td>
                      <td className="num">{f.sharePct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.analyticalContracts && intel.contracts.length > 0 && (
            <div>
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                6. Relação Analítica de Negócios ({intel.contracts.length} contratos)
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Contrato</th>
                    <th>Fechamento</th>
                    <th>Produto / Safra</th>
                    <th>Fazenda</th>
                    <th>Comprador</th>
                    <th className="num">Volume ({unit === 'TON' ? 'ton' : 'scs'})</th>
                    <th className="num">Preço (/sc)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {intel.contracts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.number}</td>
                      <td>{formatDateBR(c.closingDate)}</td>
                      <td>{c.product} · {c.crop}</td>
                      <td>{c.farmName}</td>
                      <td>{c.buyerName}</td>
                      <td className="num">{c.volume.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num">
                        {c.priceStatus === 'FIXED_VALID'
                          ? `${c.currency === 'USD' ? 'US$' : 'R$'} ${c.finalPrice.toFixed(2)}`
                          : c.priceStatus === 'TO_FIX_INDICATIVE'
                          ? `${c.finalPrice.toFixed(2)} (Ind.)`
                          : 'A Fixar'}
                      </td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {renderFooter()}
        </div>
      );
    }

    if (payload.kind === 'COMMISSION_INTERNAL') {
      const { analytics, matrix, mode, includeCharts, selectedColumns } = payload;
      return (
        <div style={{ padding: '4mm' }}>
          {renderHeader('Relatório Gerencial Interno — Comissões de Corretagem', [
            'Regra: Comissões devidas exclusivamente pelo Vendedor (Produtor) e expressas sempre em Reais (BRL), sem conversão cambial. Recebimentos efetivos ainda não controlados neste módulo.'
          ])}
          {renderFiltersBar(payload.filtersSummary)}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
              <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>COMISSÃO CONTRATADA (R$)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px', color: '#0f172a' }}>{formatBRL(analytics.totalContractedBRL)}</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>{analytics.contractsCount} contratos · {analytics.totalBags.toLocaleString('pt-BR')} scs</div>
            </div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
              <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>PREVISTA NO PERÍODO (R$)</div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px', color: '#065f46' }}>{formatBRL(analytics.forecastTotalPeriodBRL)}</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>
                Conf.: {formatBRL(analytics.forecastConfirmedBRL)} · Est.: {formatBRL(analytics.forecastEstimatedBRL)}
              </div>
            </div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
              <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>SEM VENCIMENTO DEFINIDO</div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '3px', color: '#b45309' }}>{formatBRL(analytics.undefinedDueBRL)}</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>
                Média pond.: {analytics.weightedAvgPerBagBRL !== null ? `${formatBRL(analytics.weightedAvgPerBagBRL)}/sc` : '-'}
              </div>
            </div>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
              <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>RECEBIDO / SALDO A RECEBER</div>
              <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '4px', color: '#b45309' }}>Recebimentos ainda não controlados</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>Prop. embarque: {formatBRL(analytics.totalShippedBRL)}</div>
            </div>
          </div>

          {includeCharts && analytics.monthlySeries.length > 0 && (
            <SimplePrintBarSvg
              title="Previsão Mensal de Comissões (R$)"
              items={analytics.monthlySeries.map((m) => ({
                label: m.label,
                value: m.totalBRL,
                displayValue: m.totalBRL >= 1000 ? `${(m.totalBRL / 1000).toFixed(0)}k` : m.totalBRL.toFixed(0)
              }))}
              barColor="#059669"
            />
          )}

          {mode === 'SYNTHETIC' && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>Resumo Sintético por Produtor (R$)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Produtor</th>
                    <th>CPF/CNPJ</th>
                    <th className="num">Contratos</th>
                    <th className="num">Volume (scs)</th>
                    <th className="num">Contratada (R$)</th>
                    <th className="num">Confirmada (R$)</th>
                    <th className="num">Estimada (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.summaryByProducer.map((p) => (
                    <tr key={p.key}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td>{p.doc || '-'}</td>
                      <td className="num">{p.contractsCount}</td>
                      <td className="num">{p.totalBags.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatBRL(p.totalBRL)}</td>
                      <td className="num">{formatBRL(p.confirmedBRL)}</td>
                      <td className="num">{formatBRL(p.estimatedBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {mode === 'MATRIX' && (
            <div>
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>Matriz Dinâmica de Comissões Previstas (R$)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Agrupamento</th>
                    {matrix.monthKeys.map((mk) => (
                      <th key={mk} className="num">{formatMonthLabel(mk)}</th>
                    ))}
                    <th className="num">Total Previsto (R$)</th>
                    <th className="num">Sem Venc. (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r) => (
                    <tr key={r.key}>
                      <td style={{ fontWeight: 700 }}>{r.label}</td>
                      {matrix.monthKeys.map((mk) => (
                        <td key={mk} className="num">
                          {r.cells[mk]?.amount ? r.cells[mk].amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      ))}
                      <td className="num" style={{ fontWeight: 700 }}>{formatBRL(r.totalBRL)}</td>
                      <td className="num">{r.undefinedBRL > 0 ? formatBRL(r.undefinedBRL) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                    <td>TOTAL GERAL (R$)</td>
                    {matrix.monthKeys.map((mk) => (
                      <td key={mk} className="num">{(matrix.colTotalsBRL[mk] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    ))}
                    <td className="num">{formatBRL(matrix.grandTotalBRL)}</td>
                    <td className="num">{formatBRL(matrix.grandUndefinedBRL)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {mode === 'ANALYTICAL' && (
            <div>
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>Visão Analítica de Comissões ({analytics.rows.length} contratos — Valores em R$)</h2>
              <table>
                <thead>
                  <tr>
                    {selectedColumns.contractNumber !== false && <th>Contrato</th>}
                    {selectedColumns.producerName !== false && <th>Produtor</th>}
                    {selectedColumns.farmName && <th>Fazenda</th>}
                    {selectedColumns.product !== false && <th>Produto</th>}
                    {selectedColumns.crop !== false && <th>Safra</th>}
                    {selectedColumns.totalBags !== false && <th className="num">Vol. Contr. (scs)</th>}
                    {selectedColumns.commissionPerBag !== false && <th className="num">Comissão (R$/sc)</th>}
                    {selectedColumns.contractedCommission !== false && <th className="num">Comissão Total (R$)</th>}
                    {selectedColumns.dueDate !== false && <th>Previsão</th>}
                    {selectedColumns.financialStatus !== false && <th>Status / Recebimento</th>}
                  </tr>
                </thead>
                <tbody>
                  {analytics.rows.map((r) => (
                    <tr key={r.contractId}>
                      {selectedColumns.contractNumber !== false && <td style={{ fontWeight: 700 }}>{r.contractNumber}</td>}
                      {selectedColumns.producerName !== false && <td>{r.producerName}</td>}
                      {selectedColumns.farmName && <td>{r.farmName}</td>}
                      {selectedColumns.product !== false && <td>{r.product}</td>}
                      {selectedColumns.crop !== false && <td>{r.crop}</td>}
                      {selectedColumns.totalBags !== false && <td className="num">{r.totalBags.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>}
                      {selectedColumns.commissionPerBag !== false && <td className="num">R$ {r.commissionPerBag.toFixed(2)}</td>}
                      {selectedColumns.contractedCommission !== false && <td className="num">R$ {r.contractedCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>}
                      {selectedColumns.dueDate !== false && <td>{r.dueDate ? formatDateBR(r.dueDate) : 'Sem vencimento'}</td>}
                      {selectedColumns.financialStatus !== false && <td>{r.financialStatusLabel}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {renderFooter()}
        </div>
      );
    }

    if (payload.kind === 'VOLUME_INTERNAL') {
      const { analytics, matrix, mode, includeCharts, unit, metricLabel } = payload;
    return (
      <div style={{ padding: '4mm' }}>
        {renderHeader(`Relatório Interno de Volume Comercial (${metricLabel})`, [
          `Unidade: ${unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)'} • Cobertura logística registrada: ${analytics.logisticsCoverage.contractsWithShipments}/${analytics.logisticsCoverage.contractsTotal} contratos (${analytics.logisticsCoverage.contractsPct.toFixed(1)}%)`
        ])}
        {renderFiltersBar(payload.filtersSummary)}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>COMERCIALIZADO</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px' }}>{formatQty(analytics.totalContracted, unit)}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>EMBARCADO REGISTRADO</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px', color: '#059669' }}>{formatQty(analytics.totalShipped, unit)}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>PENDENTE CONHECIDO</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px' }}>{formatQty(analytics.totalPending, unit)}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>CONTRATOS / PRODUTORES</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px' }}>{analytics.contractsCount} / {analytics.producersCount}</div>
          </div>
        </div>

        {includeCharts && analytics.monthlySeries.length > 0 && (
          <SimplePrintBarSvg
            title={`Evolução Mensal do Volume Comercializado (${unit === 'TON' ? 'ton' : 'scs'})`}
            items={analytics.monthlySeries.slice(-12).map((m) => ({
              label: m.label,
              value: m.contracted,
              displayValue: m.contracted >= 1000 ? `${(m.contracted / 1000).toFixed(0)}k` : m.contracted.toFixed(0)
            }))}
            barColor="#059669"
          />
        )}

        {mode === 'SYNTHETIC' ? (
          <div>
            <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>Ranking de Produtores por Volume</h2>
            <table>
              <thead>
                <tr>
                  <th>Produtor</th>
                  <th className="num">Contratos</th>
                  <th className="num">Comercializado</th>
                  <th className="num">Embarcado Reg.</th>
                  <th className="num">Pendente Conhec.</th>
                  <th className="num">Part. (%)</th>
                </tr>
              </thead>
              <tbody>
                {analytics.producerRanking.map((p) => (
                  <tr key={p.producerKey}>
                    <td style={{ fontWeight: 700 }}>{p.name}</td>
                    <td className="num">{p.contractsCount}</td>
                    <td className="num">{formatQty(p.contracted, unit)}</td>
                    <td className="num">{formatQty(p.shipped, unit)}</td>
                    <td className="num">{formatQty(p.pending, unit)}</td>
                    <td className="num">{p.sharePct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>Matriz Dinâmica de Volumes ({metricLabel})</h2>
            <table>
              <thead>
                <tr>
                  <th>Dimensão</th>
                  {matrix.colKeys.map((ck) => (
                    <th key={ck} className="num">{matrix.colLabels[ck]}</th>
                  ))}
                  <th className="num">Total</th>
                  <th className="num">Part. (%)</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 700 }}>{r.label}</td>
                    {matrix.colKeys.map((ck) => (
                      <td key={ck} className="num">
                        {r.cells[ck]?.value ? r.cells[ck].value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}
                      </td>
                    ))}
                    <td className="num" style={{ fontWeight: 700 }}>{r.total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="num">{r.sharePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <td>TOTAL GERAL</td>
                  {matrix.colKeys.map((ck) => (
                    <td key={ck} className="num">{(matrix.colTotals[ck] || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  ))}
                  <td className="num">{matrix.grandTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {renderFooter()}
      </div>
    );
    }

    if (payload.kind === 'LOGISTICS_EXTERNAL') {
      const { producerView, sections, selectedColumns } = payload;
      const unit = producerView.unit;

      return (
        <div style={{ padding: '4mm' }}>
          {renderHeader(`Programação de Entregas e Retiradas — ${producerView.targetTitle}`, [
            producerView.targetDocs ? `Documento(s): ${producerView.targetDocs}` : '',
            `Data de referência: ${formatDateBR(producerView.referenceDate)} · Unidade: ${
              unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)'
            }`
          ].filter(Boolean))}
          {renderFiltersBar(payload.filtersSummary)}

          {sections.executiveSummary && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                1. Resumo Logístico de Entregas e Retiradas
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>CONTRATADO</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px' }}>{formatQty(producerView.totalContracted, unit)}</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>{producerView.contractsCount} contrato(s)</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>ENTREGUE REGISTRADO</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px', color: '#059669' }}>{formatQty(producerView.totalDelivered, unit)}</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>{producerView.deliveredPct.toFixed(1)}% do contratado</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>SALDO CONHECIDO</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px', color: '#b45309' }}>{formatQty(producerView.totalBalance, unit)}</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>A entregar/retirar</div>
                </div>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
                  <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>MODALIDADE FRETE</div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, marginTop: '2px' }}>FOB: {formatQty(producerView.fobContracted, unit)}</div>
                  <div style={{ fontSize: '8.5px', color: '#64748b' }}>CIF: {formatQty(producerView.cifContracted, unit)}</div>
                </div>
              </div>
            </div>
          )}

          {sections.horizons && producerView.horizons.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                2. Horizontes Futuros de Entrega (Acumulados a partir de {formatDateBR(producerView.referenceDate)})
              </h2>
              <p style={{ fontSize: '8.5px', color: '#64748b', margin: '0 0 6px 0' }}>
                Nota: Os horizontes são acumulados entre si (não devem ser somados). Contratos com janela ampla aparecem separados de quinzenas específicas.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Horizonte</th>
                    <th>Até</th>
                    <th className="num">Contratos</th>
                    <th className="num">Quinzena Específica</th>
                    <th className="num">Janelas Coincidentes</th>
                    <th className="num">Saldo Coincidente Total</th>
                  </tr>
                </thead>
                <tbody>
                  {producerView.horizons.map((h) => (
                    <tr key={h.days}>
                      <td style={{ fontWeight: 700 }}>Próximos {h.days} dias</td>
                      <td>{formatDateBR(h.horizonEndDate)}</td>
                      <td className="num">{h.contractsCount}</td>
                      <td className="num">{formatQty(h.definedVolume, unit)}</td>
                      <td className="num">{formatQty(h.coincidentVolume, unit)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatQty(h.totalOverlappingVolume, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.charts && producerView.scheduleRows.length > 0 && (
            <SimplePrintBarSvg
              title={`Volumes Programados por Período (${unit === 'TON' ? 'ton' : 'scs'})`}
              items={producerView.scheduleRows.slice(0, 12).map((s) => ({
                label: s.periodLabel.replace('Quinzena ', 'Q '),
                value: s.contractedVolume,
                displayValue: s.contractedVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
              }))}
              barColor="#059669"
            />
          )}

          {sections.scheduleTable && producerView.scheduleRows.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                3. Agenda de Entregas por Quinzena / Período Contratado
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Período Contratado</th>
                    <th>Datas Reais</th>
                    <th className="num">Contratos</th>
                    <th className="num">Contratado</th>
                    <th className="num">Entregue Reg.</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {producerView.scheduleRows.map((s) => (
                    <tr key={s.periodKey}>
                      <td style={{ fontWeight: 700 }}>{s.periodLabel}</td>
                      <td>{s.exactDatesLabel}</td>
                      <td className="num">{s.contractsCount}</td>
                      <td className="num">{formatQty(s.contractedVolume, unit)}</td>
                      <td className="num">{formatQty(s.deliveredVolume, unit)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatQty(s.balanceVolume, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.byProductCrop && producerView.byProductAndCrop.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                4. Programação por Cultura e Safra
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Safra</th>
                    <th className="num">Contratos</th>
                    <th className="num">Contratado</th>
                    <th className="num">Entregue Reg.</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {producerView.byProductAndCrop.map((p) => (
                    <tr key={p.key}>
                      <td style={{ fontWeight: 700 }}>{p.product}</td>
                      <td>{p.crop}</td>
                      <td className="num">{p.contractsCount}</td>
                      <td className="num">{formatQty(p.contractedVolume, unit)}</td>
                      <td className="num">{formatQty(p.deliveredVolume, unit)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatQty(p.balanceVolume, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.byFarm && producerView.byFarm.length > 0 && (
            <div className="section-box">
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                5. Programação por Fazenda e Local de Embarque
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Fazenda</th>
                    <th>Local de Embarque</th>
                    <th className="num">Contratos</th>
                    <th className="num">Contratado</th>
                    <th className="num">Entregue Reg.</th>
                    <th className="num">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {producerView.byFarm.map((f) => (
                    <tr key={f.key}>
                      <td style={{ fontWeight: 700 }}>{f.farmName}</td>
                      <td>{f.pickupLocation}</td>
                      <td className="num">{f.contractsCount}</td>
                      <td className="num">{formatQty(f.contractedVolume, unit)}</td>
                      <td className="num">{formatQty(f.deliveredVolume, unit)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{formatQty(f.balanceVolume, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sections.analyticalContracts && producerView.contracts.length > 0 && (
            <div>
              <h2 style={{ fontSize: '11.5px', fontWeight: 700, color: '#065f46', margin: '0 0 6px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '3px' }}>
                6. Relação Detalhada de Contratos e Entregas ({producerView.contracts.length})
              </h2>
              <table>
                <thead>
                  <tr>
                    {selectedColumns.contractNumber !== false && <th>Contrato</th>}
                    {selectedColumns.product !== false && <th>Produto / Safra</th>}
                    {selectedColumns.farmName !== false && <th>Fazenda</th>}
                    {selectedColumns.pickupLocation !== false && <th>Local Embarque</th>}
                    {selectedColumns.freightType !== false && <th>Frete</th>}
                    {selectedColumns.periodLabel !== false && <th>Período</th>}
                    {selectedColumns.contractedVolume !== false && <th className="num">Contratado</th>}
                    {selectedColumns.deliveredVolume !== false && <th className="num">Entregue</th>}
                    {selectedColumns.balanceVolume !== false && <th className="num">Saldo</th>}
                    {selectedColumns.logisticsStatus !== false && <th>Situação</th>}
                  </tr>
                </thead>
                <tbody>
                  {producerView.contracts.map((c) => (
                    <tr key={c.contractId}>
                      {selectedColumns.contractNumber !== false && <td style={{ fontWeight: 700 }}>{c.contractNumber}</td>}
                      {selectedColumns.product !== false && <td>{c.product} · {c.crop}</td>}
                      {selectedColumns.farmName !== false && <td>{c.farmName}</td>}
                      {selectedColumns.pickupLocation !== false && <td>{c.pickupLocation}</td>}
                      {selectedColumns.freightType !== false && <td>{c.freightType}</td>}
                      {selectedColumns.periodLabel !== false && <td>{c.exactDatesLabel}</td>}
                      {selectedColumns.contractedVolume !== false && <td className="num">{formatQty(c.contractedVolume, unit)}</td>}
                      {selectedColumns.deliveredVolume !== false && <td className="num">{formatQty(c.deliveredVolume, unit)}</td>}
                      {selectedColumns.balanceVolume !== false && <td className="num">{formatQty(c.balanceVolume, unit)}</td>}
                      {selectedColumns.logisticsStatus !== false && <td>{c.logisticsStatusLabel}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {renderFooter()}
        </div>
      );
    }

    // LOGISTICS_INTERNAL
    const { summary, matrix, gantt, analyticalRows, mode, includeCharts, unit, metricLabel, selectedColumns } = payload;
    return (
      <div style={{ padding: '4mm' }}>
        {renderHeader(`Relatório Interno — Programação de Entregas e Retiradas (${metricLabel})`, [
          `Unidade: ${unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)'} • Contratos com romaneios: ${summary.contractsWithShipments}/${summary.contractsCount}${
            matrix.isSimulated ? ' • MODO SIMULAÇÃO PROPORCIONAL ATIVO (ESTIMATIVA)' : ''
          }`
        ])}
        {renderFiltersBar(payload.filtersSummary)}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>TOTAL PROGRAMADO</div>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px' }}>{formatQty(summary.totalContracted, unit)}</div>
            <div style={{ fontSize: '8.5px', color: '#64748b' }}>{summary.contractsCount} contratos · {summary.producersCount} produtores</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>ENTREGUE / SALDO</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, marginTop: '2px', color: '#059669' }}>{formatQty(summary.totalDelivered, unit)} entr.</div>
            <div style={{ fontSize: '8.5px', color: '#b45309' }}>Saldo: {formatQty(summary.totalBalance, unit)}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>QUINZENA DEFINIDA × JANELA ABERTA</div>
            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>1Q exata: {formatQty(summary.definedFortnightContracted, unit)}</div>
            <div style={{ fontSize: '8.5px', color: '#64748b' }}>Abertas/Mês: {formatQty(summary.openWindowContracted + summary.fullMonthContracted, unit)}</div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px' }}>
            <div style={{ fontSize: '8.5px', color: '#64748b', fontWeight: 700 }}>FOB × CIF (SALDO)</div>
            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>FOB: {formatQty(summary.fobBalance, unit)}</div>
            <div style={{ fontSize: '8.5px', color: '#64748b' }}>CIF: {formatQty(summary.cifBalance, unit)}</div>
          </div>
        </div>

        {includeCharts && summary.byPeriodChart.length > 0 && (
          <SimplePrintBarSvg
            title={`Concentração por Mês de Programação (${unit === 'TON' ? 'ton' : 'scs'})`}
            items={summary.byPeriodChart.slice(0, 12).map((m) => ({
              label: m.label,
              value: m.totalVolume,
              displayValue: m.totalVolume >= 1000 ? `${(m.totalVolume / 1000).toFixed(0)}k` : m.totalVolume.toFixed(0)
            }))}
            barColor={matrix.isSimulated ? '#d97706' : '#059669'}
          />
        )}

        {mode === 'SYNTHETIC' && (
          <div>
            <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>
              Programação Sintética ({metricLabel}){matrix.isSimulated ? ' — SIMULAÇÃO PROPORCIONAL' : ''}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Agrupamento</th>
                  {matrix.columns.slice(0, 14).map((c) => (
                    <th key={c.key} className="num">{c.label}</th>
                  ))}
                  <th className="num">Total</th>
                  <th className="num">Part. (%)</th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((r) => (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 700 }}>{r.label}</td>
                    {matrix.columns.slice(0, 14).map((c) => (
                      <td key={c.key} className="num">
                        {r.cells[c.key]?.value ? r.cells[c.key].value.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '-'}
                      </td>
                    ))}
                    <td className="num" style={{ fontWeight: 700 }}>{r.total.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="num">{r.sharePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <td>TOTAL GERAL</td>
                  {matrix.columns.slice(0, 14).map((c) => (
                    <td key={c.key} className="num">{(matrix.colTotals[c.key] || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  ))}
                  <td className="num">{matrix.grandTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                  <td className="num">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {(mode === 'ANALYTICAL' || mode === 'GANTT') && (
          <div>
            <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>
              {mode === 'GANTT'
                ? `Cronograma de Entregas — Janelas Contratuais (${gantt.items.length} contratos)`
                : `Relatório Analítico de Programação (${analyticalRows.length} contratos)`}
            </h2>
            <table>
              <thead>
                <tr>
                  {selectedColumns.contractNumber !== false && <th>Contrato</th>}
                  {selectedColumns.producerName !== false && <th>Produtor</th>}
                  {selectedColumns.farmName !== false && <th>Fazenda</th>}
                  {selectedColumns.product !== false && <th>Produto / Safra</th>}
                  {selectedColumns.buyerName && <th>Comprador</th>}
                  {selectedColumns.freightType !== false && <th>Frete</th>}
                  {selectedColumns.pickupLocation !== false && <th>Local Embarque</th>}
                  {selectedColumns.periodLabel !== false && <th>Período / Datas</th>}
                  {selectedColumns.contractedVolume !== false && <th className="num">Contratado</th>}
                  {selectedColumns.deliveredVolume !== false && <th className="num">Entregue</th>}
                  {selectedColumns.balanceVolume !== false && <th className="num">Saldo</th>}
                  {selectedColumns.logisticsStatus !== false && <th>Situação</th>}
                </tr>
              </thead>
              <tbody>
                {analyticalRows.map((r) => (
                  <tr key={r.contractId}>
                    {selectedColumns.contractNumber !== false && <td style={{ fontWeight: 700 }}>{r.contractNumber}</td>}
                    {selectedColumns.producerName !== false && <td>{r.producerName}</td>}
                    {selectedColumns.farmName !== false && <td>{r.farmName}</td>}
                    {selectedColumns.product !== false && <td>{r.product} · {r.crop}</td>}
                    {selectedColumns.buyerName && <td>{r.buyerName}</td>}
                    {selectedColumns.freightType !== false && <td>{r.freightType}</td>}
                    {selectedColumns.pickupLocation !== false && <td>{r.pickupLocation}</td>}
                    {selectedColumns.periodLabel !== false && <td>{r.window.exactDatesLabel}</td>}
                    {selectedColumns.contractedVolume !== false && <td className="num">{formatQty(r.contractedVolume, unit)}</td>}
                    {selectedColumns.deliveredVolume !== false && <td className="num">{formatQty(r.deliveredVolume, unit)}</td>}
                    {selectedColumns.balanceVolume !== false && <td className="num">{formatQty(r.balanceVolume, unit)}</td>}
                    {selectedColumns.logisticsStatus !== false && <td>{r.logisticsStatusLabel}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mode === 'TRACKING' && (
          <div>
            <h2 style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 6px 0' }}>
              Acompanhamento de Entregas e Concentração por Local de Embarque
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Local de Embarque</th>
                  <th className="num">Contratos</th>
                  <th className="num">Contratado</th>
                  <th className="num">Entregue Reg.</th>
                  <th className="num">Saldo</th>
                  <th className="num">FOB</th>
                  <th className="num">CIF</th>
                </tr>
              </thead>
              <tbody>
                {summary.byPickupLocation.map((p) => (
                  <tr key={p.key}>
                    <td style={{ fontWeight: 700 }}>{p.label}</td>
                    <td className="num">{p.contractsCount}</td>
                    <td className="num">{formatQty(p.contractedVolume, unit)}</td>
                    <td className="num">{formatQty(p.deliveredVolume, unit)}</td>
                    <td className="num">{formatQty(p.balanceVolume, unit)}</td>
                    <td className="num">{formatQty(p.fobVolume, unit)}</td>
                    <td className="num">{formatQty(p.cifVolume, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {renderFooter()}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className={`w-full ${isLandscape ? 'max-w-[297mm]' : 'max-w-[210mm]'} flex justify-between items-center mb-3 text-white`}>
        <div className="flex items-center gap-2">
          <Printer className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm truncate">{payload.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => iframeEl?.contentWindow?.print()}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors"
          >
            <X className="w-4 h-4" /> Fechar
          </button>
        </div>
      </div>

      <iframe
        ref={setIframeEl}
        title="Visualização de Impressão DMS Agro"
        className={`bg-white w-full ${isLandscape ? 'max-w-[297mm]' : 'max-w-[210mm]'} h-[82vh] shadow-2xl rounded-sm`}
      />

      {mountNode && createPortal(renderContent(), mountNode)}

      <p className="text-white/60 text-xs mt-3 flex items-center gap-1.5">
        <Sprout className="w-3.5 h-3.5 text-emerald-400" />
        Se a janela de impressão não abrir automaticamente, clique em &ldquo;Imprimir / Salvar PDF&rdquo; acima e escolha &ldquo;Salvar como PDF&rdquo;.
      </p>
    </div>
  );
};
