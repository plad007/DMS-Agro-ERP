import * as XLSX from 'xlsx';
import {
  CommissionAnalyticsResult,
  CommissionMatrixData,
  ProducerIntelligenceResult,
  VolumeAnalyticsResult,
  VolumeMatrixResult,
  VolumeUnit,
  formatDateBR,
  formatMonthLabel
} from './reportsAnalytics';
import {
  LogisticsAnalyticsSummary,
  LogisticsContractRow,
  LogisticsMatrixResult,
  ProducerLogisticsExternalView
} from './logisticsScheduleAnalytics';

export interface ExportSheetData {
  sheetName: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

const sanitizeFilename = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

const formatCsvCell = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    return val.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 4 });
  }
  const str = String(val);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const downloadCsvFile = (
  filenameBase: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  metadataLines: string[] = []
): void => {
  const lines: string[] = [];
  metadataLines.forEach((m) => lines.push(formatCsvCell(m)));
  if (metadataLines.length > 0) lines.push('');
  lines.push(headers.map(formatCsvCell).join(';'));
  for (const row of rows) {
    lines.push(row.map(formatCsvCell).join(';'));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(filenameBase)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadXlsxWorkbook = (
  filenameBase: string,
  sheets: ExportSheetData[],
  metadataRows: Array<Array<string | number>> = []
): void => {
  const workbook = XLSX.utils.book_new();

  if (metadataRows.length > 0) {
    const metaSheet = XLSX.utils.aoa_to_sheet(metadataRows);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Filtros_Aplicados');
  }

  sheets.forEach((sheet, idx) => {
    const safeName = (sheet.sheetName || `Dados_${idx + 1}`)
      .replace(/[\\/?*[\]:]/g, '')
      .slice(0, 31);
    const aoa = [sheet.headers, ...sheet.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  });

  XLSX.writeFile(workbook, `${sanitizeFilename(filenameBase)}.xlsx`);
};

// --- SPECIFIC EXPORT BUILDERS ---

export const buildCommissionExportSheets = (
  analytics: CommissionAnalyticsResult,
  matrix: CommissionMatrixData,
  mode: 'SYNTHETIC' | 'ANALYTICAL' | 'MATRIX' | 'ALL',
  selectedAnalyticalColumns?: Record<string, boolean>
): ExportSheetData[] => {
  const sheets: ExportSheetData[] = [];

  if (mode === 'SYNTHETIC' || mode === 'ALL') {
    sheets.push({
      sheetName: 'Resumo_Mensal',
      headers: [
        'Mês/Ano',
        'Previsto Confirmado (R$)',
        'Previsto Estimado (R$)',
        'Total Previsto (R$)',
        'Volume Base (scs)'
      ],
      rows: analytics.monthlySeries.map((m) => [
        m.label,
        Number(m.confirmedBRL.toFixed(2)),
        Number(m.estimatedBRL.toFixed(2)),
        Number(m.totalBRL.toFixed(2)),
        Number(m.volumeBags.toFixed(2))
      ])
    });

    sheets.push({
      sheetName: 'Resumo_Produtores',
      headers: [
        'Produtor',
        'CPF/CNPJ',
        'Contratos',
        'Volume (scs)',
        'Comissão Contratada (R$)',
        'Prevista Confirmada (R$)',
        'Prevista Estimada (R$)',
        'Sem Vencimento (R$)'
      ],
      rows: analytics.summaryByProducer.map((p) => [
        p.name,
        p.doc || '-',
        p.contractsCount,
        Number(p.totalBags.toFixed(2)),
        Number(p.totalBRL.toFixed(2)),
        Number(p.confirmedBRL.toFixed(2)),
        Number(p.estimatedBRL.toFixed(2)),
        Number(p.undefinedBRL.toFixed(2))
      ])
    });
  }

  if (mode === 'MATRIX' || mode === 'ALL') {
    const headers = [
      'Produtor / Agrupamento',
      ...matrix.monthKeys.map((mk) => `${formatMonthLabel(mk)} (R$)`),
      'Total Previsto (R$)',
      'Sem Vencimento (R$)'
    ];
    const rows = [
      ...matrix.rows.map((r) => [
        r.label,
        ...matrix.monthKeys.map((mk) => Number((r.cells[mk]?.amount || 0).toFixed(2))),
        Number(r.totalBRL.toFixed(2)),
        Number(r.undefinedBRL.toFixed(2))
      ]),
      [
        'TOTAL GERAL (R$)',
        ...matrix.monthKeys.map((mk) => Number((matrix.colTotalsBRL[mk] || 0).toFixed(2))),
        Number(matrix.grandTotalBRL.toFixed(2)),
        Number(matrix.grandUndefinedBRL.toFixed(2))
      ]
    ];
    sheets.push({ sheetName: 'Matriz_Comissoes', headers, rows });
  }

  if (mode === 'ANALYTICAL' || mode === 'ALL') {
    const colDefs: Array<{ key: string; header: string; get: (r: CommissionAnalyticsResult['rows'][number]) => string | number }> = [
      { key: 'contractNumber', header: 'Contrato', get: (r) => r.contractNumber },
      { key: 'producerName', header: 'Produtor/Vendedor', get: (r) => r.producerName },
      { key: 'farmName', header: 'Fazenda', get: (r) => r.farmName },
      { key: 'product', header: 'Produto', get: (r) => r.product },
      { key: 'crop', header: 'Safra', get: (r) => r.crop },
      { key: 'closingDate', header: 'Fechamento', get: (r) => formatDateBR(r.closingDate) },
      { key: 'totalBags', header: 'Vol. Contratado (scs)', get: (r) => Number(r.totalBags.toFixed(2)) },
      { key: 'shippedBags', header: 'Vol. Embarcado (scs)', get: (r) => Number(r.shippedBags.toFixed(2)) },
      { key: 'commissionPerBag', header: 'Comissão Unitária (R$/sc)', get: (r) => Number(r.commissionPerBag.toFixed(2)) },
      { key: 'contractedCommission', header: 'Comissão Contratada (R$)', get: (r) => Number(r.contractedCommission.toFixed(2)) },
      { key: 'shippedCommission', header: 'Comissão Prop. Embarque (R$)', get: (r) => Number(r.shippedCommission.toFixed(2)) },
      { key: 'contractCurrency', header: 'Moeda Mercadoria', get: (r) => r.contractCurrency },
      { key: 'dueDate', header: 'Previsão Recebimento', get: (r) => (r.dueDate ? formatDateBR(r.dueDate) : 'Sem vencimento') },
      { key: 'effectiveReceiptDate', header: 'Data Efetiva Receb.', get: () => 'Não controlado' },
      { key: 'receivedAmount', header: 'Valor Recebido', get: () => 'Não controlado' },
      { key: 'receivableBalance', header: 'Saldo a Receber', get: () => 'Não controlado' },
      { key: 'financialStatus', header: 'Status Financeiro', get: (r) => r.financialStatusLabel },
      { key: 'observation', header: 'Observações', get: (r) => r.observation || '' }
    ];

    const activeCols = selectedAnalyticalColumns
      ? colDefs.filter((c) => selectedAnalyticalColumns[c.key] !== false)
      : colDefs;

    sheets.push({
      sheetName: 'Analitico_Comissoes',
      headers: activeCols.map((c) => c.header),
      rows: analytics.rows.map((r) => activeCols.map((c) => c.get(r)))
    });
  }

  return sheets;
};

export const buildVolumeExportSheets = (
  analytics: VolumeAnalyticsResult,
  matrix: VolumeMatrixResult,
  unit: VolumeUnit,
  mode: 'SYNTHETIC' | 'MATRIX' | 'ALL'
): ExportSheetData[] => {
  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const sheets: ExportSheetData[] = [];

  if (mode === 'SYNTHETIC' || mode === 'ALL') {
    sheets.push({
      sheetName: 'Ranking_Produtores',
      headers: [
        'Produtor',
        'CPF/CNPJ',
        'Contratos',
        `Comercializado (${unitLabel})`,
        `Embarcado Registrado (${unitLabel})`,
        `Pendente Conhecido (${unitLabel})`,
        'Participação (%)'
      ],
      rows: analytics.producerRanking.map((p) => [
        p.name,
        p.doc || '-',
        p.contractsCount,
        Number(p.contracted.toFixed(2)),
        Number(p.shipped.toFixed(2)),
        Number(p.pending.toFixed(2)),
        Number(p.sharePct.toFixed(2))
      ])
    });

    sheets.push({
      sheetName: 'Evolucao_Mensal',
      headers: [
        'Mês/Ano',
        `Comercializado (${unitLabel})`,
        `Embarcado (${unitLabel})`,
        `Acumulado Comercializado (${unitLabel})`,
        `Acumulado Embarcado (${unitLabel})`
      ],
      rows: analytics.monthlySeries.map((m) => [
        m.label,
        Number(m.contracted.toFixed(2)),
        Number(m.shipped.toFixed(2)),
        Number(m.cumulativeContracted.toFixed(2)),
        Number(m.cumulativeShipped.toFixed(2))
      ])
    });
  }

  if (mode === 'MATRIX' || mode === 'ALL') {
    sheets.push({
      sheetName: 'Matriz_Volumes',
      headers: [
        'Dimensão',
        ...matrix.colKeys.map((ck) => matrix.colLabels[ck] || ck),
        `Total (${unitLabel})`,
        'Participação (%)'
      ],
      rows: [
        ...matrix.rows.map((r) => [
          r.label,
          ...matrix.colKeys.map((ck) => Number((r.cells[ck]?.value || 0).toFixed(2))),
          Number(r.total.toFixed(2)),
          Number(r.sharePct.toFixed(2))
        ]),
        [
          'TOTAL GERAL',
          ...matrix.colKeys.map((ck) => Number((matrix.colTotals[ck] || 0).toFixed(2))),
          Number(matrix.grandTotal.toFixed(2)),
          100
        ]
      ]
    });
  }

  return sheets;
};

// STRICT ISOLATION: External Producer Export NEVER includes commissions, internal rankings, bank accounts, or other producers!
export interface ExternalProducerSections {
  executiveSummary: boolean;
  cropComparison: boolean;
  monthlyStrategy: boolean;
  byProduct: boolean;
  byFarm: boolean;
  analyticalContracts: boolean;
  charts: boolean;
}

export const buildExternalProducerExportSheets = (
  intel: ProducerIntelligenceResult,
  unit: VolumeUnit,
  sections: ExternalProducerSections
): ExportSheetData[] => {
  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const currencyLabel = intel.currency === 'USD' ? 'US$' : 'R$';
  const sheets: ExportSheetData[] = [];

  if (sections.executiveSummary) {
    sheets.push({
      sheetName: 'Resumo_Executivo',
      headers: ['Indicador', 'Valor'],
      rows: [
        [`Volume Total Negociado (${unitLabel})`, Number(intel.totalVolume.toFixed(2))],
        ['Negócios Realizados', intel.dealsCount],
        [`Volume Preço Fixado (${unitLabel})`, Number(intel.fixedVolume.toFixed(2))],
        [`Volume A Fixar (${unitLabel})`, Number(intel.toFixVolume.toFixed(2))],
        [
          'Cobertura de Preço Fixado (%)',
          Number(intel.priceCoveragePct.toFixed(2))
        ],
        [
          `Preço Médio Ponderado (${intel.canComputeSingleAverage ? `${currencyLabel}/sc` : 'Múltiplas culturas/moedas'})`,
          intel.weightedAvgPrice !== null ? Number(intel.weightedAvgPrice.toFixed(2)) : 'Separado por cultura/moeda'
        ],
        [
          `Valor Bruto Comercializado (${intel.currency || 'Múltiplas moedas'})`,
          intel.currency ? Number(intel.grossNegotiatedValue.toFixed(2)) : 'Separado por moeda'
        ]
      ]
    });
  }

  if (sections.cropComparison) {
    sheets.push({
      sheetName: 'Comparativo_Safras',
      headers: [
        'Safra',
        `Volume (${unitLabel})`,
        'Negócios',
        `Preço Médio Ponderado (${currencyLabel}/sc)`,
        'Maior Preço',
        'Menor Preço',
        'Valor Bruto Comercializado',
        'Evolução Volume (%)'
      ],
      rows: intel.cropComparison.map((c) => [
        c.crop,
        Number(c.volume.toFixed(2)),
        c.dealsCount,
        c.weightedAvgPrice !== null ? Number(c.weightedAvgPrice.toFixed(2)) : '-',
        c.maxPrice !== null ? Number(c.maxPrice.toFixed(2)) : '-',
        c.minPrice !== null ? Number(c.minPrice.toFixed(2)) : '-',
        intel.distinctCurrencies.length <= 1 ? Number(c.grossNegotiatedValue.toFixed(2)) : '-',
        c.volumeEvolutionPct !== null ? Number(c.volumeEvolutionPct.toFixed(1)) : '-'
      ])
    });
  }

  if (sections.monthlyStrategy) {
    sheets.push({
      sheetName: 'Estrategia_Mensal',
      headers: [
        'Mês',
        `Volume (${unitLabel})`,
        'Negócios',
        'Preço Médio Ponderado',
        'Maior Preço',
        'Menor Preço',
        'Participação (%)',
        `Acumulado (${unitLabel})`
      ],
      rows: intel.monthlyStrategy.map((m) => [
        m.label,
        Number(m.volume.toFixed(2)),
        m.dealsCount,
        m.weightedAvgPrice !== null ? Number(m.weightedAvgPrice.toFixed(2)) : '-',
        m.maxPrice !== null ? Number(m.maxPrice.toFixed(2)) : '-',
        m.minPrice !== null ? Number(m.minPrice.toFixed(2)) : '-',
        Number(m.sharePct.toFixed(2)),
        Number(m.cumulativeVolume.toFixed(2))
      ])
    });
  }

  if (sections.byProduct) {
    sheets.push({
      sheetName: 'Analise_Culturas',
      headers: ['Cultura (Moeda)', `Volume (${unitLabel})`, 'Negócios', 'Preço Médio Ponderado (/sc)', 'Valor Bruto', 'Participação (%)'],
      rows: intel.byProduct.map((p) => [
        p.label,
        Number(p.volume.toFixed(2)),
        p.dealsCount,
        p.weightedAvgPrice !== null ? Number(p.weightedAvgPrice.toFixed(2)) : '-',
        Number(p.grossNegotiatedValue.toFixed(2)),
        Number(p.sharePct.toFixed(2))
      ])
    });
  }

  if (sections.byFarm) {
    sheets.push({
      sheetName: 'Analise_Fazendas',
      headers: ['Fazenda', 'Cultura', `Volume (${unitLabel})`, 'Negócios', 'Preço Médio Ponderado (/sc)', 'Participação (%)'],
      rows: intel.byFarmAndProduct.map((f) => [
        f.label,
        f.product || '-',
        Number(f.volume.toFixed(2)),
        f.dealsCount,
        f.weightedAvgPrice !== null ? Number(f.weightedAvgPrice.toFixed(2)) : '-',
        Number(f.sharePct.toFixed(2))
      ])
    });
  }

  if (sections.analyticalContracts) {
    sheets.push({
      sheetName: 'Relacao_Contratos',
      headers: [
        'Contrato',
        'Data Fechamento',
        'Produto',
        'Safra',
        'Fazenda',
        'Comprador',
        `Volume (${unitLabel})`,
        'Moeda',
        'Preço Unitário (/sc)',
        'Condição Preço',
        'Valor Bruto',
        'Status'
      ],
      rows: intel.contracts.map((c) => [
        c.number,
        formatDateBR(c.closingDate),
        c.product,
        c.crop,
        c.farmName,
        c.buyerName,
        Number(c.volume.toFixed(2)),
        c.currency,
        c.priceStatus === 'FIXED_VALID' ? Number(c.finalPrice.toFixed(2)) : c.priceStatus === 'TO_FIX_INDICATIVE' ? `${c.finalPrice.toFixed(2)} (Indic.)` : '-',
        c.priceStatus === 'FIXED_VALID' ? 'Fixado' : c.priceStatus === 'TO_FIX_INDICATIVE' ? 'A Fixar (Indicativo)' : 'A Fixar',
        c.priceStatus === 'FIXED_VALID' ? Number(c.grossValue.toFixed(2)) : '-',
        c.status
      ])
    });
  }

  return sheets;
};

// --- LOGISTICS SCHEDULING EXPORTS (INTERNAL & STRICT PRODUCER ISOLATION) ---

export interface ExternalLogisticsSections {
  executiveSummary: boolean;
  horizons: boolean;
  scheduleTable: boolean;
  byProductCrop: boolean;
  byFarm: boolean;
  ganttSummary: boolean;
  analyticalContracts: boolean;
  charts: boolean;
}

export const DEFAULT_EXTERNAL_LOGISTICS_SECTIONS: ExternalLogisticsSections = {
  executiveSummary: true,
  horizons: true,
  scheduleTable: true,
  byProductCrop: true,
  byFarm: true,
  ganttSummary: true,
  analyticalContracts: true,
  charts: true
};

export const buildLogisticsInternalExportSheets = (params: {
  summary: LogisticsAnalyticsSummary;
  matrix: LogisticsMatrixResult;
  analyticalRows: LogisticsContractRow[];
  unit: VolumeUnit;
  mode: 'SYNTHETIC' | 'ANALYTICAL' | 'TRACKING' | 'ALL';
  selectedColumns?: Record<string, boolean>;
}): ExportSheetData[] => {
  const { summary, matrix, analyticalRows, unit, mode, selectedColumns } = params;
  const unitLabel = unit === 'TON' ? 'ton' : 'scs';
  const sheets: ExportSheetData[] = [];

  if (mode === 'SYNTHETIC' || mode === 'ALL') {
    sheets.push({
      sheetName: 'Matriz_Programacao',
      headers: [
        'Agrupamento',
        ...matrix.columns.map((c) => c.label),
        `Com Janela Definida (${unitLabel})`,
        `Janelas Abertas (${unitLabel})`,
        `Total (${unitLabel})`,
        'Part. (%)'
      ],
      rows: [
        ...matrix.rows.map((r) => [
          r.label,
          ...matrix.columns.map((c) => Number((r.cells[c.key]?.value || 0).toFixed(2))),
          Number(r.definedTotal.toFixed(2)),
          Number(r.openWindowTotal.toFixed(2)),
          Number(r.total.toFixed(2)),
          Number(r.sharePct.toFixed(2))
        ]),
        [
          matrix.isSimulated ? 'TOTAL GERAL (SIMULADO)' : 'TOTAL GERAL',
          ...matrix.columns.map((c) => Number((matrix.colTotals[c.key] || 0).toFixed(2))),
          Number(matrix.grandDefinedTotal.toFixed(2)),
          Number(matrix.grandOpenWindowTotal.toFixed(2)),
          Number(matrix.grandTotal.toFixed(2)),
          100
        ]
      ]
    });

    sheets.push({
      sheetName: 'Horizontes_Futuros',
      headers: [
        'Horizonte (Acumulado)',
        'Data Limite',
        'Contratos',
        `Quinzena/Janela Definida (${unitLabel})`,
        `Janelas Coincidentes (${unitLabel})`,
        `Total Saldo Coincidente (${unitLabel})`,
        `FOB (${unitLabel})`,
        `CIF (${unitLabel})`
      ],
      rows: summary.horizons.map((h) => [
        `Próximos ${h.days} dias`,
        formatDateBR(h.horizonEndDate),
        h.contractsCount,
        Number(h.definedVolume.toFixed(2)),
        Number(h.coincidentVolume.toFixed(2)),
        Number(h.totalOverlappingVolume.toFixed(2)),
        Number(h.fobVolume.toFixed(2)),
        Number(h.cifVolume.toFixed(2))
      ])
    });
  }

  if (mode === 'ANALYTICAL' || mode === 'ALL') {
    const colDefs: Array<{
      key: string;
      header: string;
      get: (r: LogisticsContractRow) => string | number;
    }> = [
      { key: 'contractNumber', header: 'Contrato', get: (r) => r.contractNumber },
      { key: 'producerName', header: 'Produtor', get: (r) => r.producerName },
      { key: 'farmName', header: 'Fazenda', get: (r) => r.farmName },
      { key: 'product', header: 'Produto', get: (r) => r.product },
      { key: 'crop', header: 'Safra', get: (r) => r.crop },
      { key: 'buyerName', header: 'Destino Comercial (Comprador)', get: (r) => r.buyerName },
      { key: 'closingDate', header: 'Fechamento', get: (r) => formatDateBR(r.closingDate) },
      { key: 'freightType', header: 'Frete', get: (r) => r.freightType },
      { key: 'pickupLocation', header: 'Local de Embarque', get: (r) => r.pickupLocation },
      { key: 'startDate', header: 'Início Contratado', get: (r) => formatDateBR(r.window.startIso) },
      { key: 'endDate', header: 'Fim Contratado', get: (r) => formatDateBR(r.window.endIso) },
      { key: 'periodLabel', header: 'Período Formatado', get: (r) => r.window.periodLabel },
      { key: 'contractedVolume', header: `Vol. Contratado (${unitLabel})`, get: (r) => Number(r.contractedVolume.toFixed(2)) },
      { key: 'deliveredVolume', header: `Vol. Entregue Reg. (${unitLabel})`, get: (r) => Number(r.deliveredVolume.toFixed(2)) },
      { key: 'balanceVolume', header: `Saldo Pendente (${unitLabel})`, get: (r) => Number(r.balanceVolume.toFixed(2)) },
      { key: 'deliveredPct', header: '% Entregue', get: (r) => Number(r.deliveredPct.toFixed(1)) },
      { key: 'logisticsStatus', header: 'Situação Entrega', get: (r) => r.logisticsStatusLabel }
    ];

    const activeCols = selectedColumns
      ? colDefs.filter((c) => selectedColumns[c.key] !== false)
      : colDefs;

    sheets.push({
      sheetName: 'Analitico_Programacao',
      headers: activeCols.map((c) => c.header),
      rows: analyticalRows.map((r) => activeCols.map((c) => c.get(r)))
    });
  }

  if (mode === 'TRACKING' || mode === 'ALL') {
    sheets.push({
      sheetName: 'Embarques_Realizados',
      headers: [
        'Mês Embarque (delivery_date)',
        `Volume Embarcado (${unitLabel})`,
        'Qtd. Romaneios',
        'Contratos Atendidos'
      ],
      rows: summary.shipmentTimeline.map((s) => [
        s.label,
        Number(s.deliveredVolume.toFixed(2)),
        s.shipmentsCount,
        s.contractsCount
      ])
    });

    sheets.push({
      sheetName: 'Concentracao_Locais',
      headers: [
        'Local de Embarque',
        'Contratos',
        `Contratado (${unitLabel})`,
        `Entregue (${unitLabel})`,
        `Saldo (${unitLabel})`,
        `FOB (${unitLabel})`,
        `CIF (${unitLabel})`
      ],
      rows: summary.byPickupLocation.map((p) => [
        p.label,
        p.contractsCount,
        Number(p.contractedVolume.toFixed(2)),
        Number(p.deliveredVolume.toFixed(2)),
        Number(p.balanceVolume.toFixed(2)),
        Number(p.fobVolume.toFixed(2)),
        Number(p.cifVolume.toFixed(2))
      ])
    });
  }

  return sheets;
};

// STRICT PRODUCER ISOLATION: NEVER includes other producers, commissions, margins, bank accounts, or public links
export const buildLogisticsExternalExportSheets = (params: {
  producerView: ProducerLogisticsExternalView;
  sections: ExternalLogisticsSections;
  selectedAnalyticalColumns?: Record<string, boolean>;
}): ExportSheetData[] => {
  const { producerView, sections, selectedAnalyticalColumns } = params;
  const unitLabel = producerView.unit === 'TON' ? 'ton' : 'scs';
  const sheets: ExportSheetData[] = [];

  if (sections.executiveSummary) {
    sheets.push({
      sheetName: 'Resumo_Logistico',
      headers: ['Indicador', 'Valor'],
      rows: [
        ['Produtor / Grupo', producerView.targetTitle],
        ['Data de Referência', formatDateBR(producerView.referenceDate)],
        ['Contratos no Escopo', producerView.contractsCount],
        [`Volume Contratado (${unitLabel})`, Number(producerView.totalContracted.toFixed(2))],
        [`Volume Entregue Registrado (${unitLabel})`, Number(producerView.totalDelivered.toFixed(2))],
        [`Saldo Conhecido a Entregar (${unitLabel})`, Number(producerView.totalBalance.toFixed(2))],
        ['Percentual Entregue (%)', Number(producerView.deliveredPct.toFixed(1))],
        [`Modalidade FOB (${unitLabel})`, Number(producerView.fobContracted.toFixed(2))],
        [`Modalidade CIF (${unitLabel})`, Number(producerView.cifContracted.toFixed(2))]
      ]
    });
  }

  if (sections.horizons) {
    sheets.push({
      sheetName: 'Horizontes_Entrega',
      headers: [
        'Horizonte (Acumulado)',
        'Até',
        'Contratos',
        `Janela Específica (${unitLabel})`,
        `Janelas Coincidentes (${unitLabel})`,
        `Saldo Total Coincidente (${unitLabel})`
      ],
      rows: producerView.horizons.map((h) => [
        `Próximos ${h.days} dias`,
        formatDateBR(h.horizonEndDate),
        h.contractsCount,
        Number(h.definedVolume.toFixed(2)),
        Number(h.coincidentVolume.toFixed(2)),
        Number(h.totalOverlappingVolume.toFixed(2))
      ])
    });
  }

  if (sections.scheduleTable) {
    sheets.push({
      sheetName: 'Programacao_Periodos',
      headers: [
        'Período / Quinzena Contratada',
        'Datas Reais',
        'Tipo Janela',
        'Contratos',
        `Contratado (${unitLabel})`,
        `Entregue Reg. (${unitLabel})`,
        `Saldo (${unitLabel})`,
        `FOB (${unitLabel})`,
        `CIF (${unitLabel})`
      ],
      rows: producerView.scheduleRows.map((s) => [
        s.periodLabel,
        s.exactDatesLabel,
        s.isExactSchedule ? 'Período definido' : 'Janela aberta',
        s.contractsCount,
        Number(s.contractedVolume.toFixed(2)),
        Number(s.deliveredVolume.toFixed(2)),
        Number(s.balanceVolume.toFixed(2)),
        Number(s.fobVolume.toFixed(2)),
        Number(s.cifVolume.toFixed(2))
      ])
    });
  }

  if (sections.byProductCrop) {
    sheets.push({
      sheetName: 'Volumes_Cultura_Safra',
      headers: [
        'Produto',
        'Safra',
        'Contratos',
        `Contratado (${unitLabel})`,
        `Entregue Reg. (${unitLabel})`,
        `Saldo (${unitLabel})`
      ],
      rows: producerView.byProductAndCrop.map((p) => [
        p.product,
        p.crop,
        p.contractsCount,
        Number(p.contractedVolume.toFixed(2)),
        Number(p.deliveredVolume.toFixed(2)),
        Number(p.balanceVolume.toFixed(2))
      ])
    });
  }

  if (sections.byFarm) {
    sheets.push({
      sheetName: 'Volumes_Fazenda_Local',
      headers: [
        'Fazenda',
        'Local de Embarque',
        'Contratos',
        `Contratado (${unitLabel})`,
        `Entregue Reg. (${unitLabel})`,
        `Saldo (${unitLabel})`
      ],
      rows: producerView.byFarm.map((f) => [
        f.farmName,
        f.pickupLocation,
        f.contractsCount,
        Number(f.contractedVolume.toFixed(2)),
        Number(f.deliveredVolume.toFixed(2)),
        Number(f.balanceVolume.toFixed(2))
      ])
    });
  }

  if (sections.analyticalContracts) {
    const colDefs: Array<{
      key: string;
      header: string;
      get: (c: ProducerLogisticsExternalView['contracts'][number]) => string | number;
    }> = [
      { key: 'contractNumber', header: 'Contrato', get: (c) => c.contractNumber },
      { key: 'product', header: 'Produto', get: (c) => c.product },
      { key: 'crop', header: 'Safra', get: (c) => c.crop },
      { key: 'farmName', header: 'Fazenda', get: (c) => c.farmName },
      { key: 'pickupLocation', header: 'Local de Embarque', get: (c) => c.pickupLocation },
      { key: 'freightType', header: 'Frete', get: (c) => c.freightType },
      { key: 'buyerName', header: 'Comprador / Destino', get: (c) => c.buyerName },
      { key: 'periodLabel', header: 'Período Contratado', get: (c) => c.periodLabel },
      { key: 'exactDatesLabel', header: 'Datas Reais', get: (c) => c.exactDatesLabel },
      { key: 'contractedVolume', header: `Contratado (${unitLabel})`, get: (c) => Number(c.contractedVolume.toFixed(2)) },
      { key: 'deliveredVolume', header: `Entregue Reg. (${unitLabel})`, get: (c) => Number(c.deliveredVolume.toFixed(2)) },
      { key: 'balanceVolume', header: `Saldo (${unitLabel})`, get: (c) => Number(c.balanceVolume.toFixed(2)) },
      { key: 'logisticsStatus', header: 'Situação Entrega', get: (c) => c.logisticsStatusLabel }
    ];

    const activeCols = selectedAnalyticalColumns
      ? colDefs.filter((c) => selectedAnalyticalColumns[c.key] !== false)
      : colDefs;

    sheets.push({
      sheetName: 'Contratos_Entrega',
      headers: activeCols.map((c) => c.header),
      rows: producerView.contracts.map((c) => activeCols.map((col) => col.get(c)))
    });
  }

  return sheets;
};
