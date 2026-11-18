import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Printer, FileSpreadsheet, FileText, Info } from 'lucide-react';
import {
  VolumeAnalyticsResult,
  VolumeColDimension,
  VolumeMatrixResult,
  VolumeMetricMode,
  VolumeRowDimension,
  VolumeUnit
} from '../../services/reportsAnalytics';
import { buildVolumeExportSheets, downloadCsvFile, downloadXlsxWorkbook } from '../../services/reportsExport';

interface VolumeReportTabProps {
  analytics: VolumeAnalyticsResult;
  unit: VolumeUnit;
  onChangeUnit: (u: VolumeUnit) => void;
  filtersSummary: string[];
  buildMatrix: (
    rowDim: VolumeRowDimension,
    colDim: VolumeColDimension,
    metric: VolumeMetricMode
  ) => VolumeMatrixResult;
  onDrillDown: (title: string, subtitle: string, contractIds: string[]) => void;
  onOpenPrint: (params: {
    mode: 'SYNTHETIC' | 'MATRIX';
    matrix: VolumeMatrixResult;
    includeCharts: boolean;
    metricLabel: string;
  }) => void;
}

const METRIC_LABELS: Record<VolumeMetricMode, string> = {
  CONTRACTED: 'Volume Comercializado',
  SHIPPED: 'Volume Embarcado Registrado',
  PENDING: 'Saldo Pendente Conhecido',
  SHARE_PCT: 'Participação (%)'
};

