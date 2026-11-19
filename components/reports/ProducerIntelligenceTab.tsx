import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { FileDown, AlertTriangle, Info, Sprout } from 'lucide-react';
import {
  CROP_CURVE_COLORS,
  EnrichedContract,
  ProducerIntelligenceResult,
  VolumeUnit,
  buildProducerIntelligence,
  formatDateBR
} from '../../services/reportsAnalytics';
import { MultiSelectFilter, MultiSelectOption } from './MultiSelectFilter';
import { CurrencyCode, EconomicGroup, NormalizedContractStatus } from '../../types';

interface ProducerIntelligenceTabProps {
  enrichedContracts: EnrichedContract[];
  unit: VolumeUnit;
  onChangeUnit: (u: VolumeUnit) => void;
  producerOptions: MultiSelectOption[];
  economicGroups: EconomicGroup[];
  availableProducts: string[];
  availableCrops: string[];
  availableStatuses: NormalizedContractStatus[];
  onOpenExternalExport: (params: {
    intel: ProducerIntelligenceResult;
    producerOrGroupTitle: string;
    producerDocsLabel: string;
    periodLabel: string;
    filtersSummary: string[];
  }) => void;
}

export const ProducerIntelligenceTab: React.FC<ProducerIntelligenceTabProps> = ({
  enrichedContracts,
  unit,
  onChangeUnit,
  producerOptions,
  economicGroups,
  availableProducts,
  availableCrops,
  availableStatuses,
  onOpenExternalExport
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedProducerKeys, setSelectedProducerKeys] = useState<string[]>(() =>
    producerOptions.length > 0 ? [producerOptions[0].value] : []
  );
  const [selectedFarms, setSelectedFarms] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['SOJA']);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedCurrencies, setSelectedCurrencies] = useState<CurrencyCode[]>(['BRL']);
  const [selectedStatuses, setSelectedStatuses] = useState<NormalizedContractStatus[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Effective producer items (before farm filter so farm dropdown adapts)
  const producerScopeItems = useMemo(() => {
    const activeGroup = selectedGroupId
      ? economicGroups.find((g) => g.id === selectedGroupId)
      : undefined;
    const groupSet = activeGroup ? new Set(activeGroup.producerIds) : null;

    return enrichedContracts.filter((item) => {
      if (groupSet) {
        return Boolean(item.producer.producerId && groupSet.has(item.producer.producerId));
      }
      if (selectedProducerKeys.length > 0) {
        return selectedProducerKeys.includes(item.producer.producerKey);
      }
      return true;
    });
  }, [enrichedContracts, selectedGroupId, economicGroups, selectedProducerKeys]);

  const availableFarmsForSelection = useMemo(() => {
    return Array.from(new Set(producerScopeItems.map((i) => i.farm.farmName))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [producerScopeItems]);

  const filteredItems = useMemo(() => {
    return producerScopeItems.filter((item) => {
      const c = item.contract;
      if (selectedFarms.length > 0 && !selectedFarms.includes(item.farm.farmName)) return false;
      if (selectedProducts.length > 0 && !selectedProducts.includes(c.product)) return false;
      if (selectedCrops.length > 0 && !selectedCrops.includes(c.crop)) return false;
      if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(c.currency)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.normalizedStatus)) return false;
      if (startDate && (!item.closingParts || item.closingParts.isoDate < startDate)) return false;
      if (endDate && (!item.closingParts || item.closingParts.isoDate > endDate)) return false;
      return true;
    });
  }, [
    producerScopeItems,
    selectedFarms,
    selectedProducts,
    selectedCrops,
    selectedCurrencies,
    selectedStatuses,
    startDate,
    endDate
  ]);

  const intel = useMemo(() => buildProducerIntelligence(filteredItems, unit), [filteredItems, unit]);

  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const currSym = intel.currency === 'USD' ? 'US$' : 'R$';

  const targetMeta = useMemo(() => {
    const activeGroup = selectedGroupId
      ? economicGroups.find((g) => g.id === selectedGroupId)
      : undefined;
    if (activeGroup) {
      const docs = Array.from(new Set(filteredItems.map((i) => i.producer.doc).filter(Boolean))).join(' · ');
      return {
        title: `${activeGroup.name} (Grupo Consolidado)`,
        docs
      };
    }
    if (selectedProducerKeys.length === 1) {
      const opt = producerOptions.find((o) => o.value === selectedProducerKeys[0]);
      return {
        title: opt?.label || 'Produtor Selecionado',
        docs: opt?.subLabel || ''
      };
    }
    if (selectedProducerKeys.length > 1) {
      const names = selectedProducerKeys
        .map((k) => producerOptions.find((o) => o.value === k)?.label || k)
        .slice(0, 3);
      return {
        title:
          selectedProducerKeys.length <= 3
            ? names.join(' + ')
            : `${names.join(', ')} (+${selectedProducerKeys.length - 3})`,
        docs: `${selectedProducerKeys.length} cadastros consolidados`
      };
    }
    return {
      title: 'Todos os Produtores Filtrados',
      docs: ''
    };
  }, [selectedGroupId, economicGroups, filteredItems, selectedProducerKeys, producerOptions]);

  const periodLabel = useMemo(() => {
    if (startDate && endDate) return `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
    if (startDate) return `A partir de ${formatDateBR(startDate)}`;
    if (endDate) return `Até ${formatDateBR(endDate)}`;
    if (selectedCrops.length > 0) return `Safras ${selectedCrops.join(', ')}`;
    return 'Histórico completo';
  }, [startDate, endDate, selectedCrops]);

  const formatMoney = (v: number | null, sym = currSym) =>
    v !== null
      ? `${sym} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '-';

  return (
    <div className="space-y-5">
      {/* Selector & Filters Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-700" />
              Inteligência Comercial do Produtor
            </h3>
            <p className="text-xs text-slate-500">
              Analise preço médio ponderado, safras, estratégia mensal e gere relatórios externos isolados para enviar ao produtor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
              disabled={intel.dealsCount === 0}
              onClick={() => {
                const summary: string[] = [];
                if (selectedProducts.length > 0) summary.push(`Produtos: ${selectedProducts.join(', ')}`);
                if (selectedCrops.length > 0) summary.push(`Safras: ${selectedCrops.join(', ')}`);
                if (selectedFarms.length > 0) summary.push(`Fazendas: ${selectedFarms.join(', ')}`);
                if (selectedCurrencies.length > 0) summary.push(`Moeda: ${selectedCurrencies.join(', ')}`);
                if (startDate || endDate) summary.push(`Período: ${periodLabel}`);
                onOpenExternalExport({
                  intel,
                  producerOrGroupTitle: targetMeta.title,
                  producerDocsLabel: targetMeta.docs,
                  periodLabel,
                  filtersSummary: summary
                });
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" /> Gerar Relatório do Produtor (PDF / Excel / CSV)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          {economicGroups.length > 0 && (
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 truncate">
                Grupo Econômico (Sessão)
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Usar seleção individual abaixo</option>
                {economicGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.producerIds.length})
                  </option>
                ))}
              </select>
            </div>
          )}

          <MultiSelectFilter
            className={economicGroups.length > 0 ? 'sm:col-span-2 lg:col-span-5' : 'sm:col-span-2 lg:col-span-6'}
            label="Produtor(es) (aceita múltipla seleção p/ grupo)"
            placeholder="Todos os produtores"
            options={producerOptions}
            selectedValues={selectedProducerKeys}
            onChange={(vals) => {
              setSelectedGroupId('');
              setSelectedProducerKeys(vals);
              setSelectedFarms([]);
            }}
            dropdownMinWidth={360}
            maxInlineTags={2}
            searchPlaceholder="Buscar por nome ou CPF/CNPJ..."
          />

          <MultiSelectFilter
            className={economicGroups.length > 0 ? 'lg:col-span-4' : 'sm:col-span-2 lg:col-span-6'}
            label="Fazendas do Produtor"
            placeholder="Todas as fazendas"
            options={availableFarmsForSelection.map((f) => ({ value: f, label: f }))}
            selectedValues={selectedFarms}
            onChange={setSelectedFarms}
            dropdownMinWidth={320}
            maxInlineTags={2}
            searchPlaceholder="Buscar fazenda..."
          />

          <MultiSelectFilter
            className="lg:col-span-2"
            label="Produtos"
            placeholder="Todos os produtos"
            options={availableProducts.map((p) => ({ value: p, label: p }))}
            selectedValues={selectedProducts}
            onChange={setSelectedProducts}
            dropdownMinWidth={240}
            searchPlaceholder="Buscar produto..."
          />

          <MultiSelectFilter
            className="lg:col-span-2"
            label="Safras"
            placeholder="Todas as safras"
            options={availableCrops.map((c) => ({ value: c, label: `Safra ${c}` }))}
            selectedValues={selectedCrops}
            onChange={setSelectedCrops}
            dropdownMinWidth={220}
            searchPlaceholder="Buscar safra..."
          />

          <MultiSelectFilter
            className="lg:col-span-2"
            label="Moeda"
            placeholder="BRL e USD"
            options={[
              { value: 'BRL', label: 'BRL (R$)' },
              { value: 'USD', label: 'USD (US$)' }
            ]}
            selectedValues={selectedCurrencies}
            onChange={(vals) => setSelectedCurrencies(vals as CurrencyCode[])}
            dropdownMinWidth={220}
            searchPlaceholder="Buscar moeda..."
          />

          <MultiSelectFilter
            className="lg:col-span-3"
            label="Status"
            placeholder="Todos os status"
            options={availableStatuses.map((s) => ({ value: s, label: s }))}
            selectedValues={selectedStatuses}
            onChange={(vals) => setSelectedStatuses(vals as NormalizedContractStatus[])}
            dropdownMinWidth={250}
            searchPlaceholder="Buscar status..."
          />

          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-2 gap-2 min-w-0">
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">De</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-[38px] px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Até</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-[38px] px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Warning if multiple products or currencies */}
      {!intel.canComputeSingleAverage && intel.dealsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Culturas ou moedas diferentes selecionadas</strong> ({intel.distinctProducts.join(', ')} ·{' '}
            {intel.distinctCurrencies.join(', ')}). Para evitar distorção matemática, o preço médio ponderado consolidado não mistura culturas nem BRL/USD — consulte o detalhamento por Produto/Moeda abaixo ou filtre apenas 1 cultura e 1 moeda.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 tabular-nums">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Volume Negociado</p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {intel.totalVolume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} {unitLabel}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">{intel.dealsCount} negócio(s) realizado(s)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Preço Médio Ponderado</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">
            {intel.weightedAvgPrice !== null ? `${formatMoney(intel.weightedAvgPrice)}/sc` : 'Separado'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Baseado em {intel.priceCoveragePct.toFixed(1)}% do volume (somente fixados válidos)
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Maior / Menor Preço</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            Máx: {formatMoney(intel.maxPrice)}
          </p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">
            Mín: {formatMoney(intel.minPrice)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Sobre contratos fixados válidos</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fixado × A Fixar</p>
          <p className="text-sm font-bold text-slate-900 mt-1">
            {intel.fixedVolume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} {unitLabel} fixado
          </p>
          <p className="text-xs font-semibold text-amber-700 mt-0.5">
            {intel.toFixVolume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} {unitLabel} a fixar
          </p>
          {intel.indicativeVolume > 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              ({intel.indicativeVolume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} {unitLabel} c/ indicativo)
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Valor Bruto Negociado</p>
          <p className="text-lg font-bold text-slate-900 mt-1">
            {intel.currency ? formatMoney(intel.grossNegotiatedValue) : 'Ver por moeda'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1.5">Receita bruta nominal contratada (não é lucro líquido)</p>
        </div>
      </div>

      {/* Automatic Highlights Strip */}
      {intel.dealsCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-700" />
            Leitura Automática dos Dados Históricos
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {intel.bestCropByVolume && (
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500 block">Safra de Maior Volume</span>
                <span className="font-bold text-slate-900">
                  Safra {intel.bestCropByVolume.crop} ({intel.bestCropByVolume.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} {unitLabel})
                </span>
              </div>
            )}
            {intel.bestCropByAvgPrice && (
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500 block">Safra de Melhor Preço Médio</span>
                <span className="font-bold text-emerald-700">
                  Safra {intel.bestCropByAvgPrice.crop} ({formatMoney(intel.bestCropByAvgPrice.weightedAvgPrice)}/sc)
                </span>
              </div>
            )}
            {intel.highlights.peakVolumeMonth && (
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500 block">Mês de Maior Volume Vendido</span>
                <span className="font-bold text-slate-900">
                  {intel.highlights.peakVolumeMonth.label} ({intel.highlights.peakVolumeMonth.sharePct.toFixed(1)}% do total)
                </span>
              </div>
            )}
            {intel.highlights.peakPriceMonth && (
              <div className="border border-slate-200 rounded-lg p-3">
                <span className="text-[11px] text-slate-500 block">Mês de Maior Preço Médio</span>
                <span className="font-bold text-emerald-700">
                  {intel.highlights.peakPriceMonth.label} ({formatMoney(intel.highlights.peakPriceMonth.weightedAvgPrice)}/sc)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      {intel.dealsCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Estratégia Mensal: Volume ({unitLabel}) × Preço Médio Ponderado
            </h4>
            <p className="text-xs text-slate-500 mb-4">Distribuição histórica de fechamentos ao longo dos meses.</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={intel.monthlyStrategy.slice(-24)} margin={{ top: 10, right: 16, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#059669' }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar yAxisId="left" dataKey="volume" name={`Volume (${unitLabel})`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  {intel.canComputeSingleAverage && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="weightedAvgPrice"
                      name={`Preço Médio (${currSym}/sc)`}
                      stroke="#059669"
                      strokeWidth={2.5}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Sazonalidade de Vendas entre Safras (Jan–Dez)
            </h4>
            <p className="text-xs text-slate-500 mb-4">Compara em quais meses do calendário o produtor fechou cada safra.</p>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={intel.monthlyByCropSeries.rows} margin={{ top: 10, right: 16, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {intel.monthlyByCropSeries.crops.map((cr, idx) => (
                    <Line
                      key={cr}
                      type="monotone"
                      dataKey={cr}
                      name={`Safra ${cr}`}
                      stroke={CROP_CURVE_COLORS[idx % CROP_CURVE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2.5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Crop Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
          <h4 className="text-sm font-bold text-slate-900">Comparativo Anual entre Safras</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Safra</th>
                <th className="py-2.5 px-3 font-semibold text-right">Volume ({unitLabel})</th>
                <th className="py-2.5 px-3 font-semibold text-right">Negócios</th>
                <th className="py-2.5 px-3 font-semibold text-right">Preço Médio Pond.</th>
                <th className="py-2.5 px-3 font-semibold text-right">Maior Preço</th>
                <th className="py-2.5 px-3 font-semibold text-right">Menor Preço</th>
                <th className="py-2.5 px-3 font-semibold text-right">Valor Bruto</th>
                <th className="py-2.5 px-4 font-semibold text-right">Evolução Vol.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {intel.cropComparison.map((c) => (
                <tr key={c.crop} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-bold text-slate-900">Safra {c.crop}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">
                    {c.volume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}
                  </td>
                  <td className="py-2.5 px-3 text-right">{c.dealsCount}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                    {formatMoney(c.weightedAvgPrice)}
                  </td>
                  <td className="py-2.5 px-3 text-right">{formatMoney(c.maxPrice)}</td>
                  <td className="py-2.5 px-3 text-right">{formatMoney(c.minPrice)}</td>
                  <td className="py-2.5 px-3 text-right">
                    {intel.distinctCurrencies.length <= 1 ? formatMoney(c.grossNegotiatedValue) : '-'}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-semibold ${
                      c.volumeEvolutionPct === null
                        ? 'text-slate-400'
                        : c.volumeEvolutionPct >= 0
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {c.volumeEvolutionPct !== null
                      ? `${c.volumeEvolutionPct >= 0 ? '+' : ''}${c.volumeEvolutionPct.toFixed(1)}%`
                      : '-'}
                  </td>
                </tr>
              ))}
              {intel.cropComparison.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Nenhum contrato encontrado para o produtor/filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product & Farm Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h4 className="text-sm font-bold text-slate-900">Detalhamento por Cultura / Moeda</h4>
          </div>
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Cultura (Moeda)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Volume ({unitLabel})</th>
                <th className="py-2.5 px-3 font-semibold text-right">Preço Médio (/sc)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Part. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {intel.byProduct.map((p) => (
                <tr key={p.key}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{p.label}</td>
                  <td className="py-2.5 px-3 text-right">
                    {p.volume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                    {p.weightedAvgPrice !== null ? p.weightedAvgPrice.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">{p.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h4 className="text-sm font-bold text-slate-900">Detalhamento por Fazenda</h4>
          </div>
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Fazenda</th>
                <th className="py-2.5 px-3 font-semibold">Produto</th>
                <th className="py-2.5 px-3 font-semibold text-right">Volume ({unitLabel})</th>
                <th className="py-2.5 px-3 font-semibold text-right">Preço Médio (/sc)</th>
                <th className="py-2.5 px-4 font-semibold text-right">Part. %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {intel.byFarmAndProduct.map((f) => (
                <tr key={f.key}>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{f.label}</td>
                  <td className="py-2.5 px-3 text-slate-600">{f.product}</td>
                  <td className="py-2.5 px-3 text-right">
                    {f.volume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                    {f.weightedAvgPrice !== null ? f.weightedAvgPrice.toFixed(2) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right">{f.sharePct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
