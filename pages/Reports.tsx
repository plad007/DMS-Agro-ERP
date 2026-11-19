import React, { useMemo, useState } from 'react';
import {
  Wallet,
  BarChart3,
  TrendingUp,
  Sprout,
  Filter,
  X,
  Database,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Truck
} from 'lucide-react';
import {
  Buyer,
  Contract,
  CurrencyCode,
  EconomicGroup,
  NormalizedContractStatus,
  Producer,
  Shipment,
  SystemDataIntegrity,
  ForecastOrigin
} from '../types';
import {
  DEFAULT_REPORT_FILTERS,
  MONTH_SHORT_PT,
  ProducerIntelligenceResult,
  ReportFilterState,
  VolumeUnit,
  buildCommissionAnalytics,
  buildCommissionMatrix,
  buildVolumeAnalytics,
  buildVolumeMatrix,
  enrichContracts,
  filterEnrichedContracts,
  formatDateBR,
  getCropYearNumber
} from '../services/reportsAnalytics';
import {
  DEFAULT_EXTERNAL_LOGISTICS_SECTIONS,
  ExternalLogisticsSections,
  ExternalProducerSections,
  buildExternalProducerExportSheets,
  buildLogisticsExternalExportSheets,
  downloadCsvFile,
  downloadXlsxWorkbook
} from '../services/reportsExport';
import { MultiSelectFilter, MultiSelectOption } from '../components/reports/MultiSelectFilter';
import { CommissionReportTab } from '../components/reports/CommissionReportTab';
import { VolumeReportTab } from '../components/reports/VolumeReportTab';
import { PacingReportTab } from '../components/reports/PacingReportTab';
import { ProducerIntelligenceTab } from '../components/reports/ProducerIntelligenceTab';
import { LogisticsScheduleTab } from '../components/reports/LogisticsScheduleTab';
import { ProducerLogisticsExternalView } from '../services/logisticsScheduleAnalytics';
import {
  ContractDrillDownModal,
  DataIntegrityModal,
  ExternalLogisticsConfigModal,
  ExternalProducerConfigModal,
  SqlAndGroupsModal
} from '../components/reports/ReportsSharedModals';
import { PrintReportPayload, ReportPrintModal } from '../components/reports/ReportPrintModal';

interface ReportsProps {
  contracts: Contract[];
  shipments?: Shipment[];
  producers?: Producer[];
  buyers?: Buyer[];
  dataIntegrity?: SystemDataIntegrity;
}

type ReportTabId = 'COMMISSIONS' | 'VOLUME' | 'PACING' | 'PRODUCER_INTEL' | 'LOGISTICS_SCHEDULE';

