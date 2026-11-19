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
  CalendarRange,
  Filter,
  ChevronUp,
  ChevronDown,
  X,
  AlertTriangle,
  Info,
  ShieldCheck,
  Printer,
  FileSpreadsheet,
  FileText,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Truck,
  CheckCircle2,
  Clock,
  Layers,
  GanttChartSquare,
  ListChecks,
  Activity
} from 'lucide-react';
import {
  EconomicGroup,
  FreightType,
  NormalizedContractStatus
} from '../../types';
import {
  EnrichedContract,
  MONTH_SHORT_PT,
  VolumeUnit,
  formatDateBR
} from '../../services/reportsAnalytics';
import {
  FortnightCode,
  LOGISTICS_STATUS_LABELS,
  LOGISTICS_STATUS_ORDER,
  LogisticsContractRow,
  LogisticsDeliveryStatus,
  LogisticsFilterState,
  LogisticsMatrixColDim,
  LogisticsMatrixMetric,
  LogisticsMatrixRowDim,
  ProducerLogisticsExternalView,
  buildLogisticsAnalyticsSummary,
  buildLogisticsGanttData,
  buildLogisticsRows,
  buildLogisticsSyntheticMatrix,
  buildProducerLogisticsExternalView,
  createDefaultLogisticsFilters,
  filterLogisticsRows
} from '../../services/logisticsScheduleAnalytics';
import {
  ExternalLogisticsSections,
  buildLogisticsInternalExportSheets,
  downloadCsvFile,
  downloadXlsxWorkbook
} from '../../services/reportsExport';
import { MultiSelectFilter, MultiSelectOption } from './MultiSelectFilter';

type LogisticsModality = 'DMS_INTERNAL' | 'PRODUCER_EXTERNAL';
type LogisticsSubView = 'SYNTHETIC' | 'GANTT' | 'ANALYTICAL' | 'TRACKING';
type AnalyticalSortKey =
  | 'producerName'
  | 'startDate'
  | 'endDate'
  | 'contractedVolume'
  | 'product'
  | 'logisticsStatus';

const STATUS_BADGE_CLASS: Record<LogisticsDeliveryStatus, string> = {
  PROGRAMADO: 'bg-sky-50 text-sky-800 border-sky-200',
  EM_PERIODO_DE_ENTREGA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PARCIALMENTE_ENTREGUE: 'bg-amber-50 text-amber-800 border-amber-200',
  ENTREGA_CONCLUIDA: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  EM_ATRASO_CONFIRMADO: 'bg-red-50 text-red-800 border-red-200',
  PRAZO_ENCERRADO_SEM_CONFIRMACAO: 'bg-orange-50 text-orange-800 border-orange-200',
  SEM_ACOMPANHAMENTO_LOGISTICO: 'bg-slate-100 text-slate-600 border-slate-200',
  PERIODO_INCONSISTENTE: 'bg-rose-100 text-rose-900 border-rose-300'
};

const PRODUCT_BAR_COLORS: Record<string, string> = {
  SOJA: '#059669',
  MILHO: '#d97706',
  TRIGO: '#0284c7',
  SORGO: '#e11d48'
};

const ANALYTICAL_COLUMN_DEFS: Array<{ key: string; label: string; defaultOn: boolean }> = [
  { key: 'contractNumber', label: 'Contrato', defaultOn: true },
  { key: 'producerName', label: 'Produtor', defaultOn: true },
  { key: 'farmName', label: 'Fazenda', defaultOn: true },
  { key: 'product', label: 'Produto', defaultOn: true },
  { key: 'crop', label: 'Safra', defaultOn: true },
  { key: 'buyerName', label: 'Comprador / Destino', defaultOn: false },
  { key: 'closingDate', label: 'Fechamento', defaultOn: false },
  { key: 'freightType', label: 'Frete', defaultOn: true },
  { key: 'pickupLocation', label: 'Local de Embarque', defaultOn: true },
  { key: 'startDate', label: 'Início', defaultOn: false },
  { key: 'endDate', label: 'Término', defaultOn: false },
  { key: 'periodLabel', label: 'Período Formatado', defaultOn: true },
  { key: 'contractedVolume', label: 'Contratado', defaultOn: true },
  { key: 'deliveredVolume', label: 'Entregue Reg.', defaultOn: true },
  { key: 'balanceVolume', label: 'Saldo', defaultOn: true },
  { key: 'deliveredPct', label: '% Entregue', defaultOn: true },
  { key: 'logisticsStatus', label: 'Situação Entrega', defaultOn: true }
];

interface LogisticsScheduleTabProps {
  enrichedContracts: EnrichedContract[];
  unit: VolumeUnit;
  onChangeUnit: (u: VolumeUnit) => void;
  producerOptions: MultiSelectOption[];
  economicGroups: EconomicGroup[];
  availableProducts: string[];
  availableCrops: string[];
  availableStatuses: NormalizedContractStatus[];
  onDrillDown: (title: string, subtitle: string, contractIds: string[]) => void;
  onOpenInternalPrint: (params: {
    mode: LogisticsSubView;
    includeCharts: boolean;
    metricLabel: string;
    selectedColumns: Record<string, boolean>;
    filtersSummary: string[];
    summary: ReturnType<typeof buildLogisticsAnalyticsSummary>;
    matrix: ReturnType<typeof buildLogisticsSyntheticMatrix>;
    gantt: ReturnType<typeof buildLogisticsGanttData>;
    analyticalRows: LogisticsContractRow[];
  }) => void;
  onOpenExternalPrintOrExport: (params: {
    producerView: ProducerLogisticsExternalView;
    filtersSummary: string[];
    selectedColumns: Record<string, boolean>;
    sections?: ExternalLogisticsSections;
  }) => void;
}