export const VolumeReportTab: React.FC<VolumeReportTabProps> = ({
  analytics,
  unit,
  onChangeUnit,
  filtersSummary,
  buildMatrix,
  onDrillDown,
  onOpenPrint
}) => {
  const [subView, setSubView] = useState<'OVERVIEW' | 'MATRIX' | 'RANKING'>('OVERVIEW');
  const [rowDim, setRowDim] = useState<VolumeRowDimension>('PRODUCER');
  const [colDim, setColDim] = useState<VolumeColDimension>('MONTH');
  const [metric, setMetric] = useState<VolumeMetricMode>('CONTRACTED');

  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const formatVol = (val: number) =>
    `${val.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} ${unitLabel}`;

  const matrix = useMemo(
    () => buildMatrix(rowDim, colDim, metric),
    [buildMatrix, rowDim, colDim, metric]
  );

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const mode = subView === 'MATRIX' ? 'MATRIX' : subView === 'RANKING' ? 'SYNTHETIC' : 'ALL';
    const sheets = buildVolumeExportSheets(analytics, matrix, unit, mode);
    if (format === 'CSV') {
      const target = sheets[0];
      if (!target) return;
      downloadCsvFile(`DMS_Volume_Comercial_${mode}`, target.headers, target.rows, [
        `DMS Agro — Relatório de Volume Comercial (${unit === 'TON' ? 'Toneladas' : 'Sacas 60kg'})`,
        `Filtros: ${filtersSummary.length > 0 ? filtersSummary.join(' | ') : 'Sem restrição'}`
      ]);
    } else {
      downloadXlsxWorkbook(`DMS_Volume_Comercial_${mode}`, sheets, [
        ['Relatório', 'Volume Comercial & Matriz Dinâmica'],
        ['Unidade', unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)'],
        [
          'Cobertura Logística',
          `${analytics.logisticsCoverage.contractsWithShipments}/${analytics.logisticsCoverage.contractsTotal} contratos (${analytics.logisticsCoverage.contractsPct.toFixed(1)}%)`
        ],
        ['Filtros Aplicados', filtersSummary.length > 0 ? filtersSummary.join(' | ') : 'Todos os registros']
      ]);
    }
  };

  return (
    <div className="space-y-5">
      {/* Unit Switcher & Explicit Date/Logistics Coverage Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 text-xs text-slate-700">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong className="text-slate-900">Critério temporal:</strong> Comercializado usa data de fechamento (<code>closingDate</code>)
              <span className="text-slate-400"> · </span>Embarcado usa data de entrega (<code>deliveryDate</code>)
              <span className="text-slate-400"> · </span>Pendente usa previsão final de embarque.
            </p>
            <p className="text-[11px] text-slate-500">
              Cobertura logística registrada: <strong>{analytics.logisticsCoverage.contractsWithShipments}</strong> de{' '}
              <strong>{analytics.logisticsCoverage.contractsTotal}</strong> contratos possuem embarques lançados ({analytics.logisticsCoverage.contractsPct.toFixed(1)}%). A ausência de registros logísticos em contratos antigos não comprova ausência de retirada física.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex border border-slate-300 rounded-lg overflow-hidden text-xs font-semibold">
            <button
              type="button"
              onClick={() => onChangeUnit('SCS')}
              className={`px-3 py-1.5 ${unit === 'SCS' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Sacas (60kg)
            </button>
            <button
              type="button"
              onClick={() => onChangeUnit('TON')}
              className={`px-3 py-1.5 ${unit === 'TON' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Toneladas
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleExport('CSV')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('XLSX')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenPrint({
                mode: subView === 'MATRIX' ? 'MATRIX' : 'SYNTHETIC',
                matrix,
                includeCharts: subView !== 'MATRIX',
                metricLabel: METRIC_LABELS[metric]
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 tabular-nums">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Volume Comercializado
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatVol(analytics.totalContracted)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {analytics.contractsCount} contrato(s) · {analytics.producersCount} produtor(es)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Embarcado Registrado
          </p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{formatVol(analytics.totalShipped)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {analytics.totalContracted > 0
              ? `${((analytics.totalShipped / analytics.totalContracted) * 100).toFixed(1)}% do contratado`
              : '-'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Saldo Pendente Conhecido
          </p>
          <p className="text-xl font-bold text-amber-700 mt-1">{formatVol(analytics.totalPending)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">Contratado menos embarcado registrado</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Média por Contrato
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatVol(analytics.avgPerContract)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">Lote médio negociado</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Média por Produtor
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatVol(analytics.avgPerProducer)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">Volume médio por cadastro</p>
        </div>
      </div>

      {/* Sub-view Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap gap-1 w-fit">
        {(
          [
            { id: 'OVERVIEW', label: 'Evolução & Culturas' },
            { id: 'MATRIX', label: 'Matriz Dinâmica (Pivot)' },
            { id: 'RANKING', label: 'Ranking de Produtores' }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubView(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              subView === tab.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBVIEW: OVERVIEW */}
      {subView === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Evolução Mensal: Comercializado × Embarcado × Acumulado ({unitLabel})
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Clique em uma barra mensal para visualizar os contratos correspondentes.
              </p>
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analytics.monthlySeries.slice(-24)}
                    margin={{ top: 10, right: 16, left: 10, bottom: 5 }}
                    onClick={(state: any) => {
                      const idx = state?.activeTooltipIndex;
                      const slice = analytics.monthlySeries.slice(-24);
                      if (typeof idx === 'number' && slice[idx]) {
                        const m = slice[idx];
                        onDrillDown(
                          `Contratos — ${m.label}`,
                          `${m.contractIds.length} contrato(s) com fechamento/embarque neste mês`,
                          m.contractIds
                        );
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip
                      formatter={(val: number) => formatVol(val)}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="contracted" name="Comercializado" fill="#059669" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                    <Bar yAxisId="left" dataKey="shipped" name="Embarcado Reg." fill="#3b82f6" radius={[4, 4, 0, 0]} className="cursor-pointer" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulativeContracted" name="Acumulado" stroke="#0f172a" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Comparativo por Safra ({unitLabel})</h3>
              <p className="text-xs text-slate-500 mb-4">Crescimento percentual relativo à safra anterior.</p>
              <div className="h-[220px] mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.byCrop} margin={{ top: 8, right: 8, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="crop" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#475569' }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip formatter={(val: number) => formatVol(val)} />
                    <Bar dataKey="contracted" name="Comercializado" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y divide-slate-100 text-xs tabular-nums">
                {analytics.byCrop.map((c) => (
                  <div key={c.crop} className="py-1.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Safra {c.crop}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-900 font-medium">{formatVol(c.contracted)}</span>
                      <span
                        className={`w-16 text-right font-semibold ${
                          c.growthVsPrevPct === null
                            ? 'text-slate-400'
                            : c.growthVsPrevPct >= 0
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {c.growthVsPrevPct !== null
                          ? `${c.growthVsPrevPct >= 0 ? '+' : ''}${c.growthVsPrevPct.toFixed(1)}%`
                          : '-'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Breakdown by Product */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Consolidado por Produto</h3>
            </div>
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Produto</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Comercializado ({unitLabel})</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Embarcado Reg. ({unitLabel})</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Pendente Conhecido ({unitLabel})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.byProduct.map((p) => (
                  <tr key={p.product} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{p.product}</td>
                    <td className="py-2.5 px-3 text-right">{p.contractsCount}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatVol(p.contracted)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">{formatVol(p.shipped)}</td>
                    <td className="py-2.5 px-4 text-right text-amber-700">{formatVol(p.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW: DYNAMIC MATRIX */}
      {subView === 'MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Matriz Dinâmica de Volumes</h3>
              <p className="text-xs text-slate-500">
                Configure linhas, colunas e métrica. Clique em qualquer célula para detalhar os contratos.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={rowDim}
                onChange={(e) => setRowDim(e.target.value as VolumeRowDimension)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="PRODUCER">Linhas: Produtor</option>
                <option value="GROUP_SELECTION">Linhas: Seleção / Grupo Consolidado</option>
                <option value="FARM">Linhas: Fazenda</option>
                <option value="PRODUCT">Linhas: Produto</option>
                <option value="CROP">Linhas: Safra</option>
              </select>
              <select
                value={colDim}
                onChange={(e) => setColDim(e.target.value as VolumeColDimension)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="MONTH">Colunas: Mês</option>
                <option value="QUARTER">Colunas: Trimestre</option>
                <option value="YEAR">Colunas: Ano</option>
                <option value="CROP">Colunas: Safra</option>
              </select>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as VolumeMetricMode)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="CONTRACTED">Valor: Comercializado</option>
                <option value="SHIPPED">Valor: Embarcado Reg.</option>
                <option value="PENDING">Valor: Pendente Conhecido</option>
                <option value="SHARE_PCT">Valor: Participação (%)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-100 py-2.5 px-4 font-bold min-w-[220px] border-r border-slate-200">
                    Dimensão
                  </th>
                  {matrix.colKeys.map((ck) => (
                    <th key={ck} className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                      {matrix.colLabels[ck]}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-bold text-right bg-emerald-50 text-emerald-900 border-l border-slate-200 whitespace-nowrap">
                    Total ({metric === 'SHARE_PCT' ? '%' : unitLabel})
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right text-slate-600 whitespace-nowrap">Part. %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white py-2 px-4 font-semibold text-slate-900 border-r border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          onDrillDown(`Contratos — ${r.label}`, `${r.contractIds.length} contrato(s)`, r.contractIds)
                        }
                        className="text-left hover:text-emerald-700"
                      >
                        <span className="block truncate max-w-[210px]">{r.label}</span>
                        {r.subLabel && (
                          <span className="block text-[10px] font-normal text-slate-400 truncate max-w-[210px]">
                            {r.subLabel}
                          </span>
                        )}
                      </button>
                    </td>
                    {matrix.colKeys.map((ck) => {
                      const cell = r.cells[ck];
                      return (
                        <td key={ck} className="py-2 px-3 text-right whitespace-nowrap">
                          {cell && cell.value > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onDrillDown(
                                  `${r.label} — ${matrix.colLabels[ck]}`,
                                  `${cell.contractIds.length} contrato(s)`,
                                  cell.contractIds
                                )
                              }
                              className="text-slate-800 hover:text-emerald-700 hover:underline font-medium"
                            >
                              {metric === 'SHARE_PCT'
                                ? `${cell.value.toFixed(2)}%`
                                : cell.value.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 1 : 0 })}
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-bold text-slate-900 bg-emerald-50/40 border-l border-slate-200 whitespace-nowrap">
                      {metric === 'SHARE_PCT'
                        ? `${r.total.toFixed(2)}%`
                        : r.total.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600 whitespace-nowrap">{r.sharePct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td className="sticky left-0 z-30 bg-slate-100 py-2.5 px-4 border-r border-slate-200">TOTAL GERAL</td>
                  {matrix.colKeys.map((ck) => (
                    <td key={ck} className="py-2.5 px-3 text-right whitespace-nowrap">
                      {metric === 'SHARE_PCT'
                        ? `${(matrix.colTotals[ck] || 0).toFixed(1)}%`
                        : (matrix.colTotals[ck] || 0).toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 1 : 0 })}
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-right bg-emerald-100/80 text-emerald-950 border-l border-slate-200 whitespace-nowrap">
                    {metric === 'SHARE_PCT' ? '100,0%' : formatVol(matrix.grandTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">100,0%</td>
                </tr>
                <tr className="bg-slate-50 font-semibold text-slate-600 text-[11px]">
                  <td className="sticky left-0 z-30 bg-slate-50 py-2 px-4 border-r border-slate-200">
                    ACUMULADO PROGRESSIVO
                  </td>
                  {matrix.colKeys.map((ck) => (
                    <td key={ck} className="py-2 px-3 text-right whitespace-nowrap">
                      {metric === 'SHARE_PCT'
                        ? `${(matrix.colCumulative[ck] || 0).toFixed(1)}%`
                        : (matrix.colCumulative[ck] || 0).toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 1 : 0 })}
                    </td>
                  ))}
                  <td colSpan={2} className="py-2 px-3 text-right text-slate-500 border-l border-slate-200">
                    Saldo acumulado na série
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW: RANKING */}
      {subView === 'RANKING' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">Ranking de Produtores por Volume Comercializado</h3>
            <p className="text-xs text-slate-500">Clique em qualquer linha para abrir os contratos do produtor.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">#</th>
                  <th className="py-2.5 px-3 font-semibold">Produtor</th>
                  <th className="py-2.5 px-3 font-semibold">CPF/CNPJ</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Comercializado ({unitLabel})</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Embarcado Reg. ({unitLabel})</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Pendente Conhec. ({unitLabel})</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.producerRanking.map((p, idx) => (
                  <tr
                    key={p.producerKey}
                    onClick={() =>
                      onDrillDown(`Contratos — ${p.name}`, `${p.contractsCount} contrato(s)`, p.contractIds)
                    }
                    className="hover:bg-emerald-50/40 cursor-pointer"
                  >
                    <td className="py-2.5 px-4 text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-3 text-slate-500">{p.doc || '-'}</td>
                    <td className="py-2.5 px-3 text-right">{p.contractsCount}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatVol(p.contracted)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-700">{formatVol(p.shipped)}</td>
                    <td className="py-2.5 px-3 text-right text-amber-700">{formatVol(p.pending)}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-slate-700">{p.sharePct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
