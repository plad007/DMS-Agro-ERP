import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  Columns,
  ArrowUpDown,
  Info
} from 'lucide-react';
import {
  CommissionAnalyticsResult,
  CommissionContractRow,
  CommissionMatrixData,
  ReportFilterState,
  formatDateBR,
  formatMonthLabel
} from '../../services/reportsAnalytics';
import { buildCommissionExportSheets, downloadCsvFile, downloadXlsxWorkbook } from '../../services/reportsExport';

interface CommissionReportTabProps {
  analytics: CommissionAnalyticsResult;
  filters: ReportFilterState;
  filtersSummary: string[];
  consolidatedLabel?: string;
  buildMatrix: (rowDim: CommissionMatrixData['rowDimension']) => CommissionMatrixData;
  onDrillDown: (title: string, subtitle: string, contractIds: string[]) => void;
  onOpenPrint: (params: {
    mode: 'SYNTHETIC' | 'ANALYTICAL' | 'MATRIX';
    matrix: CommissionMatrixData;
    includeCharts: boolean;
    selectedColumns: Record<string, boolean>;
  }) => void;
}

const formatBRL = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ANALYTICAL_COL_OPTIONS: Array<{ key: string; label: string; defaultOn: boolean }> = [
  { key: 'contractNumber', label: 'Contrato', defaultOn: true },
  { key: 'producerName', label: 'Produtor / Vendedor', defaultOn: true },
  { key: 'farmName', label: 'Fazenda', defaultOn: false },
  { key: 'product', label: 'Produto', defaultOn: true },
  { key: 'crop', label: 'Safra', defaultOn: true },
  { key: 'closingDate', label: 'Fechamento', defaultOn: true },
  { key: 'totalBags', label: 'Vol. Contratado (scs)', defaultOn: true },
  { key: 'shippedBags', label: 'Vol. Embarcado (scs)', defaultOn: false },
  { key: 'commissionPerBag', label: 'Comissão (R$/sc)', defaultOn: true },
  { key: 'contractedCommission', label: 'Comissão Total (R$)', defaultOn: true },
  { key: 'shippedCommission', label: 'Prop. Embarque (R$)', defaultOn: false },
  { key: 'contractCurrency', label: 'Moeda Mercadoria', defaultOn: false },
  { key: 'dueDate', label: 'Previsão Receb.', defaultOn: true },
  { key: 'financialStatus', label: 'Status / Origem', defaultOn: true },
  { key: 'effectiveReceiptDate', label: 'Recebimento Efetivo', defaultOn: false }
];