export const LogisticsScheduleTab: React.FC<LogisticsScheduleTabProps> = ({
  enrichedContracts,
  unit,
  onChangeUnit,
  producerOptions,
  economicGroups,
  availableProducts,
  availableCrops,
  availableStatuses,
  onDrillDown,
  onOpenInternalPrint,
  onOpenExternalPrintOrExport
}) => {
  const [modality, setModality] = useState<LogisticsModality>('DMS_INTERNAL');
  const [subView, setSubView] = useState<LogisticsSubView>('SYNTHETIC');
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);

  const [filters, setFilters] = useState<LogisticsFilterState>(() => createDefaultLogisticsFilters());

  // Producer View single-target selection (1 producer OR 1 economic group)
  const [producerTargetMode, setProducerTargetMode] = useState<'PRODUCER' | 'GROUP'>('PRODUCER');
  const [selectedSingleProducerKey, setSelectedSingleProducerKey] = useState<string>(() =>
    producerOptions.length > 0 ? producerOptions[0].value : ''
  );
  const [selectedExternalGroupId, setSelectedExternalGroupId] = useState<string>(() =>
    economicGroups.length > 0 ? economicGroups[0].id : ''
  );

  // Synthetic matrix settings
  const [rowDim, setRowDim] = useState<LogisticsMatrixRowDim>('PRODUCER');
  const [colDim, setColDim] = useState<LogisticsMatrixColDim>('CONTRACTED_PERIOD');
  const [metric, setMetric] = useState<LogisticsMatrixMetric>('CONTRACTED');
  const [includeChartsInPrint, setIncludeChartsInPrint] = useState(true);

  // Gantt controls
  const [ganttLimit, setGanttLimit] = useState<number>(60);
  const [hoveredGanttRow, setHoveredGanttRow] = useState<LogisticsContractRow | null>(null);

  // Analytical controls
  const [analyticalSearch, setAnalyticalSearch] = useState('');
  const [analyticalSortKey, setAnalyticalSortKey] = useState<AnalyticalSortKey>('startDate');
  const [analyticalSortDir, setAnalyticalSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ANALYTICAL_COLUMN_DEFS.forEach((c) => {
      init[c.key] = c.defaultOn;
    });
    return init;
  });

  // Tracking sub-tab alert filter
  const [trackingAlertTab, setTrackingAlertTab] = useState<
    'OVERDUE' | 'UNCONFIRMED' | 'ENDING_15D' | 'INCONSISTENT'
  >('OVERDUE');

  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const formatVol = (v: number) =>
    v.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 });

  // 1. Base rows built from ALL enriched contracts
  const allLogisticsRows = useMemo(
    () =>
      buildLogisticsRows(
        enrichedContracts,
        unit,
        filters.referenceDate,
        filters.operationalCutoffDate
      ),
    [enrichedContracts, unit, filters.referenceDate, filters.operationalCutoffDate]
  );

  // Dynamic options extracted from allLogisticsRows
  const dynamicOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    const farmsSet = new Set<string>();
    const pickupsSet = new Set<string>();

    for (const r of allLogisticsRows) {
      if (r.window.startParts) yearsSet.add(String(r.window.startParts.year));
      if (r.window.endParts) yearsSet.add(String(r.window.endParts.year));
      farmsSet.add(r.farmName);
      pickupsSet.add(r.pickupLocation);
    }

    return {
      years: Array.from(yearsSet).sort((a, b) => Number(b) - Number(a)),
      farms: Array.from(farmsSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })),
      pickups: Array.from(pickupsSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    };
  }, [allLogisticsRows]);

  // 2. Effective filters scoped to modality (Producer mode strictly isolates 1 producer OR 1 group)
  const effectiveFilters = useMemo<LogisticsFilterState>(() => {
    if (modality === 'DMS_INTERNAL') return filters;

    if (producerTargetMode === 'GROUP' && selectedExternalGroupId) {
      return {
        ...filters,
        producerKeys: [],
        economicGroupId: selectedExternalGroupId,
        simulateDistribution: false
      };
    }

    return {
      ...filters,
      producerKeys: selectedSingleProducerKey ? [selectedSingleProducerKey] : ['__NONE__'],
      economicGroupId: '',
      simulateDistribution: false
    };
  }, [
    modality,
    filters,
    producerTargetMode,
    selectedExternalGroupId,
    selectedSingleProducerKey
  ]);

  const filteredRows = useMemo(
    () => filterLogisticsRows(allLogisticsRows, effectiveFilters, economicGroups),
    [allLogisticsRows, effectiveFilters, economicGroups]
  );

  const summary = useMemo(
    () =>
      buildLogisticsAnalyticsSummary(
        filteredRows,
        unit,
        effectiveFilters.referenceDate,
        effectiveFilters.simulateDistribution
      ),
    [filteredRows, unit, effectiveFilters.referenceDate, effectiveFilters.simulateDistribution]
  );

  const consolidatedLabel = useMemo(() => {
    if (effectiveFilters.economicGroupId) {
      return (
        economicGroups.find((g) => g.id === effectiveFilters.economicGroupId)?.name ||
        'Grupo Econômico'
      );
    }
    if (effectiveFilters.producerKeys.length === 1) {
      const opt = producerOptions.find((p) => p.value === effectiveFilters.producerKeys[0]);
      return opt?.label || 'Produtor Selecionado';
    }
    if (effectiveFilters.producerKeys.length > 1) {
      return `Seleção (${effectiveFilters.producerKeys.length} produtores)`;
    }
    return 'Visão Consolidada Geral';
  }, [
    effectiveFilters.economicGroupId,
    effectiveFilters.producerKeys,
    economicGroups,
    producerOptions
  ]);

  const matrix = useMemo(
    () =>
      buildLogisticsSyntheticMatrix({
        rows: filteredRows,
        rowDim: modality === 'PRODUCER_EXTERNAL' && rowDim === 'PRODUCER' ? 'FARM' : rowDim,
        colDim,
        metric,
        unit,
        simulateDistribution: effectiveFilters.simulateDistribution,
        consolidatedLabel
      }),
    [
      filteredRows,
      modality,
      rowDim,
      colDim,
      metric,
      unit,
      effectiveFilters.simulateDistribution,
      consolidatedLabel
    ]
  );

  const gantt = useMemo(() => buildLogisticsGanttData(filteredRows), [filteredRows]);

  const analyticalRows = useMemo(() => {
    const term = analyticalSearch.trim().toLowerCase();
    const searched = term
      ? filteredRows.filter(
          (r) =>
            r.contractNumber.toLowerCase().includes(term) ||
            r.producerName.toLowerCase().includes(term) ||
            r.farmName.toLowerCase().includes(term) ||
            r.buyerName.toLowerCase().includes(term) ||
            r.pickupLocation.toLowerCase().includes(term) ||
            r.product.toLowerCase().includes(term)
        )
      : filteredRows;

    const dir = analyticalSortDir === 'ASC' ? 1 : -1;
    return [...searched].sort((a, b) => {
      switch (analyticalSortKey) {
        case 'producerName':
          return dir * a.producerName.localeCompare(b.producerName, 'pt-BR', { sensitivity: 'base' });
        case 'product':
          return dir * a.product.localeCompare(b.product, 'pt-BR', { sensitivity: 'base' });
        case 'contractedVolume':
          return dir * (a.contractedVolume - b.contractedVolume);
        case 'endDate':
          return dir * (a.window.endIso || '9999').localeCompare(b.window.endIso || '9999');
        case 'logisticsStatus':
          return dir * a.logisticsStatusLabel.localeCompare(b.logisticsStatusLabel, 'pt-BR');
        case 'startDate':
        default:
          return dir * (a.window.startIso || '9999').localeCompare(b.window.startIso || '9999');
      }
    });
  }, [filteredRows, analyticalSearch, analyticalSortKey, analyticalSortDir]);

  // Producer External View model (strictly isolated)
  const producerExternalView = useMemo<ProducerLogisticsExternalView | null>(() => {
    if (modality !== 'PRODUCER_EXTERNAL') return null;
    let targetTitle = 'Produtor';
    let targetDocs = '';

    if (producerTargetMode === 'GROUP' && selectedExternalGroupId) {
      const grp = economicGroups.find((g) => g.id === selectedExternalGroupId);
      targetTitle = grp?.name || 'Grupo Econômico';
      const docs = Array.from(
        new Set(filteredRows.map((r) => r.producerDoc).filter(Boolean))
      );
      targetDocs = docs.join(', ');
    } else {
      const opt = producerOptions.find((p) => p.value === selectedSingleProducerKey);
      targetTitle = (opt?.label || filteredRows[0]?.producerName || 'Produtor').replace(
        /^\[Pendência\]\s*/i,
        ''
      );
      targetDocs = opt?.subLabel || filteredRows[0]?.producerDoc || '';
    }

    return buildProducerLogisticsExternalView({
      scopedRows: filteredRows,
      targetTitle,
      targetDocs,
      unit,
      referenceDate: effectiveFilters.referenceDate
    });
  }, [
    modality,
    producerTargetMode,
    selectedExternalGroupId,
    selectedSingleProducerKey,
    economicGroups,
    producerOptions,
    filteredRows,
    unit,
    effectiveFilters.referenceDate
  ]);

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Referência: ${formatDateBR(effectiveFilters.referenceDate)}`);
    if (effectiveFilters.startDate || effectiveFilters.endDate) {
      parts.push(
        `Janela interseção: ${effectiveFilters.startDate ? formatDateBR(effectiveFilters.startDate) : '...'} até ${
          effectiveFilters.endDate ? formatDateBR(effectiveFilters.endDate) : '...'
        }`
      );
    }
    if (effectiveFilters.years.length > 0) parts.push(`Anos: ${effectiveFilters.years.join(', ')}`);
    if (effectiveFilters.months.length > 0) {
      parts.push(
        `Meses: ${effectiveFilters.months.map((m) => MONTH_SHORT_PT[Number(m) - 1] || m).join(', ')}`
      );
    }
    if (effectiveFilters.fortnights.length > 0) {
      parts.push(`Quinzenas: ${effectiveFilters.fortnights.map((q) => (q === 'Q1' ? '1ª Q' : '2ª Q')).join(', ')}`);
    }
    if (effectiveFilters.crops.length > 0) parts.push(`Safras: ${effectiveFilters.crops.join(', ')}`);
    if (effectiveFilters.products.length > 0) parts.push(`Produtos: ${effectiveFilters.products.join(', ')}`);
    if (effectiveFilters.freightTypes.length > 0) parts.push(`Frete: ${effectiveFilters.freightTypes.join(', ')}`);
    if (effectiveFilters.pickupLocations.length > 0) parts.push(`Locais: ${effectiveFilters.pickupLocations.length} selec.`);
    if (effectiveFilters.deliveryStatuses.length > 0) {
      parts.push(`Situação: ${effectiveFilters.deliveryStatuses.map((s) => LOGISTICS_STATUS_LABELS[s]).join(', ')}`);
    }
    if (effectiveFilters.excludeCancelled) parts.push('Cancelados excluídos');
    return parts;
  }, [effectiveFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.years.length > 0) count++;
    if (filters.months.length > 0) count++;
    if (filters.fortnights.length > 0) count++;
    if (filters.crops.length > 0) count++;
    if (filters.products.length > 0) count++;
    if (modality === 'DMS_INTERNAL' && filters.producerKeys.length > 0) count++;
    if (modality === 'DMS_INTERNAL' && filters.economicGroupId) count++;
    if (filters.farmNames.length > 0) count++;
    if (filters.pickupLocations.length > 0) count++;
    if (filters.freightTypes.length > 0) count++;
    if (filters.contractStatuses.length > 0) count++;
    if (filters.deliveryStatuses.length > 0) count++;
    return count;
  }, [filters, modality]);

  const metricLabel =
    metric === 'DELIVERED'
      ? 'Entregue Registrado'
      : metric === 'BALANCE'
      ? 'Saldo Pendente'
      : 'Volume Contratado';

  const handleSortClick = (key: AnalyticalSortKey) => {
    if (analyticalSortKey === key) {
      setAnalyticalSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setAnalyticalSortKey(key);
      setAnalyticalSortDir('ASC');
    }
  };

  const handleInternalCsv = () => {
    const sheets = buildLogisticsInternalExportSheets({
      summary,
      matrix,
      analyticalRows,
      unit,
      mode: subView === 'TRACKING' ? 'TRACKING' : subView === 'ANALYTICAL' ? 'ANALYTICAL' : 'SYNTHETIC',
      selectedColumns
    });
    const target = sheets[0];
    if (!target) return;
    downloadCsvFile(
      `DMS_Programacao_Logistica_${subView}`,
      target.headers,
      target.rows,
      [`DMS Agro — Programação de Entregas e Retiradas (${metricLabel})`, ...filtersSummary]
    );
  };

  const handleInternalXlsx = () => {
    const sheets = buildLogisticsInternalExportSheets({
      summary,
      matrix,
      analyticalRows,
      unit,
      mode: 'ALL',
      selectedColumns
    });
    downloadXlsxWorkbook(`DMS_Programacao_Logistica_Completa`, sheets, [
      ['Relatório', 'Programação de Entregas e Retiradas — DMS Agro'],
      ['Unidade', unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)'],
      ['Simulação Proporcional', effectiveFilters.simulateDistribution ? 'ATIVA (Estimativa)' : 'Desativada (Original)'],
      ...filtersSummary.map((f) => ['Filtro', f])
    ]);
  };

  const handleSwitchModality = (next: LogisticsModality) => {
    setModality(next);
    if (next === 'PRODUCER_EXTERNAL') {
      setFilters((prev) => ({ ...prev, simulateDistribution: false }));
      if (!selectedSingleProducerKey && producerOptions.length > 0) {
        setSelectedSingleProducerKey(producerOptions[0].value);
      }
    }
  };

  const currentAlertRows = useMemo(() => {
    switch (trackingAlertTab) {
      case 'OVERDUE':
        return summary.alerts.overdueConfirmed;
      case 'UNCONFIRMED':
        return summary.alerts.pastEndUnconfirmed;
      case 'ENDING_15D':
        return summary.alerts.endingSoon15d;
      case 'INCONSISTENT':
        return summary.alerts.inconsistentDates;
    }
  }, [trackingAlertTab, summary.alerts]);

  return (
    <div className="space-y-6">
      {/* Top Modality & Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSwitchModality('DMS_INTERNAL')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                modality === 'DMS_INTERNAL'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visão DMS Agro (Geral)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchModality('PRODUCER_EXTERNAL')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                modality === 'PRODUCER_EXTERNAL'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visão do Produtor (Externa)
            </button>
          </div>

          <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangeUnit('SCS')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                unit === 'SCS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Sacas (60kg)
            </button>
            <button
              type="button"
              onClick={() => onChangeUnit('TON')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                unit === 'TON' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Toneladas
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modality === 'DMS_INTERNAL' && (
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100">
              <input
                type="checkbox"
                checked={filters.simulateDistribution}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, simulateDistribution: e.target.checked }))
                }
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Simular distribuição do volume por quinzena</span>
            </label>
          )}

          {modality === 'DMS_INTERNAL' ? (
            <>
              <button
                type="button"
                onClick={handleInternalCsv}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                type="button"
                onClick={handleInternalXlsx}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenInternalPrint({
                    mode: subView,
                    includeCharts: includeChartsInPrint,
                    metricLabel,
                    selectedColumns,
                    filtersSummary,
                    summary,
                    matrix,
                    gantt,
                    analyticalRows
                  })
                }
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
              </button>
            </>
          ) : (
            producerExternalView && (
              <button
                type="button"
                onClick={() =>
                  onOpenExternalPrintOrExport({
                    producerView: producerExternalView,
                    filtersSummary,
                    selectedColumns
                  })
                }
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5" /> Gerar Agenda do Produtor (PDF / Excel / CSV)
              </button>
            )
          )}
        </div>
      </div>

      {/* Producer Strict Isolation Banner + Target Selector */}
      {modality === 'PRODUCER_EXTERNAL' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950">
                <p className="font-bold">
                  Modo Externo do Produtor — Isolamento Estrito Ativo
                </p>
                <p className="text-emerald-800 mt-0.5">
                  Exibe exclusivamente os contratos, fazendas, locais de embarque e entregas do produtor ou grupo selecionado. Nunca expõe outros produtores, comissões, margens, dados bancários ou links públicos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="bg-white border border-emerald-200 p-0.5 rounded-lg flex items-center text-xs">
                <button
                  type="button"
                  onClick={() => setProducerTargetMode('PRODUCER')}
                  className={`px-3 py-1 rounded-md font-semibold ${
                    producerTargetMode === 'PRODUCER'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-900 hover:bg-emerald-50'
                  }`}
                >
                  1 Produtor
                </button>
                <button
                  type="button"
                  onClick={() => setProducerTargetMode('GROUP')}
                  className={`px-3 py-1 rounded-md font-semibold ${
                    producerTargetMode === 'GROUP'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-900 hover:bg-emerald-50'
                  }`}
                >
                  Grupo Econômico
                </button>
              </div>

              {producerTargetMode === 'PRODUCER' ? (
                <select
                  value={selectedSingleProducerKey}
                  onChange={(e) => setSelectedSingleProducerKey(e.target.value)}
                  className="h-[36px] min-w-[260px] max-w-[380px] px-3 text-xs font-semibold border border-emerald-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {producerOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} {opt.subLabel ? `(${opt.subLabel})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedExternalGroupId}
                  onChange={(e) => setSelectedExternalGroupId(e.target.value)}
                  className="h-[36px] min-w-[260px] px-3 text-xs font-semibold border border-emerald-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {economicGroups.length === 0 ? (
                    <option value="">Nenhum grupo criado em Grupos &amp; SQL</option>
                  ) : (
                    economicGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.producerIds.length} produtores)
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simulation Warning Banner */}
      {filters.simulateDistribution && modality === 'DMS_INTERNAL' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Modo de Simulação Proporcional por Quinzena Ativo — Estimativa para Planejamento Logístico
            </p>
            <p className="text-amber-800 mt-0.5">
              Janelas de múltiplas quinzenas ou meses estão sendo distribuídas proporcionalmente pelos dias corridos de cada quinzena (com reconciliação exata da soma total). Esta divisão é apenas uma simulação visual e não altera nenhum contrato no banco de dados.
            </p>
          </div>
        </div>
      )}

      {/* Combinable Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div
          className={`px-4 py-3 bg-slate-50 flex flex-wrap items-center justify-between gap-3 ${
            showFiltersPanel ? 'rounded-t-xl border-b border-slate-200' : 'rounded-xl'
          }`}
        >
          <button
            type="button"
            onClick={() => setShowFiltersPanel((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-emerald-800"
          >
            <Filter className="w-4 h-4 text-emerald-700" />
            <span>
              Filtros Logísticos{' '}
              {activeFilterCount > 0 ? `(${activeFilterCount} ativo${activeFilterCount > 1 ? 's' : ''})` : ''}
            </span>
            {showFiltersPanel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.excludeCancelled}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, excludeCancelled: e.target.checked }))
                }
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Excluir contratos cancelados
            </label>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(createDefaultLogisticsFilters())}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <X className="w-3.5 h-3.5" /> Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {showFiltersPanel && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Início Programação
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="lg:col-span-2 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Fim Programação
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="lg:col-span-2 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Data de Referência
              </label>
              <input
                type="date"
                value={filters.referenceDate}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    referenceDate: e.target.value || createDefaultLogisticsFilters().referenceDate
                  }))
                }
                className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="lg:col-span-2 min-w-0">
              <label
                className="block text-[11px] font-semibold text-slate-600 mb-1"
                title="Contratos encerrados antes desta data com 0 romaneios são tratados como Sem acompanhamento logístico"
              >
                Corte Acompanhamento
              </label>
              <input
                type="date"
                value={filters.operationalCutoffDate}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    operationalCutoffDate: e.target.value || '2026-01-01'
                  }))
                }
                className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Ano (Janela)"
              placeholder="Todos os anos"
              options={dynamicOptions.years.map((y) => ({ value: y, label: y }))}
              selectedValues={filters.years}
              onChange={(years) => setFilters((prev) => ({ ...prev, years }))}
              dropdownMinWidth={200}
              searchPlaceholder="Buscar ano..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Mês (Janela)"
              placeholder="Todos os meses"
              options={MONTH_SHORT_PT.map((label, idx) => ({
                value: String(idx + 1).padStart(2, '0'),
                label
              }))}
              selectedValues={filters.months}
              onChange={(months) => setFilters((prev) => ({ ...prev, months }))}
              dropdownMinWidth={200}
              searchPlaceholder="Buscar mês..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Quinzena"
              placeholder="1ª e 2ª Q"
              options={[
                { value: 'Q1', label: '1ª Quinzena (01–15)' },
                { value: 'Q2', label: '2ª Quinzena (16–Fim)' }
              ]}
              selectedValues={filters.fortnights}
              onChange={(vals) =>
                setFilters((prev) => ({ ...prev, fortnights: vals as FortnightCode[] }))
              }
              dropdownMinWidth={220}
              searchPlaceholder="Buscar quinzena..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Produto"
              placeholder="Todos produtos"
              options={availableProducts.map((p) => ({ value: p, label: p }))}
              selectedValues={filters.products}
              onChange={(products) => setFilters((prev) => ({ ...prev, products }))}
              dropdownMinWidth={220}
              searchPlaceholder="Buscar produto..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Safra"
              placeholder="Todas safras"
              options={availableCrops.map((c) => ({ value: c, label: `Safra ${c}` }))}
              selectedValues={filters.crops}
              onChange={(crops) => setFilters((prev) => ({ ...prev, crops }))}
              dropdownMinWidth={220}
              searchPlaceholder="Buscar safra..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Frete"
              placeholder="FOB e CIF"
              options={[
                { value: 'FOB', label: 'FOB (Retirada)' },
                { value: 'CIF', label: 'CIF (Entrega)' }
              ]}
              selectedValues={filters.freightTypes}
              onChange={(vals) =>
                setFilters((prev) => ({ ...prev, freightTypes: vals as FreightType[] }))
              }
              dropdownMinWidth={220}
              searchPlaceholder="Buscar frete..."
            />

            <MultiSelectFilter
              className="lg:col-span-4"
              label="Local de Embarque"
              placeholder="Todos os locais"
              options={dynamicOptions.pickups.map((p) => ({ value: p, label: p }))}
              selectedValues={filters.pickupLocations}
              onChange={(pickupLocations) => setFilters((prev) => ({ ...prev, pickupLocations }))}
              dropdownMinWidth={300}
              maxInlineTags={1}
              searchPlaceholder="Buscar local de embarque..."
            />

            {modality === 'DMS_INTERNAL' && (
              <>
                <MultiSelectFilter
                  className="sm:col-span-2 lg:col-span-4"
                  label="Produtores"
                  placeholder="Todos os produtores"
                  options={producerOptions}
                  selectedValues={filters.producerKeys}
                  onChange={(producerKeys) => setFilters((prev) => ({ ...prev, producerKeys }))}
                  dropdownMinWidth={360}
                  maxInlineTags={2}
                  searchPlaceholder="Buscar por nome ou CPF/CNPJ..."
                />

                <div className="lg:col-span-2 min-w-0">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Grupo Econômico
                  </label>
                  <select
                    value={filters.economicGroupId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, economicGroupId: e.target.value }))
                    }
                    className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Todos (sem grupo)</option>
                    {economicGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.producerIds.length})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Fazenda"
              placeholder="Todas as fazendas"
              options={dynamicOptions.farms.map((f) => ({ value: f, label: f }))}
              selectedValues={filters.farmNames}
              onChange={(farmNames) => setFilters((prev) => ({ ...prev, farmNames }))}
              dropdownMinWidth={280}
              searchPlaceholder="Buscar fazenda..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Status Contrato"
              placeholder="Todos status"
              options={availableStatuses.map((s) => ({ value: s, label: s }))}
              selectedValues={filters.contractStatuses}
              onChange={(vals) =>
                setFilters((prev) => ({
                  ...prev,
                  contractStatuses: vals as NormalizedContractStatus[]
                }))
              }
              dropdownMinWidth={240}
              searchPlaceholder="Buscar status..."
            />

            <MultiSelectFilter
              className="lg:col-span-2"
              label="Situação Logística"
              placeholder="Todas situações"
              options={LOGISTICS_STATUS_ORDER.map((st) => ({
                value: st,
                label: LOGISTICS_STATUS_LABELS[st]
              }))}
              selectedValues={filters.deliveryStatuses}
              onChange={(vals) =>
                setFilters((prev) => ({
                  ...prev,
                  deliveryStatuses: vals as LogisticsDeliveryStatus[]
                }))
              }
              dropdownMinWidth={300}
              searchPlaceholder="Buscar situação..."
            />
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Volume Programado
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatVol(summary.totalContracted)} {unitLabel}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {summary.contractsCount} contrato(s) · {summary.producersCount} produtor(es)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Entregue Reg. × Saldo Pendente
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {formatVol(summary.totalDelivered)} {unitLabel}
          </p>
          <p className="text-xs text-slate-600 mt-1 tabular-nums">
            Saldo: <strong className="text-amber-700">{formatVol(summary.totalBalance)} {unitLabel}</strong>
            {summary.totalExcess > 0 ? ` · Excedente: +${formatVol(summary.totalExcess)} ${unitLabel}` : ''}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Quinzena Exata × Janelas Abertas
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
            {formatVol(summary.definedFortnightContracted)} {unitLabel}{' '}
            <span className="text-xs font-normal text-slate-500">(1Q definida)</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Mês integral: {formatVol(summary.fullMonthContracted)} · Multijanela: {formatVol(summary.openWindowContracted)} {unitLabel}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Modalidade FOB × CIF (Saldo)
          </p>
          <div className="flex items-baseline gap-3 mt-1 tabular-nums">
            <span className="text-lg font-bold text-slate-900">
              FOB: {formatVol(summary.fobBalance)}
            </span>
            <span className="text-sm font-semibold text-slate-600">
              CIF: {formatVol(summary.cifBalance)} {unitLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Contratado: FOB {formatVol(summary.fobContracted)} · CIF {formatVol(summary.cifContracted)} {unitLabel}
          </p>
        </div>
      </div>

      {/* Cumulative Future Horizons (Section 8) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              Horizontes Futuros de Entrega (Saldo Pendente Acumulado a partir de {formatDateBR(effectiveFilters.referenceDate)})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Os cartões são <strong>acumulados</strong> (15d ⊆ 30d ⊆ 60d ⊆ 90d — nunca somar os valores entre horizontes). Separa janelas de quinzena específica das janelas amplas coincidentes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {summary.horizons.map((h) => (
            <button
              key={h.days}
              type="button"
              onClick={() =>
                h.contractIds.length > 0 &&
                onDrillDown(
                  `Horizonte ${h.days} dias (até ${formatDateBR(h.horizonEndDate)})`,
                  `Saldo coincidente acumulado a partir de ${formatDateBR(effectiveFilters.referenceDate)}`,
                  h.contractIds
                )
              }
              className="text-left border border-slate-200 hover:border-emerald-400 rounded-lg p-3 bg-slate-50/70 hover:bg-emerald-50/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Próximos {h.days} dias</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  até {formatDateBR(h.horizonEndDate)}
                </span>
              </div>
              <p className="text-lg font-bold text-emerald-800 mt-1 tabular-nums">
                {formatVol(h.totalOverlappingVolume)} {unitLabel}
              </p>
              <div className="mt-1.5 text-[11px] text-slate-600 space-y-0.5 tabular-nums">
                <p>
                  Quinzena/prazo específico: <strong>{formatVol(h.definedVolume)} {unitLabel}</strong>
                </p>
                <p>
                  Janelas amplas coincidentes: <strong>{formatVol(h.coincidentVolume)} {unitLabel}</strong>
                </p>
                <p className="text-slate-500">
                  {h.contractsCount} contrato(s) · FOB {formatVol(h.fobVolume)} · CIF {formatVol(h.cifVolume)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 4 Sub-Views Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-slate-200/80 p-1 rounded-xl flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSubView('SYNTHETIC')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subView === 'SYNTHETIC'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> 1. Programação Sintética
          </button>
          <button
            type="button"
            onClick={() => setSubView('GANTT')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subView === 'GANTT'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GanttChartSquare className="w-3.5 h-3.5" /> 2. Cronograma (Gantt)
          </button>
          <button
            type="button"
            onClick={() => setSubView('ANALYTICAL')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subView === 'ANALYTICAL'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> 3. Relatório Analítico
          </button>
          <button
            type="button"
            onClick={() => setSubView('TRACKING')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subView === 'TRACKING'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> 4. Acompanhamento de Entregas
          </button>
        </div>

        {modality === 'DMS_INTERNAL' && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={includeChartsInPrint}
              onChange={(e) => setIncludeChartsInPrint(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Incluir gráficos na impressão/PDF
          </label>
        )}
      </div>

      {/* SUB-VIEW 1: PROGRAMAÇÃO SINTÉTICA */}
      {subView === 'SYNTHETIC' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Matriz Dinâmica de Programação ({metricLabel})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Clique em qualquer valor para inspecionar os contratos da célula. Contratos nunca são duplicados entre períodos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rowDim}
                  onChange={(e) => setRowDim(e.target.value as LogisticsMatrixRowDim)}
                  className="h-[34px] px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700"
                >
                  {modality === 'DMS_INTERNAL' && <option value="PRODUCER">Linhas: Produtor</option>}
                  {modality === 'DMS_INTERNAL' && <option value="GROUP">Linhas: Grupo / Consolidado</option>}
                  <option value="FARM">Linhas: Fazenda</option>
                  <option value="PRODUCT">Linhas: Produto</option>
                  <option value="CROP">Linhas: Safra</option>
                  <option value="PICKUP_LOCATION">Linhas: Local de Embarque</option>
                  <option value="FREIGHT_TYPE">Linhas: Tipo de Frete (FOB/CIF)</option>
                </select>

                <select
                  value={colDim}
                  onChange={(e) => setColDim(e.target.value as LogisticsMatrixColDim)}
                  className="h-[34px] px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700"
                >
                  <option value="CONTRACTED_PERIOD">Colunas: Período Contratado</option>
                  <option value="FORTNIGHT">Colunas: Quinzenal</option>
                  <option value="MONTH">Colunas: Mensal</option>
                  <option value="QUARTER">Colunas: Trimestral</option>
                </select>

                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as LogisticsMatrixMetric)}
                  className="h-[34px] px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700"
                >
                  <option value="CONTRACTED">Métrica: Contratado</option>
                  <option value="BALANCE">Métrica: Saldo Pendente</option>
                  <option value="DELIVERED">Métrica: Entregue Reg.</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="sticky left-0 z-30 bg-slate-50 py-2.5 px-4 font-bold min-w-[210px] border-r border-slate-200">
                      Agrupamento
                    </th>
                    {matrix.columns.map((col) => (
                      <th
                        key={col.key}
                        title={col.subLabel || col.label}
                        className={`py-2.5 px-3 font-semibold text-right whitespace-nowrap ${
                          col.isSpecialBucket ? 'bg-amber-50/70 text-amber-900' : ''
                        }`}
                      >
                        <div>{col.label}</div>
                        {col.subLabel && (
                          <div className="text-[10px] font-normal text-slate-400">
                            {col.subLabel}
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap bg-slate-100 border-l border-slate-200">
                      Janela Definida
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap bg-slate-100">
                      Janelas Abertas
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap bg-emerald-50 text-emerald-950">
                      Total ({unitLabel})
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Part. %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {matrix.rows.map((r) => (
                    <tr key={r.key} className="hover:bg-slate-50/80">
                      <td className="sticky left-0 z-10 bg-white py-2.5 px-4 font-semibold text-slate-900 border-r border-slate-200 max-w-[240px] truncate" title={r.label}>
                        {r.label}
                      </td>
                      {matrix.columns.map((col) => {
                        const cell = r.cells[col.key];
                        return (
                          <td
                            key={col.key}
                            className={`py-2 px-3 text-right whitespace-nowrap ${
                              col.isSpecialBucket ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            {cell && cell.value > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onDrillDown(
                                    `${r.label} — ${col.label}`,
                                    `${cell.contractsCount} contrato(s) · ${metricLabel}`,
                                    cell.contractIds
                                  )
                                }
                                className={`font-medium hover:underline ${
                                  cell.isSimulated ? 'text-amber-700' : 'text-emerald-800'
                                }`}
                              >
                                {formatVol(cell.value)}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-3 text-right font-medium text-slate-700 bg-slate-50/60 border-l border-slate-200 whitespace-nowrap">
                        {formatVol(r.definedTotal)}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-amber-800 bg-slate-50/60 whitespace-nowrap">
                        {formatVol(r.openWindowTotal)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900 bg-emerald-50/40 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onDrillDown(
                              r.label,
                              `${r.contractIds.length} contrato(s) · Total ${metricLabel}`,
                              r.contractIds
                            )
                          }
                          className="hover:underline"
                        >
                          {formatVol(r.total)}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                        {r.sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {matrix.rows.length === 0 && (
                    <tr>
                      <td colSpan={matrix.columns.length + 5} className="py-10 text-center text-slate-400">
                        Nenhum contrato encontrado para os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
                {matrix.rows.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 tabular-nums">
                    <tr>
                      <td className="sticky left-0 z-10 bg-slate-100 py-2.5 px-4 border-r border-slate-200">
                        TOTAL GERAL ({unitLabel})
                      </td>
                      {matrix.columns.map((col) => (
                        <td key={col.key} className="py-2.5 px-3 text-right whitespace-nowrap">
                          {formatVol(matrix.colTotals[col.key] || 0)}
                        </td>
                      ))}
                      <td className="py-2.5 px-3 text-right border-l border-slate-200 whitespace-nowrap">
                        {formatVol(matrix.grandDefinedTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-amber-900 whitespace-nowrap">
                        {formatVol(matrix.grandOpenWindowTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right bg-emerald-100 text-emerald-950 whitespace-nowrap">
                        {formatVol(matrix.grandTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Synthetic Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Concentração por Mês de Início / Programação ({unitLabel})
              </h4>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byPeriodChart.slice(0, 16)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => `${formatVol(value)} ${unitLabel}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {effectiveFilters.simulateDistribution ? (
                      <Bar
                        dataKey="simulatedVolume"
                        name="Simulado Proporcional"
                        fill="#d97706"
                        radius={[4, 4, 0, 0]}
                      />
                    ) : (
                      <>
                        <Bar
                          dataKey="definedVolume"
                          name="Prazo no Mês"
                          stackId="a"
                          fill="#059669"
                        />
                        <Bar
                          dataKey="openWindowVolume"
                          name="Janelas Multimês (Início)"
                          stackId="a"
                          fill="#f59e0b"
                          radius={[4, 4, 0, 0]}
                        />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Top Locais de Embarque — FOB × CIF ({unitLabel})
              </h4>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.byPickupLocation.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 10, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="label"
                      width={130}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                      formatter={(value: number) => `${formatVol(value)} ${unitLabel}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="fobVolume" name="FOB (Retirada)" stackId="f" fill="#0f766e" />
                    <Bar dataKey="cifVolume" name="CIF (Entrega)" stackId="f" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: CRONOGRAMA DE ENTREGAS (GANTT) */}
      {subView === 'GANTT' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-950">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Leitura da Linha do Tempo (Gantt por Quinzena)</p>
                <p className="text-blue-800">
                  A extensão da barra representa a janela contratual de entrega/retirada ({gantt.items.length} contratos válidos em {gantt.segments.length} quinzenas), não significando ritmo diário uniforme. Passe o cursor ou clique na barra para detalhes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-blue-900">Exibir:</span>
              <select
                value={ganttLimit}
                onChange={(e) => setGanttLimit(Number(e.target.value))}
                className="h-[32px] px-2.5 text-xs font-semibold border border-blue-300 rounded-lg bg-white text-slate-800"
              >
                <option value={60}>Primeiros 60 contratos</option>
                <option value={150}>Primeiros 150 contratos</option>
                <option value={9999}>Todos ({gantt.items.length})</option>
              </select>
            </div>
          </div>

          {hoveredGanttRow && (
            <div className="bg-white border border-emerald-300 rounded-xl p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="space-y-0.5">
                <p className="font-bold text-slate-900">
                  {hoveredGanttRow.contractNumber} · {hoveredGanttRow.producerName} ({hoveredGanttRow.farmName})
                </p>
                <p className="text-slate-600">
                  {hoveredGanttRow.product} · Safra {hoveredGanttRow.crop} · Frete {hoveredGanttRow.freightType} · Local: {hoveredGanttRow.pickupLocation}
                </p>
                <p className="text-slate-600">
                  Janela: <strong>{hoveredGanttRow.window.exactDatesLabel}</strong> ({hoveredGanttRow.window.periodLabel})
                </p>
              </div>
              <div className="text-right tabular-nums space-y-0.5">
                <p className="font-bold text-slate-900">
                  Contratado: {formatVol(hoveredGanttRow.contractedVolume)} {unitLabel}
                </p>
                <p className="text-slate-600">
                  Entregue: {formatVol(hoveredGanttRow.deliveredVolume)} · Saldo: {formatVol(hoveredGanttRow.balanceVolume)} {unitLabel}
                </p>
                <span
                  className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${
                    STATUS_BADGE_CLASS[hoveredGanttRow.logisticsStatus]
                  }`}
                >
                  {hoveredGanttRow.logisticsStatusLabel}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {gantt.segments.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nenhum contrato com janela de entrega válida para exibir no cronograma.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[580px]">
                <table className="border-collapse text-[11px] min-w-max w-full">
                  <thead className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-30 bg-slate-50 py-2 px-3 text-left font-bold text-slate-700 border-r border-slate-200 min-w-[290px]"
                      >
                        Produtor / Fazenda / Contrato
                      </th>
                      <th
                        rowSpan={2}
                        className="py-2 px-2.5 text-right font-bold text-slate-700 border-r border-slate-200 min-w-[95px]"
                      >
                        Volume ({unitLabel})
                      </th>
                      {gantt.monthGroups.map((mg) => (
                        <th
                          key={mg.monthKey}
                          colSpan={mg.segmentCount}
                          className="py-1.5 px-2 text-center font-bold text-slate-700 border-r border-slate-200 bg-slate-100"
                        >
                          {mg.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {gantt.segments.map((seg) => (
                        <th
                          key={seg.key}
                          className="py-1 px-1.5 text-center font-semibold text-slate-500 border-r border-slate-200 min-w-[44px]"
                        >
                          {seg.fortnight === 1 ? '1ªQ' : '2ªQ'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gantt.items.slice(0, ganttLimit).map((item) => {
                      const r = item.row;
                      const barColor = PRODUCT_BAR_COLORS[r.product] || '#475569';
                      return (
                        <tr
                          key={r.contractId}
                          onMouseEnter={() => setHoveredGanttRow(r)}
                          className="hover:bg-slate-50/90"
                        >
                          <td className="sticky left-0 z-10 bg-white py-2 px-3 border-r border-slate-200 max-w-[310px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">
                                {r.producerName}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                                {r.freightType}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">
                              {r.contractNumber} · {r.farmName} · {r.product}
                            </div>
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums border-r border-slate-200 whitespace-nowrap">
                            <div className="font-bold text-slate-900">
                              {formatVol(r.contractedVolume)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {r.deliveredPct.toFixed(0)}% entr.
                            </div>
                          </td>

                          {item.startSlotIndex > 0 && (
                            <td colSpan={item.startSlotIndex} className="p-0 border-r border-slate-100" />
                          )}
                          <td colSpan={item.spanSlots} className="px-1 py-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                onDrillDown(
                                  `${r.contractNumber} — ${r.producerName}`,
                                  `${r.window.exactDatesLabel} · ${r.logisticsStatusLabel}`,
                                  [r.contractId]
                                )
                              }
                              style={{ backgroundColor: barColor }}
                              className="w-full h-6 rounded-md text-white text-[10px] font-bold px-2 flex items-center justify-between gap-1 shadow-xs hover:opacity-90 transition-opacity truncate"
                              title={`${r.window.exactDatesLabel} (${r.logisticsStatusLabel})`}
                            >
                              <span className="truncate">
                                {r.product} · {r.window.periodShortLabel}
                              </span>
                              <span className="shrink-0 opacity-90">
                                {formatVol(r.balanceVolume)}
                              </span>
                            </button>
                          </td>
                          {item.endSlotIndex < gantt.segments.length - 1 && (
                            <td
                              colSpan={gantt.segments.length - 1 - item.endSlotIndex}
                              className="p-0"
                            />
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {gantt.invalidItems.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {gantt.invalidItems.length} contrato(s) com datas de embarque inconsistentes (excluídos da linha do tempo)
              </p>
              <p className="mt-1 text-rose-800">
                Contratos: {gantt.invalidItems.map((i) => `${i.contractNumber} (${i.window.exactDatesLabel})`).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: RELATÓRIO ANALÍTICO */}
      {subView === 'ANALYTICAL' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64 sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={analyticalSearch}
                  onChange={(e) => setAnalyticalSearch(e.target.value)}
                  placeholder="Buscar contrato, produtor, fazenda, comprador..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-xs text-slate-500 font-medium tabular-nums">
                {analyticalRows.length} contrato(s)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 relative">
              <select
                value={analyticalSortKey}
                onChange={(e) => setAnalyticalSortKey(e.target.value as AnalyticalSortKey)}
                className="h-[34px] px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-700"
              >
                <option value="startDate">Ordenar: Início</option>
                <option value="endDate">Ordenar: Término</option>
                <option value="producerName">Ordenar: Produtor</option>
                <option value="contractedVolume">Ordenar: Volume</option>
                <option value="product">Ordenar: Produto</option>
                <option value="logisticsStatus">Ordenar: Situação</option>
              </select>

              <button
                type="button"
                onClick={() => setAnalyticalSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'))}
                className="h-[34px] px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {analyticalSortDir === 'ASC' ? 'Crescente' : 'Decrescente'}
              </button>

              <button
                type="button"
                onClick={() => setShowColumnsMenu((prev) => !prev)}
                className="h-[34px] px-3 text-xs font-semibold border border-slate-300 rounded-lg bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" /> Colunas
              </button>

              {showColumnsMenu && (
                <div className="absolute right-0 top-10 z-40 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-1.5 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-[11px] font-bold uppercase text-slate-500">
                      Colunas Visíveis
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowColumnsMenu(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {ANALYTICAL_COLUMN_DEFS.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-xs text-slate-700 py-0.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedColumns[col.key] !== false}
                        onChange={() =>
                          setSelectedColumns((prev) => ({
                            ...prev,
                            [col.key]: prev[col.key] === false
                          }))
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[560px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  {selectedColumns.contractNumber !== false && <th className="py-2.5 px-3 font-bold">Contrato</th>}
                  {selectedColumns.producerName !== false && (
                    <th className="py-2.5 px-3 font-bold cursor-pointer" onClick={() => handleSortClick('producerName')}>
                      Produtor
                    </th>
                  )}
                  {selectedColumns.farmName !== false && <th className="py-2.5 px-3 font-bold">Fazenda</th>}
                  {selectedColumns.product !== false && <th className="py-2.5 px-3 font-bold">Produto</th>}
                  {selectedColumns.crop !== false && <th className="py-2.5 px-3 font-bold">Safra</th>}
                  {selectedColumns.buyerName && <th className="py-2.5 px-3 font-bold">Destino (Comprador)</th>}
                  {selectedColumns.closingDate && <th className="py-2.5 px-3 font-bold">Fechamento</th>}
                  {selectedColumns.freightType !== false && <th className="py-2.5 px-3 font-bold">Frete</th>}
                  {selectedColumns.pickupLocation !== false && <th className="py-2.5 px-3 font-bold">Local Embarque</th>}
                  {selectedColumns.startDate && <th className="py-2.5 px-3 font-bold">Início</th>}
                  {selectedColumns.endDate && <th className="py-2.5 px-3 font-bold">Fim</th>}
                  {selectedColumns.periodLabel !== false && <th className="py-2.5 px-3 font-bold">Período Contratado</th>}
                  {selectedColumns.contractedVolume !== false && (
                    <th className="py-2.5 px-3 font-bold text-right">Contratado ({unitLabel})</th>
                  )}
                  {selectedColumns.deliveredVolume !== false && (
                    <th className="py-2.5 px-3 font-bold text-right">Entregue Reg.</th>
                  )}
                  {selectedColumns.balanceVolume !== false && (
                    <th className="py-2.5 px-3 font-bold text-right">Saldo ({unitLabel})</th>
                  )}
                  {selectedColumns.deliveredPct !== false && (
                    <th className="py-2.5 px-3 font-bold text-right">%</th>
                  )}
                  {selectedColumns.logisticsStatus !== false && <th className="py-2.5 px-3 font-bold">Situação Entrega</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {analyticalRows.slice(0, 300).map((r) => (
                  <tr
                    key={r.contractId}
                    onClick={() =>
                      onDrillDown(
                        `${r.contractNumber} — ${r.producerName}`,
                        `${r.window.exactDatesLabel} · ${r.logisticsStatusLabel}`,
                        [r.contractId]
                      )
                    }
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    {selectedColumns.contractNumber !== false && (
                      <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">{r.contractNumber}</td>
                    )}
                    {selectedColumns.producerName !== false && (
                      <td className="py-2 px-3 text-slate-800 max-w-[200px] truncate" title={r.producerName}>
                        {r.producerName}
                      </td>
                    )}
                    {selectedColumns.farmName !== false && (
                      <td className="py-2 px-3 text-slate-600 max-w-[160px] truncate" title={r.farmName}>
                        {r.farmName}
                      </td>
                    )}
                    {selectedColumns.product !== false && <td className="py-2 px-3 text-slate-700">{r.product}</td>}
                    {selectedColumns.crop !== false && <td className="py-2 px-3 text-slate-600">{r.crop}</td>}
                    {selectedColumns.buyerName && (
                      <td className="py-2 px-3 text-slate-600 max-w-[160px] truncate" title={r.buyerName}>
                        {r.buyerName}
                      </td>
                    )}
                    {selectedColumns.closingDate && (
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDateBR(r.closingDate)}</td>
                    )}
                    {selectedColumns.freightType !== false && (
                      <td className="py-2 px-3 font-semibold text-slate-700">{r.freightType}</td>
                    )}
                    {selectedColumns.pickupLocation !== false && (
                      <td className="py-2 px-3 text-slate-600 max-w-[160px] truncate" title={r.pickupLocation}>
                        {r.pickupLocation}
                      </td>
                    )}
                    {selectedColumns.startDate && (
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDateBR(r.window.startIso)}</td>
                    )}
                    {selectedColumns.endDate && (
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDateBR(r.window.endIso)}</td>
                    )}
                    {selectedColumns.periodLabel !== false && (
                      <td className="py-2 px-3 text-slate-700 whitespace-nowrap" title={r.window.exactDatesLabel}>
                        <div>{r.window.periodShortLabel}</div>
                        <div className="text-[10px] text-slate-400">{r.window.exactDatesLabel}</div>
                      </td>
                    )}
                    {selectedColumns.contractedVolume !== false && (
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {formatVol(r.contractedVolume)}
                      </td>
                    )}
                    {selectedColumns.deliveredVolume !== false && (
                      <td className="py-2 px-3 text-right text-emerald-700 whitespace-nowrap">
                        {formatVol(r.deliveredVolume)}
                      </td>
                    )}
                    {selectedColumns.balanceVolume !== false && (
                      <td className="py-2 px-3 text-right font-semibold text-amber-800 whitespace-nowrap">
                        {formatVol(r.balanceVolume)}
                      </td>
                    )}
                    {selectedColumns.deliveredPct !== false && (
                      <td className="py-2 px-3 text-right text-slate-500 whitespace-nowrap">
                        {r.deliveredPct.toFixed(0)}%
                      </td>
                    )}
                    {selectedColumns.logisticsStatus !== false && (
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${
                            STATUS_BADGE_CLASS[r.logisticsStatus]
                          }`}
                        >
                          {r.logisticsStatusLabel}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
                {analyticalRows.length === 0 && (
                  <tr>
                    <td colSpan={16} className="py-10 text-center text-slate-400">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {analyticalRows.length > 300 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                Exibindo os primeiros 300 de {analyticalRows.length} contratos. Use os filtros ou exporte Excel/CSV para a relação completa.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: ACOMPANHAMENTO DE ENTREGAS */}
      {subView === 'TRACKING' && (
        <div className="space-y-6">
          {/* Status Cards Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LOGISTICS_STATUS_ORDER.map((st) => {
              const info = summary.statusCounts[st];
              const matchingIds = filteredRows
                .filter((r) => r.logisticsStatus === st)
                .map((r) => r.contractId);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    matchingIds.length > 0 &&
                    onDrillDown(
                      LOGISTICS_STATUS_LABELS[st],
                      `${info.count} contrato(s) · Saldo: ${formatVol(info.balance)} ${unitLabel}`,
                      matchingIds
                    )
                  }
                  className={`text-left border rounded-xl p-3.5 transition-all hover:shadow-xs ${STATUS_BADGE_CLASS[st]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-tight">
                      {LOGISTICS_STATUS_LABELS[st]}
                    </span>
                    <span className="text-xs font-bold tabular-nums">{info.count}</span>
                  </div>
                  <p className="text-base font-bold mt-1 tabular-nums">
                    {formatVol(info.contracted)} {unitLabel}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5 tabular-nums">
                    Saldo pendente: {formatVol(info.balance)} {unitLabel}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Data Source Note + Shipments Timeline */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  Embarques Efetivos por Data de Entrega (delivery_date)
                </h4>
                <span className="text-[11px] text-slate-500">
                  {summary.contractsWithShipments} c/ romaneios · {summary.contractsFallbackDelivered} fallback
                </span>
              </div>

              {summary.shipmentTimeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Nenhum romaneio registrado na tabela de embarques para o filtro atual.
                </div>
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.shipmentTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number) => `${formatVol(val)} ${unitLabel}`} />
                      <Bar
                        dataKey="deliveredVolume"
                        name="Volume Embarcado"
                        fill="#059669"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Operational Follow-up Alerts */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Acompanhamento &amp; Pontos de Atenção
                </h4>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setTrackingAlertTab('OVERDUE')}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      trackingAlertTab === 'OVERDUE'
                        ? 'bg-red-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Atraso Conf. ({summary.alerts.overdueConfirmed.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingAlertTab('UNCONFIRMED')}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      trackingAlertTab === 'UNCONFIRMED'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Sem Conf. ({summary.alerts.pastEndUnconfirmed.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingAlertTab('ENDING_15D')}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      trackingAlertTab === 'ENDING_15D'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Vence ≤ 15d ({summary.alerts.endingSoon15d.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackingAlertTab('INCONSISTENT')}
                    className={`px-2.5 py-1 rounded-md font-semibold ${
                      trackingAlertTab === 'INCONSISTENT'
                        ? 'bg-rose-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    Datas Inv. ({summary.alerts.inconsistentDates.length})
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[260px] divide-y divide-slate-100 text-xs">
                {currentAlertRows.slice(0, 50).map((r) => (
                  <div
                    key={r.contractId}
                    onClick={() =>
                      onDrillDown(
                        `${r.contractNumber} — ${r.producerName}`,
                        `${r.window.exactDatesLabel} · ${r.logisticsStatusLabel}`,
                        [r.contractId]
                      )
                    }
                    className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {r.contractNumber} · {r.producerName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {r.product} · {r.farmName} · {r.window.exactDatesLabel}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p className="font-bold text-amber-800">
                        Saldo: {formatVol(r.balanceVolume)} {unitLabel}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {r.daysSinceEnd !== null
                          ? `${r.daysSinceEnd}d após fim`
                          : r.daysUntilEnd !== null
                          ? `Faltam ${r.daysUntilEnd}d`
                          : 'Data inválida'}
                      </p>
                    </div>
                  </div>
                ))}
                {currentAlertRows.length === 0 && (
                  <div className="py-10 text-center text-slate-400 flex flex-col items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Nenhum contrato nesta lista de atenção.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
