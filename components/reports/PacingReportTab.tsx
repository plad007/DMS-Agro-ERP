import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Calendar, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import {
  EnrichedContract,
  VolumeUnit,
  buildPacingAnalytics,
  formatDateBR,
  getTodayIsoLocal
} from '../../services/reportsAnalytics';
import { MultiSelectFilter, MultiSelectOption } from './MultiSelectFilter';
import { NormalizedContractStatus } from '../../types';

interface PacingReportTabProps {
  enrichedContracts: EnrichedContract[];
  unit: VolumeUnit;
  onChangeUnit: (u: VolumeUnit) => void;
  availableCrops: string[];
  availableProducts: string[];
  producerOptions: MultiSelectOption[];
  availableStatuses: NormalizedContractStatus[];
}

export const PacingReportTab: React.FC<PacingReportTabProps> = ({
  enrichedContracts,
  unit,
  onChangeUnit,
  availableCrops,
  availableProducts,
  producerOptions,
  availableStatuses
}) => {
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['SOJA']);
  const [selectedProducers, setSelectedProducers] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<NormalizedContractStatus[]>([]);
  const [comparisonDate, setComparisonDate] = useState<string>(() => getTodayIsoLocal());
  const [metricMode, setMetricMode] = useState<'VOLUME' | 'PERCENT'>('VOLUME');

  const pacing = useMemo(
    () =>
      buildPacingAnalytics(
        enrichedContracts,
        selectedCrops,
        selectedProducts,
        selectedProducers,
        selectedStatuses,
        comparisonDate,
        unit,
        metricMode
      ),
    [
      enrichedContracts,
      selectedCrops,
      selectedProducts,
      selectedProducers,
      selectedStatuses,
      comparisonDate,
      unit,
      metricMode
    ]
  );

  const unitLabel = unit === 'TON' ? 'ton' : 'scs';

  return (
    <div className="space-y-5">
      {/* Pacing Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
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
            className="sm:col-span-2 lg:col-span-4"
            label="Produtores"
            placeholder="Todos os produtores"
            options={producerOptions}
            selectedValues={selectedProducers}
            onChange={setSelectedProducers}
            dropdownMinWidth={360}
            maxInlineTags={2}
            searchPlaceholder="Buscar por nome ou CPF/CNPJ..."
          />
          <MultiSelectFilter
            className="lg:col-span-2"
            label="Status"
            placeholder="Todos os status"
            options={availableStatuses.map((s) => ({ value: s, label: s }))}
            selectedValues={selectedStatuses}
            onChange={(vals) => setSelectedStatuses(vals as NormalizedContractStatus[])}
            dropdownMinWidth={240}
            searchPlaceholder="Buscar status..."
          />
          <div className="lg:col-span-2 min-w-0">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1 truncate">
              <Calendar className="w-3 h-3 shrink-0" /> Data de Corte (Equivalente)
            </label>
            <input
              type="date"
              value={comparisonDate}
              onChange={(e) => setComparisonDate(e.target.value)}
              className="w-full h-[38px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-start gap-2 text-[11px] text-slate-600">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>
              {metricMode === 'PERCENT'
                ? 'Percentual calculado sobre o volume total registrado no ERP para cada safra filtrada (não representa produção total da fazenda).'
                : 'Curvas acumuladas alinhadas pelo ciclo da safra (incluindo comercializações antecipadas do ano anterior).'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-slate-300 rounded-lg overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMetricMode('VOLUME')}
                className={`px-3 py-1.5 ${metricMode === 'VOLUME' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}
              >
                Volume ({unitLabel})
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('PERCENT')}
                className={`px-3 py-1.5 ${metricMode === 'PERCENT' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}
              >
                % do Total da Safra
              </button>
            </div>
            <div className="flex border border-slate-300 rounded-lg overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => onChangeUnit('SCS')}
                className={`px-2.5 py-1.5 ${unit === 'SCS' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
              >
                SCS
              </button>
              <button
                type="button"
                onClick={() => onChangeUnit('TON')}
                className={`px-2.5 py-1.5 ${unit === 'TON' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
              >
                TON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Cutoff Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Curva Comparativa de Evolução de Safra ({metricMode === 'PERCENT' ? '%' : unitLabel})
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Cores distintas por safra ({pacing.crops.length} safra(s) exibida(s)).
          </p>

          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pacing.chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={30} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  domain={metricMode === 'PERCENT' ? [0, 100] : ['auto', 'auto']}
                  tickFormatter={(val) =>
                    metricMode === 'PERCENT'
                      ? `${Number(val).toFixed(0)}%`
                      : val >= 1000
                      ? `${(val / 1000).toFixed(0)}k`
                      : String(val)
                  }
                />
                <Tooltip
                  formatter={(value: number) =>
                    metricMode === 'PERCENT'
                      ? `${value.toFixed(1)}% do registrado`
                      : `${value.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} ${unitLabel}`
                  }
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return `${label} (${payload[0].payload.periodLabel})`;
                    }
                    return label;
                  }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {pacing.crops.map((crop) => (
                  <Line
                    key={crop}
                    type="monotone"
                    dataKey={crop}
                    name={`Safra ${crop}`}
                    stroke={pacing.cropStatusMap[crop]?.color || '#059669'}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <h4 className="text-sm font-bold text-slate-900">
            Comparativo na Data Equivalente ({formatDateBR(comparisonDate).slice(0, 5)})
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Volume acumulado até o dia/mês equivalente no ciclo de cada safra.
          </p>

          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1 tabular-nums">
            {pacing.cutoffMetrics.map((m) => (
              <div key={m.crop} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="text-xs font-bold text-slate-900">Safra {m.crop}</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    {m.isOngoing ? 'Em andamento' : 'Encerrada'}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-base font-bold text-slate-900">
                    {m.volumeAtCutoff.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}{' '}
                    {unitLabel}
                  </span>
                  {m.vsPrevPct !== null && m.prevCrop && (
                    <span
                      className={`text-xs font-semibold inline-flex items-center ${
                        m.vsPrevPct >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {m.vsPrevPct >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {m.vsPrevPct.toFixed(1)}% vs {m.prevCrop}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-1">
                  {m.pctOfRecordedTotal.toFixed(1)}% do volume registrado ({m.totalCropVolume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })} {unitLabel})
                </p>
              </div>
            ))}
            {pacing.cutoffMetrics.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">
                Nenhum contrato encontrado para os filtros selecionados.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