export const CommissionReportTab: React.FC<CommissionReportTabProps> = ({
  analytics,
  filtersSummary,
  buildMatrix,
  onDrillDown,
  onOpenPrint
}) => {
  const [subView, setSubView] = useState<'OVERVIEW' | 'SYNTHETIC' | 'MATRIX' | 'ANALYTICAL'>('OVERVIEW');
  const [matrixRowDim, setMatrixRowDim] = useState<CommissionMatrixData['rowDimension']>('PRODUCER');
  const [syntheticGroupBy, setSyntheticGroupBy] = useState<'MONTH' | 'PRODUCER' | 'PRODUCER_MONTH' | 'PRODUCT' | 'CROP'>('PRODUCER');

  // Analytical state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'closingDate' | 'dueDate' | 'contractedCommission' | 'producerName' | 'contractNumber'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showColPicker, setShowColPicker] = useState(false);
  const [selectedCols, setSelectedCols] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ANALYTICAL_COL_OPTIONS.forEach((c) => (initial[c.key] = c.defaultOn));
    return initial;
  });

  const matrix = useMemo(() => buildMatrix(matrixRowDim), [buildMatrix, matrixRowDim]);

  // Producer x Month synthetic grouping (sempre consolidado em BRL)
  const producerByMonthRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        producerName: string;
        monthKey: string;
        monthLabel: string;
        contractsCount: number;
        brl: number;
        contractIds: string[];
      }
    >();

    for (const r of analytics.rows) {
      for (const sl of r.slices) {
        const mk = sl.monthKey;
        const key = `${r.producerKey}::${mk}`;
        const existing = map.get(key) || {
          key,
          producerName: r.producerName,
          monthKey: mk,
          monthLabel: mk === '__UNDEFINED__' ? 'Sem vencimento' : formatMonthLabel(mk),
          contractsCount: 0,
          brl: 0,
          contractIds: []
        };
        if (!existing.contractIds.includes(r.contractId)) {
          existing.contractsCount += 1;
          existing.contractIds.push(r.contractId);
        }
        existing.brl += sl.amount;
        map.set(key, existing);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.monthKey === '__UNDEFINED__' && b.monthKey !== '__UNDEFINED__') return 1;
      if (b.monthKey === '__UNDEFINED__' && a.monthKey !== '__UNDEFINED__') return -1;
      const cmp = b.monthKey.localeCompare(a.monthKey);
      return cmp !== 0 ? cmp : b.brl - a.brl;
    });
  }, [analytics.rows]);

  // Analytical filtering & sorting
  const filteredAnalytical = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = term
      ? analytics.rows.filter(
          (r) =>
            r.contractNumber.toLowerCase().includes(term) ||
            r.producerName.toLowerCase().includes(term) ||
            r.farmName.toLowerCase().includes(term) ||
            r.product.toLowerCase().includes(term) ||
            r.crop.toLowerCase().includes(term)
        )
      : [...analytics.rows];

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'contractedCommission') {
        cmp = a.contractedCommission - b.contractedCommission;
      } else if (sortField === 'producerName') {
        cmp = a.producerName.localeCompare(b.producerName);
      } else if (sortField === 'contractNumber') {
        cmp = a.contractNumber.localeCompare(b.contractNumber);
      } else if (sortField === 'closingDate') {
        cmp = (a.closingDate || '').localeCompare(b.closingDate || '');
      } else {
        cmp = (a.dueDate || '0000-00-00').localeCompare(b.dueDate || '0000-00-00');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [analytics.rows, searchTerm, sortField, sortDir]);

  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(filteredAnalytical.length / pageSize));
  const pagedAnalytical = useMemo(
    () => filteredAnalytical.slice((page - 1) * pageSize, page * pageSize),
    [filteredAnalytical, page]
  );

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const handleExport = (format: 'CSV' | 'XLSX') => {
    const mode = subView === 'MATRIX' ? 'MATRIX' : subView === 'ANALYTICAL' ? 'ANALYTICAL' : subView === 'SYNTHETIC' ? 'SYNTHETIC' : 'ALL';
    const sheets = buildCommissionExportSheets(analytics, matrix, mode, selectedCols);
    if (format === 'CSV') {
      const target = sheets[0];
      if (!target) return;
      downloadCsvFile(`DMS_Comissoes_${mode}`, target.headers, target.rows, [
        'DMS Agro — Relatório de Comissões (Pagador exclusivo: Vendedor/Produtor · Valores sempre em BRL / R$)',
        `Filtros: ${filtersSummary.length > 0 ? filtersSummary.join(' | ') : 'Sem restrição'}`
      ]);
    } else {
      downloadXlsxWorkbook(
        `DMS_Comissoes_${mode}`,
        sheets,
        [
          ['Relatório', 'Comissões de Corretagem — DMS Agro ERP'],
          ['Regra de Pagador', 'Sempre o Vendedor / Produtor'],
          ['Moeda da Comissão', 'Sempre Reais (BRL), sem conversão cambial'],
          ['Controle de Recebimentos', 'Recebimentos efetivos ainda não controlados'],
          ['Filtros Aplicados', filtersSummary.length > 0 ? filtersSummary.join(' | ') : 'Todos os registros']
        ]
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Business Rule & Receipt Integrity Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3 text-xs text-slate-700">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong className="text-slate-900">Responsável pelo pagamento:</strong> sempre o Vendedor/Produtor
              <span className="text-slate-400"> · </span>
              <strong className="text-slate-900">Moeda da comissão:</strong> sempre Reais (R$), sem conversão cambial (inclusive em contratos negociados em USD)
              <span className="text-slate-400"> · </span>
              <strong className="text-slate-900">Recebimentos:</strong> ainda não controlados.
            </p>
            <p className="text-[11px] text-slate-500">
              Cálculo definitivo: Comissão Total (R$) = Volume contratado em sacas × Valor unitário (R$/sc). Previsões distinguem vencimento confirmado de estimativa legada/por embarque.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                mode: subView === 'MATRIX' ? 'MATRIX' : subView === 'ANALYTICAL' ? 'ANALYTICAL' : 'SYNTHETIC',
                matrix,
                includeCharts: subView === 'OVERVIEW' || subView === 'SYNTHETIC',
                selectedColumns: selectedCols
              })
            }
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
        </div>
      </div>

      {/* KPI Cards (Strictly consolidated in BRL) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 tabular-nums">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Comissão Contratada (R$)
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatBRL(analytics.totalContractedBRL)}</p>
          <p className="text-[11px] text-slate-500 mt-2">
            {analytics.contractsCount} contratos · {analytics.totalBags.toLocaleString('pt-BR')} scs
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Prevista no Período (R$)
          </p>
          <p className="text-xl font-bold text-emerald-700 mt-1">
            {formatBRL(analytics.forecastTotalPeriodBRL)}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Conf.: {formatBRL(analytics.forecastConfirmedBRL)} · Est.: {formatBRL(analytics.forecastEstimatedBRL)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Sem Vencimento Definido
          </p>
          <p className="text-xl font-bold text-amber-700 mt-1">
            {formatBRL(analytics.undefinedDueBRL)}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Aguardando embarque ou data de pgto
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Média / sc &amp; Prop. Embarque
          </p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {analytics.weightedAvgPerBagBRL !== null
              ? `${formatBRL(analytics.weightedAvgPerBagBRL)}/sc`
              : '-'}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Prop. embarque: {formatBRL(analytics.totalShippedBRL)}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Recebida / A Receber / Vencida
          </p>
          <p className="text-xs font-bold text-amber-800 mt-2">
            Recebimentos ainda não controlados
          </p>
          <p className="text-[11px] text-slate-600 mt-1.5 leading-snug">
            Baixas parciais e conciliação serão ativadas após autorização da tabela <code>commission_receipts</code>.
          </p>
        </div>
      </div>

      {/* Sub-view Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-wrap gap-1 w-fit">
        {(
          [
            { id: 'OVERVIEW', label: 'Visão Geral & Gráficos' },
            { id: 'SYNTHETIC', label: 'Visão Sintética' },
            { id: 'MATRIX', label: 'Matriz Dinâmica' },
            { id: 'ANALYTICAL', label: `Analítico (${analytics.rows.length})` }
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Previsão Mensal de Recebimento de Comissões (R$)
              </h3>
              <p className="text-xs text-slate-500">
                Separação entre previsão confirmada e estimada (todos os contratos consolidados em BRL). Clique em uma barra para listar contratos.
              </p>
            </div>

            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics.monthlySeries}
                  margin={{ top: 12, right: 16, left: 10, bottom: 8 }}
                  onClick={(state: any) => {
                    const idx = state?.activeTooltipIndex;
                    if (typeof idx === 'number' && analytics.monthlySeries[idx]) {
                      const entry = analytics.monthlySeries[idx];
                      onDrillDown(
                        `Comissões Previstas — ${entry.label}`,
                        `${entry.contractIds.length} contrato(s) com previsão neste mês`,
                        entry.contractIds
                      );
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#475569' }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => formatBRL(val)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar
                    dataKey="confirmedBRL"
                    name="Previsto Confirmado (R$)"
                    stackId="a"
                    fill="#059669"
                    radius={[0, 0, 0, 0]}
                    className="cursor-pointer"
                  />
                  <Bar
                    dataKey="estimatedBRL"
                    name="Previsto Estimado (R$)"
                    stackId="a"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Top Produtores em Comissão (R$)</h3>
            <p className="text-xs text-slate-500 mb-4">Clique no produtor para abrir seus contratos.</p>
            <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto tabular-nums">
              {analytics.summaryByProducer.slice(0, 12).map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() =>
                    onDrillDown(
                      `Contratos — ${p.name}`,
                      `${p.contractsCount} contrato(s) filtrados`,
                      p.contractIds
                    )
                  }
                  className="w-full py-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 px-1.5 rounded transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-800 truncate">{p.name}</span>
                    <span className="block text-[11px] text-slate-500">
                      {p.contractsCount} contratos · {p.totalBags.toLocaleString('pt-BR')} scs
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-xs font-bold text-slate-900">{formatBRL(p.totalBRL)}</span>
                  </span>
                </button>
              ))}
              {analytics.summaryByProducer.length === 0 && (
                <p className="text-xs text-slate-400 py-8 text-center">Nenhum registro para os filtros aplicados.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBVIEW: SYNTHETIC */}
      {subView === 'SYNTHETIC' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">Agrupamento Sintético (Valores em R$)</h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'PRODUCER', label: 'Por Produtor' },
                  { id: 'MONTH', label: 'Por Mês' },
                  { id: 'PRODUCER_MONTH', label: 'Produtor × Mês' },
                  { id: 'PRODUCT', label: 'Por Produto' },
                  { id: 'CROP', label: 'Por Safra' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSyntheticGroupBy(opt.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold border whitespace-nowrap ${
                    syntheticGroupBy === opt.id
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {syntheticGroupBy === 'PRODUCER' && (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Produtor</th>
                    <th className="py-2.5 px-3 font-semibold">CPF/CNPJ</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Volume (scs)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratada (R$)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Confirmada (R$)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Estimada (R$)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Sem Venc. (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.summaryByProducer.map((p) => (
                    <tr
                      key={p.key}
                      onClick={() =>
                        onDrillDown(`Contratos — ${p.name}`, `${p.contractsCount} contrato(s)`, p.contractIds)
                      }
                      className="hover:bg-emerald-50/40 cursor-pointer"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{p.doc || '-'}</td>
                      <td className="py-2.5 px-3 text-right">{p.contractsCount}</td>
                      <td className="py-2.5 px-3 text-right">{p.totalBags.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatBRL(p.totalBRL)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">{formatBRL(p.confirmedBRL)}</td>
                      <td className="py-2.5 px-3 text-right text-blue-700">{formatBRL(p.estimatedBRL)}</td>
                      <td className="py-2.5 px-4 text-right text-amber-700">{formatBRL(p.undefinedBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {syntheticGroupBy === 'MONTH' && (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Mês/Ano</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Volume Base (scs)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Confirmada (R$)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Estimada (R$)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Total Previsto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.monthlySeries.map((m) => (
                    <tr
                      key={m.monthKey}
                      onClick={() =>
                        onDrillDown(`Comissões — ${m.label}`, `${m.contractIds.length} contrato(s)`, m.contractIds)
                      }
                      className="hover:bg-emerald-50/40 cursor-pointer"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{m.label}</td>
                      <td className="py-2.5 px-3 text-right">{m.contractIds.length}</td>
                      <td className="py-2.5 px-3 text-right">{m.volumeBags.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">{formatBRL(m.confirmedBRL)}</td>
                      <td className="py-2.5 px-3 text-right text-blue-700">{formatBRL(m.estimatedBRL)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">{formatBRL(m.totalBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {syntheticGroupBy === 'PRODUCER_MONTH' && (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Mês Previsão</th>
                    <th className="py-2.5 px-3 font-semibold">Produtor</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Comissão Prevista (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {producerByMonthRows.slice(0, 200).map((r) => (
                    <tr
                      key={r.key}
                      onClick={() =>
                        onDrillDown(`${r.producerName} — ${r.monthLabel}`, `${r.contractsCount} contrato(s)`, r.contractIds)
                      }
                      className="hover:bg-emerald-50/40 cursor-pointer"
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.monthLabel}</td>
                      <td className="py-2.5 px-3 text-slate-800">{r.producerName}</td>
                      <td className="py-2.5 px-3 text-right">{r.contractsCount}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{formatBRL(r.brl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {syntheticGroupBy === 'PRODUCT' && (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Produto</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Volume (scs)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Comissão Contratada (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.summaryByProduct.map((pr) => (
                    <tr key={pr.product} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{pr.product}</td>
                      <td className="py-2.5 px-3 text-right">{pr.contractsCount}</td>
                      <td className="py-2.5 px-3 text-right">{pr.totalBags.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{formatBRL(pr.totalBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {syntheticGroupBy === 'CROP' && (
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Safra</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Contratos</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Volume (scs)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Comissão Contratada (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.summaryByCrop.map((cr) => (
                    <tr key={cr.crop} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">Safra {cr.crop}</td>
                      <td className="py-2.5 px-3 text-right">{cr.contractsCount}</td>
                      <td className="py-2.5 px-3 text-right">{cr.totalBags.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">{formatBRL(cr.totalBRL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUBVIEW: MATRIX */}
      {subView === 'MATRIX' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Matriz Dinâmica de Comissões (R$)
              </h3>
              <p className="text-xs text-slate-500">
                Todos os valores consolidados em Reais (BRL). Clique em qualquer célula para visualizar os contratos correspondentes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={matrixRowDim}
                onChange={(e) => setMatrixRowDim(e.target.value as CommissionMatrixData['rowDimension'])}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
              >
                <option value="PRODUCER">Linhas: Produtores individuais</option>
                <option value="GROUP_SELECTION">Linhas: Seleção / Grupo Consolidado</option>
                <option value="PRODUCT">Linhas: Produto</option>
                <option value="CROP">Linhas: Safra</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-300 text-slate-700">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-100 py-2.5 px-4 font-bold min-w-[220px] border-r border-slate-200">
                    Agrupamento
                  </th>
                  {matrix.monthKeys.map((mk) => (
                    <th key={mk} className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                      {formatMonthLabel(mk)}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-bold text-right bg-emerald-50 text-emerald-900 whitespace-nowrap border-l border-slate-200">
                    Total Previsto (R$)
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-right text-amber-800 whitespace-nowrap">
                    Sem Venc. (R$)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrix.rows.map((r) => {
                  if (r.totalBRL === 0 && r.undefinedBRL === 0) return null;
                  return (
                    <tr key={r.key} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white py-2 px-4 font-semibold text-slate-900 border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            onDrillDown(
                              `Contratos — ${r.label}`,
                              `${r.contractIds.length} contrato(s)`,
                              r.contractIds
                            )
                          }
                          className="text-left hover:text-emerald-700 transition-colors"
                        >
                          <span className="block truncate max-w-[200px]">{r.label}</span>
                          {r.subLabel && (
                            <span className="block text-[10px] font-normal text-slate-400 truncate max-w-[200px]">
                              {r.subLabel}
                            </span>
                          )}
                        </button>
                      </td>
                      {matrix.monthKeys.map((mk) => {
                        const cell = r.cells[mk];
                        return (
                          <td key={mk} className="py-2 px-3 text-right whitespace-nowrap">
                            {cell && cell.amount > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onDrillDown(
                                    `${r.label} — ${formatMonthLabel(mk)}`,
                                    `${cell.contractIds.length} contrato(s) previstos`,
                                    cell.contractIds
                                  )
                                }
                                className="text-slate-800 hover:text-emerald-700 hover:underline font-medium"
                              >
                                {cell.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-bold text-slate-900 bg-emerald-50/40 border-l border-slate-200 whitespace-nowrap">
                        {formatBRL(r.totalBRL)}
                      </td>
                      <td className="py-2 px-3 text-right text-amber-700 whitespace-nowrap">
                        {r.undefinedBRL > 0 ? formatBRL(r.undefinedBRL) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td className="sticky left-0 z-30 bg-slate-100 py-2.5 px-4 border-r border-slate-200">
                    TOTAL GERAL (R$)
                  </td>
                  {matrix.monthKeys.map((mk) => {
                    const colTotal = matrix.colTotalsBRL[mk] || 0;
                    return (
                      <td key={mk} className="py-2.5 px-3 text-right whitespace-nowrap">
                        {colTotal > 0 ? colTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right bg-emerald-100/80 text-emerald-950 border-l border-slate-200 whitespace-nowrap">
                    {formatBRL(matrix.grandTotalBRL)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-amber-800 whitespace-nowrap">
                    {formatBRL(matrix.grandUndefinedBRL)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* SUBVIEW: ANALYTICAL */}
      {subView === 'ANALYTICAL' && (
        <div className="bg-white border border-slate-200 rounded-xl">
          <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 rounded-t-xl flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar contrato, produtor, fazenda..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowColPicker((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-100 rounded-lg text-slate-700"
              >
                <Columns className="w-3.5 h-3.5" /> Colunas
              </button>
              {showColPicker && (
                <div className="absolute right-0 top-10 z-40 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Colunas Visíveis</p>
                  {ANALYTICAL_COL_OPTIONS.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedCols[col.key] !== false}
                        onChange={() =>
                          setSelectedCols((prev) => ({
                            ...prev,
                            [col.key]: prev[col.key] === false
                          }))
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-b-xl">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  {selectedCols.contractNumber !== false && (
                    <th className="py-2.5 px-4 font-semibold">
                      <button type="button" onClick={() => toggleSort('contractNumber')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Contrato <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  {selectedCols.producerName !== false && (
                    <th className="py-2.5 px-3 font-semibold">
                      <button type="button" onClick={() => toggleSort('producerName')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Produtor <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  {selectedCols.farmName && <th className="py-2.5 px-3 font-semibold">Fazenda</th>}
                  {selectedCols.product !== false && <th className="py-2.5 px-3 font-semibold">Produto</th>}
                  {selectedCols.crop !== false && <th className="py-2.5 px-3 font-semibold">Safra</th>}
                  {selectedCols.closingDate !== false && (
                    <th className="py-2.5 px-3 font-semibold">
                      <button type="button" onClick={() => toggleSort('closingDate')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Fechamento <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  {selectedCols.totalBags !== false && <th className="py-2.5 px-3 font-semibold text-right">Vol. Contr. (scs)</th>}
                  {selectedCols.shippedBags && <th className="py-2.5 px-3 font-semibold text-right">Embarcado (scs)</th>}
                  {selectedCols.commissionPerBag !== false && <th className="py-2.5 px-3 font-semibold text-right">Comissão (R$/sc)</th>}
                  {selectedCols.contractedCommission !== false && (
                    <th className="py-2.5 px-3 font-semibold text-right">
                      <button type="button" onClick={() => toggleSort('contractedCommission')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Comissão Total (R$) <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  {selectedCols.shippedCommission && <th className="py-2.5 px-3 font-semibold text-right">Prop. Embarque (R$)</th>}
                  {selectedCols.contractCurrency && <th className="py-2.5 px-3 font-semibold">Moeda Merc.</th>}
                  {selectedCols.dueDate !== false && (
                    <th className="py-2.5 px-3 font-semibold">
                      <button type="button" onClick={() => toggleSort('dueDate')} className="inline-flex items-center gap-1 hover:text-slate-900">
                        Previsão Receb. <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                  )}
                  {selectedCols.financialStatus !== false && <th className="py-2.5 px-3 font-semibold">Status / Origem</th>}
                  {selectedCols.effectiveReceiptDate && <th className="py-2.5 px-4 font-semibold">Recebimento</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedAnalytical.map((r: CommissionContractRow) => (
                  <tr key={r.contractId} className="hover:bg-slate-50">
                    {selectedCols.contractNumber !== false && (
                      <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">{r.contractNumber}</td>
                    )}
                    {selectedCols.producerName !== false && (
                      <td className="py-2.5 px-3 text-slate-800 max-w-[200px] truncate" title={r.producerName}>
                        {r.producerName}
                      </td>
                    )}
                    {selectedCols.farmName && (
                      <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={r.farmName}>
                        {r.farmName}
                      </td>
                    )}
                    {selectedCols.product !== false && <td className="py-2.5 px-3">{r.product}</td>}
                    {selectedCols.crop !== false && <td className="py-2.5 px-3">{r.crop}</td>}
                    {selectedCols.closingDate !== false && (
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{formatDateBR(r.closingDate)}</td>
                    )}
                    {selectedCols.totalBags !== false && (
                      <td className="py-2.5 px-3 text-right">{r.totalBags.toLocaleString('pt-BR')}</td>
                    )}
                    {selectedCols.shippedBags && (
                      <td className="py-2.5 px-3 text-right">{r.shippedBags.toLocaleString('pt-BR')}</td>
                    )}
                    {selectedCols.commissionPerBag !== false && (
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        R$ {r.commissionPerBag.toFixed(2)}
                      </td>
                    )}
                    {selectedCols.contractedCommission !== false && (
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatBRL(r.contractedCommission)}
                      </td>
                    )}
                    {selectedCols.shippedCommission && (
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {formatBRL(r.shippedCommission)}
                      </td>
                    )}
                    {selectedCols.contractCurrency && (
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{r.contractCurrency}</td>
                    )}
                    {selectedCols.dueDate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        {r.dueDate ? formatDateBR(r.dueDate) : 'Sem vencimento'}
                      </td>
                    )}
                    {selectedCols.financialStatus !== false && (
                      <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate" title={r.financialStatusLabel}>
                        {r.financialStatusLabel}
                      </td>
                    )}
                    {selectedCols.effectiveReceiptDate && (
                      <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">Não controlado</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando {pagedAnalytical.length} de {filteredAnalytical.length} contrato(s)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="tabular-nums">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