export const Reports: React.FC<ReportsProps> = ({
  contracts,
  shipments = [],
  producers = [],
  dataIntegrity
}) => {
  const [activeTab, setActiveTab] = useState<ReportTabId>('COMMISSIONS');
  const [unit, setUnit] = useState<VolumeUnit>('SCS');
  const [filters, setFilters] = useState<ReportFilterState>(DEFAULT_REPORT_FILTERS);
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);

  // Session-only Economic Groups (Etapa 7 preview; permanent DB writes disabled until SQL approval)
  const [economicGroups, setEconomicGroups] = useState<EconomicGroup[]>([]);

  // Modals State
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [drillDownState, setDrillDownState] = useState<{
    title: string;
    subtitle: string;
    contractIds: string[];
  } | null>(null);
  const [printPayload, setPrintPayload] = useState<PrintReportPayload | null>(null);
  const [externalModalState, setExternalModalState] = useState<{
    intel: ProducerIntelligenceResult;
    producerOrGroupTitle: string;
    producerDocsLabel: string;
    periodLabel: string;
    filtersSummary: string[];
  } | null>(null);
  const [externalSections, setExternalSections] = useState<ExternalProducerSections>({
    executiveSummary: true,
    charts: true,
    cropComparison: true,
    monthlyStrategy: true,
    byProduct: true,
    byFarm: true,
    analyticalContracts: true
  });
  const [externalLogisticsModalState, setExternalLogisticsModalState] = useState<{
    producerView: ProducerLogisticsExternalView;
    filtersSummary: string[];
    selectedColumns: Record<string, boolean>;
  } | null>(null);
  const [externalLogisticsSections, setExternalLogisticsSections] =
    useState<ExternalLogisticsSections>(DEFAULT_EXTERNAL_LOGISTICS_SECTIONS);

  // 1. Enrich all contracts with producer/farm/logistics/integrity metadata
  const { enriched: enrichedContracts, issues: qualityIssues } = useMemo(
    () => enrichContracts(contracts, shipments, producers),
    [contracts, shipments, producers]
  );

  const enrichedById = useMemo(() => {
    const map = new Map<string, (typeof enrichedContracts)[number]>();
    enrichedContracts.forEach((item) => map.set(item.contract.id, item));
    return map;
  }, [enrichedContracts]);

  // 2. Dynamic Filter Options extracted from dataset
  const filterOptions = useMemo(() => {
    const yearsSet = new Set<string>();
    const cropsSet = new Set<string>();
    const productsSet = new Set<string>();
    const farmsSet = new Set<string>();
    const statusesSet = new Set<NormalizedContractStatus>();
    const producerMap = new Map<string, { label: string; subLabel?: string }>();

    for (const item of enrichedContracts) {
      if (item.closingParts) yearsSet.add(String(item.closingParts.year));
      if (item.contract.crop) cropsSet.add(item.contract.crop);
      if (item.contract.product) productsSet.add(item.contract.product);
      farmsSet.add(item.farm.farmName);
      statusesSet.add(item.normalizedStatus);

      if (!producerMap.has(item.producer.producerKey)) {
        const prefix =
          item.producer.matchMethod === 'UNMATCHED' || item.producer.matchMethod === 'CONFLICT'
            ? '[Pendência] '
            : '';
        producerMap.set(item.producer.producerKey, {
          label: `${prefix}${item.producer.displayName}`,
          subLabel: item.producer.doc || item.producer.conflictReason
        });
      }
    }

    const years = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
    const crops = Array.from(cropsSet).sort((a, b) => getCropYearNumber(b) - getCropYearNumber(a));
    const products = Array.from(productsSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    const farms = Array.from(farmsSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    const statuses = Array.from(statusesSet).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
    const stripPendingPrefix = (label: string) => label.replace(/^\[Pendência\]\s*/i, '');
    const producerOpts: MultiSelectOption[] = Array.from(producerMap.entries())
      .map(([value, meta]) => ({ value, label: meta.label, subLabel: meta.subLabel }))
      .sort((a, b) =>
        stripPendingPrefix(a.label).localeCompare(stripPendingPrefix(b.label), 'pt-BR', {
          sensitivity: 'base'
        })
      );

    return { years, crops, products, farms, statuses, producerOpts };
  }, [enrichedContracts]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    if (filters.years.length > 0) count++;
    if (filters.months.length > 0) count++;
    if (filters.crops.length > 0) count++;
    if (filters.products.length > 0) count++;
    if (filters.producerKeys.length > 0) count++;
    if (filters.farmNames.length > 0) count++;
    if (filters.economicGroupId) count++;
    if (filters.currencies.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (activeTab === 'COMMISSIONS' && filters.forecastOrigins.length > 0) count++;
    return count;
  }, [filters, activeTab]);

  const filtersSummary = useMemo(() => {
    const parts: string[] = [];
    if (filters.startDate || filters.endDate) {
      parts.push(
        `Período: ${filters.startDate ? formatDateBR(filters.startDate) : '...'} até ${
          filters.endDate ? formatDateBR(filters.endDate) : '...'
        }`
      );
    }
    if (filters.years.length > 0) parts.push(`Anos: ${filters.years.join(', ')}`);
    if (filters.months.length > 0) {
      parts.push(`Meses: ${filters.months.map((m) => MONTH_SHORT_PT[Number(m) - 1] || m).join(', ')}`);
    }
    if (filters.crops.length > 0) parts.push(`Safras: ${filters.crops.join(', ')}`);
    if (filters.products.length > 0) parts.push(`Produtos: ${filters.products.join(', ')}`);
    if (filters.economicGroupId) {
      const grp = economicGroups.find((g) => g.id === filters.economicGroupId);
      if (grp) parts.push(`Grupo: ${grp.name}`);
    }
    if (filters.producerKeys.length > 0) parts.push(`Produtores: ${filters.producerKeys.length} selec.`);
    if (filters.farmNames.length > 0) parts.push(`Fazendas: ${filters.farmNames.join(', ')}`);
    if (filters.currencies.length > 0) parts.push(`Moedas: ${filters.currencies.join(', ')}`);
    if (filters.statuses.length > 0) parts.push(`Status: ${filters.statuses.join(', ')}`);
    if (activeTab === 'COMMISSIONS' && filters.forecastOrigins.length > 0) {
      parts.push(`Origem Previsão: ${filters.forecastOrigins.join(', ')}`);
    }
    return parts;
  }, [filters, economicGroups, activeTab]);

  const consolidatedLabel = useMemo(() => {
    if (filters.economicGroupId) {
      return economicGroups.find((g) => g.id === filters.economicGroupId)?.name || 'Grupo Econômico';
    }
    if (filters.producerKeys.length > 0) {
      return `Seleção Consolidada (${filters.producerKeys.length} produtores)`;
    }
    return 'Visão Consolidada Geral';
  }, [filters.economicGroupId, filters.producerKeys.length, economicGroups]);

  // 3. Tab 1 Analytics (Commissions)
  const commissionAnalytics = useMemo(
    () => buildCommissionAnalytics(enrichedContracts, filters, economicGroups),
    [enrichedContracts, filters, economicGroups]
  );

  // 4. Tab 2 Analytics (Volume)
  const volumeFilteredItems = useMemo(
    () => filterEnrichedContracts(enrichedContracts, filters, { economicGroups }),
    [enrichedContracts, filters, economicGroups]
  );

  const volumeAnalytics = useMemo(
    () => buildVolumeAnalytics(volumeFilteredItems, unit),
    [volumeFilteredItems, unit]
  );

  const handleDrillDown = (title: string, subtitle: string, contractIds: string[]) => {
    setDrillDownState({ title, subtitle, contractIds });
  };

  const drillDownContracts = useMemo(() => {
    if (!drillDownState) return [];
    const uniqueIds = Array.from(new Set(drillDownState.contractIds));
    return uniqueIds
      .map((id) => enrichedById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [drillDownState, enrichedById]);

  const TABS: Array<{ id: ReportTabId; label: string; icon: React.ReactNode }> = [
    { id: 'COMMISSIONS', label: 'Comissões', icon: <Wallet className="w-4 h-4" /> },
    { id: 'VOLUME', label: 'Volume Comercial', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'PACING', label: 'Evolução de Safra', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'PRODUCER_INTEL', label: 'Inteligência do Produtor', icon: <Sprout className="w-4 h-4" /> },
    {
      id: 'LOGISTICS_SCHEDULE',
      label: 'Programação de Entregas e Retiradas',
      icon: <Truck className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatórios e Inteligência Comercial</h2>
          <p className="text-slate-500 text-sm">
            Gestão de comissões, matrizes dinâmicas de volume, ritmo de safra e relatórios externos para produtores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowIntegrityModal(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
              dataIntegrity?.hasIncompleteData
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {dataIntegrity?.hasIncompleteData ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <Database className="w-4 h-4 text-emerald-700" />
            )}
            <span>
              Base: {contracts.length} contratos · {qualityIssues.length} apontamento(s)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowSqlModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Grupos &amp; SQL (Etapa 7)
          </button>
        </div>
      </div>

      {/* Main 4 Tabs Navigation */}
      <div className="bg-slate-200/80 p-1 rounded-xl flex flex-wrap gap-1 w-full lg:w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shared Multi-Filter Panel (for Commissions & Volume tabs) */}
      {(activeTab === 'COMMISSIONS' || activeTab === 'VOLUME') && (
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
                Filtros Compartilhados{' '}
                {activeFilterCount > 0 ? `(${activeFilterCount} ativo${activeFilterCount > 1 ? 's' : ''})` : ''}
              </span>
              {showFiltersPanel ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <div className="flex items-center gap-3">
              {activeTab === 'COMMISSIONS' && (
                <span className="text-[11px] text-slate-500">
                  Período/Ano/Mês filtram pela data de previsão de recebimento da comissão.
                </span>
              )}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_REPORT_FILTERS)}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" /> Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {showFiltersPanel && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-2 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="lg:col-span-2 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Data Final</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <MultiSelectFilter
                className="lg:col-span-2"
                label="Ano"
                placeholder="Todos os anos"
                options={filterOptions.years.map((y) => ({ value: y, label: y }))}
                selectedValues={filters.years}
                onChange={(years) => setFilters((prev) => ({ ...prev, years }))}
                dropdownMinWidth={220}
                searchPlaceholder="Buscar ano..."
              />

              <MultiSelectFilter
                className="lg:col-span-2"
                label="Mês"
                placeholder="Todos os meses"
                options={MONTH_SHORT_PT.map((label, idx) => ({
                  value: String(idx + 1).padStart(2, '0'),
                  label
                }))}
                selectedValues={filters.months}
                onChange={(months) => setFilters((prev) => ({ ...prev, months }))}
                dropdownMinWidth={220}
                searchPlaceholder="Buscar mês..."
              />

              <MultiSelectFilter
                className="lg:col-span-2"
                label="Safra"
                placeholder="Todas as safras"
                options={filterOptions.crops.map((c) => ({ value: c, label: `Safra ${c}` }))}
                selectedValues={filters.crops}
                onChange={(crops) => setFilters((prev) => ({ ...prev, crops }))}
                dropdownMinWidth={220}
                searchPlaceholder="Buscar safra..."
              />

              <MultiSelectFilter
                className="lg:col-span-2"
                label="Produto"
                placeholder="Todos os produtos"
                options={filterOptions.products.map((p) => ({ value: p, label: p }))}
                selectedValues={filters.products}
                onChange={(products) => setFilters((prev) => ({ ...prev, products }))}
                dropdownMinWidth={240}
                searchPlaceholder="Buscar produto..."
              />

              <MultiSelectFilter
                className="sm:col-span-2 lg:col-span-4"
                label="Produtores"
                placeholder="Todos os produtores"
                options={filterOptions.producerOpts}
                selectedValues={filters.producerKeys}
                onChange={(producerKeys) => setFilters((prev) => ({ ...prev, producerKeys }))}
                dropdownMinWidth={360}
                maxInlineTags={2}
                searchPlaceholder="Buscar por nome ou CPF/CNPJ..."
              />

              <MultiSelectFilter
                className="lg:col-span-3"
                label="Fazenda"
                placeholder="Todas as fazendas"
                options={filterOptions.farms.map((f) => ({ value: f, label: f }))}
                selectedValues={filters.farmNames}
                onChange={(farmNames) => setFilters((prev) => ({ ...prev, farmNames }))}
                dropdownMinWidth={320}
                maxInlineTags={1}
                searchPlaceholder="Buscar fazenda..."
              />

              <div className="lg:col-span-3 min-w-0">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Grupo Econômico
                </label>
                <select
                  value={filters.economicGroupId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, economicGroupId: e.target.value }))}
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

              <MultiSelectFilter
                className="lg:col-span-2"
                label={activeTab === 'COMMISSIONS' ? 'Moeda da Mercadoria' : 'Moeda'}
                placeholder={activeTab === 'COMMISSIONS' ? 'BRL e USD (mercadoria)' : 'BRL e USD'}
                options={[
                  { value: 'BRL', label: 'BRL (R$)' },
                  { value: 'USD', label: 'USD (US$)' }
                ]}
                selectedValues={filters.currencies}
                onChange={(vals) => setFilters((prev) => ({ ...prev, currencies: vals as CurrencyCode[] }))}
                dropdownMinWidth={240}
                searchPlaceholder="Buscar moeda..."
              />

              <MultiSelectFilter
                className="lg:col-span-3"
                label="Status do Contrato"
                placeholder="Todos os status"
                options={filterOptions.statuses.map((s) => ({ value: s, label: s }))}
                selectedValues={filters.statuses}
                onChange={(vals) =>
                  setFilters((prev) => ({ ...prev, statuses: vals as NormalizedContractStatus[] }))
                }
                dropdownMinWidth={260}
                searchPlaceholder="Buscar status..."
              />

              {activeTab === 'COMMISSIONS' && (
                <MultiSelectFilter
                  className="lg:col-span-3"
                  label="Origem da Previsão"
                  placeholder="Todas as origens"
                  options={[
                    { value: 'CONFIRMED', label: 'Confirmada (Venc. Contrato)' },
                    { value: 'ESTIMATED_LEGACY', label: 'Estimada (Legado +1 dia)' },
                    { value: 'ESTIMATED_BY_SHIPMENT', label: 'Estimada por Embarque' },
                    { value: 'UNDEFINED', label: 'Sem Vencimento Definido' }
                  ]}
                  selectedValues={filters.forecastOrigins}
                  onChange={(vals) =>
                    setFilters((prev) => ({ ...prev, forecastOrigins: vals as ForecastOrigin[] }))
                  }
                  dropdownMinWidth={300}
                  searchPlaceholder="Buscar origem..."
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: COMMISSIONS */}
      {activeTab === 'COMMISSIONS' && (
        <CommissionReportTab
          analytics={commissionAnalytics}
          filters={filters}
          filtersSummary={filtersSummary}
          consolidatedLabel={consolidatedLabel}
          buildMatrix={(rowDim) =>
            buildCommissionMatrix(commissionAnalytics.rows, rowDim, filters, consolidatedLabel)
          }
          onDrillDown={handleDrillDown}
          onOpenPrint={({ mode, matrix, includeCharts, selectedColumns }) =>
            setPrintPayload({
              kind: 'COMMISSION_INTERNAL',
              title: 'Relatório Interno de Comissões — DMS Agro',
              filtersSummary,
              mode,
              includeCharts,
              selectedColumns,
              analytics: commissionAnalytics,
              matrix
            })
          }
        />
      )}

      {/* TAB 2: COMMERCIAL VOLUME */}
      {activeTab === 'VOLUME' && (
        <VolumeReportTab
          analytics={volumeAnalytics}
          unit={unit}
          onChangeUnit={setUnit}
          filtersSummary={filtersSummary}
          buildMatrix={(rowDim, colDim, metric) =>
            buildVolumeMatrix(volumeFilteredItems, rowDim, colDim, metric, unit, consolidatedLabel)
          }
          onDrillDown={handleDrillDown}
          onOpenPrint={({ mode, matrix, includeCharts, metricLabel }) =>
            setPrintPayload({
              kind: 'VOLUME_INTERNAL',
              title: 'Relatório Interno de Volume Comercial — DMS Agro',
              filtersSummary,
              mode,
              includeCharts,
              unit,
              metricLabel,
              analytics: volumeAnalytics,
              matrix
            })
          }
        />
      )}

      {/* TAB 3: CROP PACING */}
      {activeTab === 'PACING' && (
        <PacingReportTab
          enrichedContracts={enrichedContracts}
          unit={unit}
          onChangeUnit={setUnit}
          availableCrops={filterOptions.crops}
          availableProducts={filterOptions.products}
          producerOptions={filterOptions.producerOpts}
          availableStatuses={filterOptions.statuses}
        />
      )}

      {/* TAB 4: PRODUCER COMMERCIAL INTELLIGENCE */}
      {activeTab === 'PRODUCER_INTEL' && (
        <ProducerIntelligenceTab
          enrichedContracts={enrichedContracts}
          unit={unit}
          onChangeUnit={setUnit}
          producerOptions={filterOptions.producerOpts}
          economicGroups={economicGroups}
          availableProducts={filterOptions.products}
          availableCrops={filterOptions.crops}
          availableStatuses={filterOptions.statuses}
          onOpenExternalExport={(params) => setExternalModalState(params)}
        />
      )}

      {/* TAB 5: LOGISTICS DELIVERY & PICKUP SCHEDULING */}
      {activeTab === 'LOGISTICS_SCHEDULE' && (
        <LogisticsScheduleTab
          enrichedContracts={enrichedContracts}
          unit={unit}
          onChangeUnit={setUnit}
          producerOptions={filterOptions.producerOpts}
          economicGroups={economicGroups}
          availableProducts={filterOptions.products}
          availableCrops={filterOptions.crops}
          availableStatuses={filterOptions.statuses}
          onDrillDown={handleDrillDown}
          onOpenInternalPrint={({
            mode,
            includeCharts,
            metricLabel,
            selectedColumns,
            filtersSummary: logFilters,
            summary,
            matrix,
            gantt,
            analyticalRows
          }) =>
            setPrintPayload({
              kind: 'LOGISTICS_INTERNAL',
              title: 'Programação de Entregas e Retiradas — DMS Agro',
              filtersSummary: logFilters,
              mode,
              includeCharts,
              unit,
              metricLabel,
              selectedColumns,
              summary,
              matrix,
              gantt,
              analyticalRows
            })
          }
          onOpenExternalPrintOrExport={({
            producerView,
            filtersSummary: logFilters,
            selectedColumns
          }) =>
            setExternalLogisticsModalState({
              producerView,
              filtersSummary: logFilters,
              selectedColumns
            })
          }
        />
      )}

      {/* MODALS */}
      {drillDownState && (
        <ContractDrillDownModal
          title={drillDownState.title}
          subtitle={drillDownState.subtitle}
          contracts={drillDownContracts}
          unit={unit}
          showCommissionColumn={activeTab === 'COMMISSIONS'}
          onClose={() => setDrillDownState(null)}
        />
      )}

      {showIntegrityModal && (
        <DataIntegrityModal
          dataIntegrity={dataIntegrity}
          issues={qualityIssues}
          onClose={() => setShowIntegrityModal(false)}
        />
      )}

      {showSqlModal && (
        <SqlAndGroupsModal
          producers={producers}
          economicGroups={economicGroups}
          onSaveGroup={(grp) => setEconomicGroups((prev) => [...prev, grp])}
          onDeleteGroup={(gid) => {
            setEconomicGroups((prev) => prev.filter((g) => g.id !== gid));
            if (filters.economicGroupId === gid) {
              setFilters((prev) => ({ ...prev, economicGroupId: '' }));
            }
          }}
          onClose={() => setShowSqlModal(false)}
        />
      )}

      {externalModalState && (
        <ExternalProducerConfigModal
          producerOrGroupTitle={externalModalState.producerOrGroupTitle}
          producerDocsLabel={externalModalState.producerDocsLabel}
          periodLabel={externalModalState.periodLabel}
          dealsCount={externalModalState.intel.dealsCount}
          sections={externalSections}
          onChangeSections={setExternalSections}
          onPrintPdf={() => {
            const state = externalModalState;
            setExternalModalState(null);
            setPrintPayload({
              kind: 'PRODUCER_EXTERNAL',
              title: `Relatório Comercial — ${state.producerOrGroupTitle}`,
              producerOrGroupTitle: state.producerOrGroupTitle,
              producerDocsLabel: state.producerDocsLabel,
              periodLabel: state.periodLabel,
              filtersSummary: state.filtersSummary,
              unit,
              sections: externalSections,
              intel: state.intel
            });
          }}
          onExportCsv={() => {
            const sheets = buildExternalProducerExportSheets(
              externalModalState.intel,
              unit,
              externalSections
            );
            const target = sheets.find((s) => s.sheetName === 'Relacao_Contratos') || sheets[0];
            if (!target) return;
            downloadCsvFile(
              `DMS_Relatorio_Produtor_${externalModalState.producerOrGroupTitle}`,
              target.headers,
              target.rows,
              [
                `DMS Agro — Relatório Comercial do Produtor: ${externalModalState.producerOrGroupTitle}`,
                `Período: ${externalModalState.periodLabel}`
              ]
            );
          }}
          onExportXlsx={() => {
            const sheets = buildExternalProducerExportSheets(
              externalModalState.intel,
              unit,
              externalSections
            );
            downloadXlsxWorkbook(
              `DMS_Relatorio_Produtor_${externalModalState.producerOrGroupTitle}`,
              sheets,
              [
                ['Documento', 'Relatório Comercial Externo do Produtor'],
                ['Produtor / Grupo', externalModalState.producerOrGroupTitle],
                ['Documento(s)', externalModalState.producerDocsLabel || '-'],
                ['Período', externalModalState.periodLabel],
                ['Unidade', unit === 'TON' ? 'Toneladas (60kg/sc)' : 'Sacas (60kg)']
              ]
            );
          }}
          onClose={() => setExternalModalState(null)}
        />
      )}

      {externalLogisticsModalState && (
        <ExternalLogisticsConfigModal
          producerOrGroupTitle={externalLogisticsModalState.producerView.targetTitle}
          producerDocsLabel={externalLogisticsModalState.producerView.targetDocs}
          referenceDateLabel={formatDateBR(
            externalLogisticsModalState.producerView.referenceDate
          )}
          contractsCount={externalLogisticsModalState.producerView.contractsCount}
          sections={externalLogisticsSections}
          onChangeSections={setExternalLogisticsSections}
          onPrintPdf={() => {
            const state = externalLogisticsModalState;
            setExternalLogisticsModalState(null);
            setPrintPayload({
              kind: 'LOGISTICS_EXTERNAL',
              title: `Agenda de Entregas — ${state.producerView.targetTitle}`,
              filtersSummary: state.filtersSummary,
              sections: externalLogisticsSections,
              selectedColumns: state.selectedColumns,
              producerView: state.producerView
            });
          }}
          onExportCsv={() => {
            const sheets = buildLogisticsExternalExportSheets({
              producerView: externalLogisticsModalState.producerView,
              sections: externalLogisticsSections,
              selectedAnalyticalColumns: externalLogisticsModalState.selectedColumns
            });
            const target =
              sheets.find((s) => s.sheetName === 'Contratos_Entrega') ||
              sheets.find((s) => s.sheetName === 'Programacao_Periodos') ||
              sheets[0];
            if (!target) return;
            downloadCsvFile(
              `DMS_Agenda_Logistica_${externalLogisticsModalState.producerView.targetTitle}`,
              target.headers,
              target.rows,
              [
                `DMS Agro — Agenda de Entregas e Retiradas: ${externalLogisticsModalState.producerView.targetTitle}`,
                `Referência: ${formatDateBR(externalLogisticsModalState.producerView.referenceDate)}`
              ]
            );
          }}
          onExportXlsx={() => {
            const sheets = buildLogisticsExternalExportSheets({
              producerView: externalLogisticsModalState.producerView,
              sections: externalLogisticsSections,
              selectedAnalyticalColumns: externalLogisticsModalState.selectedColumns
            });
            downloadXlsxWorkbook(
              `DMS_Agenda_Logistica_${externalLogisticsModalState.producerView.targetTitle}`,
              sheets,
              [
                ['Documento', 'Agenda Logística Externa do Produtor'],
                ['Produtor / Grupo', externalLogisticsModalState.producerView.targetTitle],
                ['Documento(s)', externalLogisticsModalState.producerView.targetDocs || '-'],
                [
                  'Referência',
                  formatDateBR(externalLogisticsModalState.producerView.referenceDate)
                ],
                [
                  'Unidade',
                  externalLogisticsModalState.producerView.unit === 'TON'
                    ? 'Toneladas (60kg/sc)'
                    : 'Sacas (60kg)'
                ]
              ]
            );
          }}
          onClose={() => setExternalLogisticsModalState(null)}
        />
      )}

      {printPayload && (
        <ReportPrintModal
          payload={printPayload}
          onClose={() => setPrintPayload(null)}
        />
      )}
    </div>
  );
};
