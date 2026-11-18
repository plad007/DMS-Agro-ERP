import {
  Contract,
  Shipment,
  Producer,
  EconomicGroup,
  NormalizedContractStatus,
  CurrencyCode,
  ForecastOrigin,
  CommissionFinancialStatus
} from '../types';

export type VolumeUnit = 'SCS' | 'TON';

export interface IsoDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  isoDate: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  quarterKey: string; // YYYY-T1..T4
}

export const MONTH_SHORT_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const CROP_CURVE_COLORS = [
  '#64748b', // Slate
  '#10b981', // Emerald
  '#2563eb', // Blue
  '#d97706', // Amber
  '#dc2626', // Crimson
  '#0891b2', // Cyan
  '#4f46e5', // Indigo
  '#65a30d', // Lime
  '#be123c', // Rose
  '#0f766e', // Teal
  '#b45309', // Burnt Orange
  '#334155'  // Dark Slate
];

export const bagsToUnit = (bags: number, unit: VolumeUnit): number => {
  if (!Number.isFinite(bags)) return 0;
  return unit === 'TON' ? (bags * 60) / 1000 : bags;
};

export const normalizeText = (value?: string | null): string =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

export const normalizeDigits = (value?: string | null): string => (value || '').replace(/\D/g, '');

export const normalizeContractStatus = (status?: string | null): NormalizedContractStatus => {
  const clean = (status || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean === 'ASSINADO') return 'Assinado';
  if (clean === 'RASCUNHO') return 'Rascunho';
  if (clean === 'AGUARDANDO ASSINATURA') return 'Aguardando Assinatura';
  if (clean === 'CONCLUIDO') return 'Concluído';
  if (clean === 'CANCELADO') return 'Cancelado';
  return 'Outro';
};

export const parseIsoDateParts = (dateStr?: string | null): IsoDateParts | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const quarter = Math.ceil(month / 3);
      return {
        year,
        month,
        day,
        isoDate: `${year}-${mm}-${dd}`,
        monthKey: `${year}-${mm}`,
        quarterKey: `${year}-T${quarter}`
      };
    }
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const quarter = Math.ceil(month / 3);
  return {
    year,
    month,
    day,
    isoDate: `${year}-${mm}-${dd}`,
    monthKey: `${year}-${mm}`,
    quarterKey: `${year}-T${quarter}`
  };
};

export const addDaysIso = (dateStr: string, daysToAdd: number): string | null => {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return null;
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd));
  if (isNaN(dt.getTime())) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatDateBR = (dateStr?: string | null): string => {
  const parts = parseIsoDateParts(dateStr);
  if (!parts) return '-';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
};

export const formatMonthLabel = (monthKey: string): string => {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const yearShort = match[1].slice(-2);
  const monthIdx = Number(match[2]) - 1;
  return `${MONTH_SHORT_PT[monthIdx] || match[2]}/${yearShort}`;
};

export const getTodayIsoLocal = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getCropYearNumber = (crop?: string | null): number => {
  const clean = (crop || '').trim();
  if (!clean) return new Date().getFullYear();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    const last = parts[parts.length - 1].replace(/\D/g, '');
    if (last.length === 2) return 2000 + Number(last);
    if (last.length === 4) return Number(last);
  }
  const match = clean.match(/\d{4}/);
  if (match) return Number(match[0]);
  const shortMatch = clean.match(/\d{2}/);
  return shortMatch ? 2000 + Number(shortMatch[0]) : new Date().getFullYear();
};

// --- PRODUCER RESOLUTION (ETAPA 1.3) ---

export type ProducerMatchMethod = 'ID' | 'DOC' | 'NAME' | 'UNMATCHED' | 'CONFLICT';

export interface ResolvedProducerInfo {
  producerKey: string;
  displayName: string;
  doc: string;
  producerId?: string;
  matchMethod: ProducerMatchMethod;
  conflictReason?: string;
  matchedProducer?: Producer;
}

export interface ProducerResolutionIndex {
  byId: Map<string, Producer>;
  byDoc: Map<string, Producer[]>;
  byName: Map<string, Producer[]>;
}

export const buildProducerResolutionIndex = (producers: Producer[]): ProducerResolutionIndex => {
  const byId = new Map<string, Producer>();
  const byDoc = new Map<string, Producer[]>();
  const byName = new Map<string, Producer[]>();

  for (const p of producers) {
    if (p.id) byId.set(p.id, p);
    const docDigits = normalizeDigits(p.doc);
    if (docDigits.length >= 11) {
      const list = byDoc.get(docDigits) || [];
      list.push(p);
      byDoc.set(docDigits, list);
    }
    const normName = normalizeText(p.name);
    if (normName) {
      const list = byName.get(normName) || [];
      list.push(p);
      byName.set(normName, list);
    }
  }

  return { byId, byDoc, byName };
};

export const resolveContractProducer = (
  contract: Contract,
  index: ProducerResolutionIndex
): ResolvedProducerInfo => {
  const contractDoc = normalizeDigits(contract.sellerDoc);
  const contractNameNorm = normalizeText(contract.sellerName);
  const rawName = (contract.sellerName || '').trim() || 'Produtor não identificado';

  // 1. Prefer seller_id
  if (contract.sellerId) {
    const byId = index.byId.get(contract.sellerId);
    if (byId) {
      const prodDoc = normalizeDigits(byId.doc);
      if (contractDoc && prodDoc && contractDoc !== prodDoc) {
        return {
          producerKey: `conflict:${contract.id}`,
          displayName: rawName,
          doc: contract.sellerDoc || '',
          matchMethod: 'CONFLICT',
          conflictReason: `seller_id aponta para "${byId.name}" (${byId.doc}), mas contrato informa CPF/CNPJ ${contract.sellerDoc}.`
        };
      }
      return {
        producerKey: byId.id,
        displayName: byId.name,
        doc: byId.doc || contract.sellerDoc || '',
        producerId: byId.id,
        matchMethod: 'ID',
        matchedProducer: byId
      };
    }
  }

  // 2. Normalized document (only when unique)
  if (contractDoc.length >= 11) {
    const docMatches = index.byDoc.get(contractDoc) || [];
    if (docMatches.length === 1) {
      const matched = docMatches[0];
      return {
        producerKey: matched.id,
        displayName: matched.name,
        doc: matched.doc || contract.sellerDoc || '',
        producerId: matched.id,
        matchMethod: 'DOC',
        matchedProducer: matched
      };
    }
    if (docMatches.length > 1) {
      return {
        producerKey: `conflict-doc:${contractDoc}`,
        displayName: rawName,
        doc: contract.sellerDoc || '',
        matchMethod: 'CONFLICT',
        conflictReason: `Existem ${docMatches.length} cadastros de produtores com o mesmo CPF/CNPJ (${contract.sellerDoc}).`
      };
    }
  }

  // 3. Unique normalized name (only if no conflicting document)
  if (contractNameNorm) {
    const nameMatches = index.byName.get(contractNameNorm) || [];
    if (nameMatches.length === 1) {
      const matched = nameMatches[0];
      const prodDoc = normalizeDigits(matched.doc);
      if (contractDoc && prodDoc && contractDoc !== prodDoc) {
        return {
          producerKey: `conflict:${contract.id}`,
          displayName: rawName,
          doc: contract.sellerDoc || '',
          matchMethod: 'CONFLICT',
          conflictReason: `Nome coincide com "${matched.name}", mas CPF/CNPJ diverge (${contract.sellerDoc || '-'} vs ${matched.doc || '-'}).`
        };
      }
      return {
        producerKey: matched.id,
        displayName: matched.name,
        doc: matched.doc || contract.sellerDoc || '',
        producerId: matched.id,
        matchMethod: 'NAME',
        matchedProducer: matched
      };
    }
    if (nameMatches.length > 1) {
      return {
        producerKey: `conflict-name:${contractNameNorm}`,
        displayName: rawName,
        doc: contract.sellerDoc || '',
        matchMethod: 'CONFLICT',
        conflictReason: `Nome "${rawName}" possui ${nameMatches.length} cadastros homônimos sem CPF/CNPJ correspondente.`
      };
    }
  }

  // 4. Unmatched -> stable pending group key (without merging unrelated entities)
  const fallbackKey = contractDoc
    ? `unmatched:doc:${contractDoc}`
    : `unmatched:name:${contractNameNorm || contract.id}`;

  return {
    producerKey: fallbackKey,
    displayName: rawName,
    doc: contract.sellerDoc || '',
    matchMethod: 'UNMATCHED',
    conflictReason: 'Produtor não localizado no cadastro oficial (mantido como pendência de identificação).'
  };
};

export interface ResolvedFarmInfo {
  farmKey: string;
  farmName: string;
  hasExplicitFarm: boolean;
}

export const resolveContractFarmInfo = (
  contract: Contract,
  matchedProducer?: Producer
): ResolvedFarmInfo => {
  if (contract.farmId && matchedProducer?.farms?.length) {
    const found = matchedProducer.farms.find((f) => f.id === contract.farmId);
    if (found && found.name?.trim()) {
      return {
        farmKey: found.id,
        farmName: found.name.trim(),
        hasExplicitFarm: true
      };
    }
  }

  if (contract.farmName && contract.farmName.trim()) {
    return {
      farmKey: contract.farmId || `name:${normalizeText(contract.farmName)}`,
      farmName: contract.farmName.trim(),
      hasExplicitFarm: true
    };
  }

  return {
    farmKey: '__NO_FARM__',
    farmName: 'Fazenda não informada',
    hasExplicitFarm: false
  };
};

// --- SHIPMENTS INDEX & DATA QUALITY AUDIT ---

export interface ContractLogisticsSummary {
  contractId: string;
  shipments: Shipment[];
  shipmentsCount: number;
  shippedBagsFromShipments: number;
  knownShippedBags: number;
  pendingBags: number;
  hasShipmentRows: boolean;
  hasLogisticsDiscrepancy: boolean;
}

export const buildShipmentsIndex = (
  contracts: Contract[],
  shipments: Shipment[]
): Map<string, ContractLogisticsSummary> => {
  const byContract = new Map<string, Shipment[]>();
  for (const s of shipments) {
    const list = byContract.get(s.contractId) || [];
    list.push(s);
    byContract.set(s.contractId, list);
  }

  const summaryMap = new Map<string, ContractLogisticsSummary>();
  for (const c of contracts) {
    const list = byContract.get(c.id) || [];
    const shippedFromRows = list.reduce(
      (sum, s) => sum + (Number(s.bagsCount) || (Number(s.weightKg) || 0) / 60),
      0
    );
    const deliveredField = Number(c.deliveredBags) || 0;
    const knownShipped = list.length > 0 ? shippedFromRows : deliveredField;
    const totalBags = Number(c.totalBags) || 0;
    const pendingBags = Math.max(0, totalBags - knownShipped);
    const hasDiscrepancy =
      list.length > 0 && Math.abs(shippedFromRows - deliveredField) > 1;

    summaryMap.set(c.id, {
      contractId: c.id,
      shipments: list,
      shipmentsCount: list.length,
      shippedBagsFromShipments: shippedFromRows,
      knownShippedBags: knownShipped,
      pendingBags,
      hasShipmentRows: list.length > 0,
      hasLogisticsDiscrepancy: hasDiscrepancy
    });
  }

  return summaryMap;
};

export interface DataQualityIssue {
  id: string;
  severity: 'warning' | 'info';
  category:
    | 'PRODUCER_UNMATCHED'
    | 'PRODUCER_CONFLICT'
    | 'STATUS_FORMAT'
    | 'USD_ZERO_RATE'
    | 'VOLUME_MISMATCH'
    | 'PRICE_OUTLIER'
    | 'ARTIFICIAL_PAYMENT_DATE'
    | 'MISSING_COMMISSION_DUE';
  contractNumber: string;
  contractId: string;
  message: string;
}

export interface EnrichedContract {
  contract: Contract;
  normalizedStatus: NormalizedContractStatus;
  closingParts: IsoDateParts | null;
  shipmentEndParts: IsoDateParts | null;
  producer: ResolvedProducerInfo;
  farm: ResolvedFarmInfo;
  logistics: ContractLogisticsSummary;
}

export const enrichContracts = (
  contracts: Contract[],
  shipments: Shipment[],
  producers: Producer[]
): { enriched: EnrichedContract[]; issues: DataQualityIssue[] } => {
  const producerIndex = buildProducerResolutionIndex(producers);
  const logisticsMap = buildShipmentsIndex(contracts, shipments);
  const issues: DataQualityIssue[] = [];

  const enriched: EnrichedContract[] = contracts.map((contract) => {
    const normalizedStatus = normalizeContractStatus(contract.status);
    const closingParts = parseIsoDateParts(contract.closingDate || contract.createdAt);
    const shipmentEndParts = parseIsoDateParts(contract.shipmentEndDate);
    const producer = resolveContractProducer(contract, producerIndex);
    const farm = resolveContractFarmInfo(contract, producer.matchedProducer);
    const logistics = logisticsMap.get(contract.id)!;

    if (producer.matchMethod === 'UNMATCHED') {
      issues.push({
        id: `unmatched-${contract.id}`,
        severity: 'warning',
        category: 'PRODUCER_UNMATCHED',
        contractNumber: contract.number,
        contractId: contract.id,
        message: `Produtor "${contract.sellerName}" (${contract.sellerDoc || 'sem doc'}) sem correspondência no cadastro.`
      });
    } else if (producer.matchMethod === 'CONFLICT') {
      issues.push({
        id: `conflict-${contract.id}`,
        severity: 'warning',
        category: 'PRODUCER_CONFLICT',
        contractNumber: contract.number,
        contractId: contract.id,
        message: producer.conflictReason || 'Conflito de identificação de produtor.'
      });
    }

    if (contract.currency === 'USD' && (!contract.exchangeRate || Number(contract.exchangeRate) <= 0)) {
      issues.push({
        id: `usd-rate-${contract.id}`,
        severity: 'info',
        category: 'USD_ZERO_RATE',
        contractNumber: contract.number,
        contractId: contract.id,
        message: `Contrato em USD sem taxa de câmbio informada (exchangeRate = ${contract.exchangeRate || 0}).`
      });
    }

    const totalBags = Number(contract.totalBags) || 0;
    const totalTons = Number(contract.totalTons) || 0;
    const expectedTons = (totalBags * 60) / 1000;
    if (totalBags > 0 && totalTons > 0 && Math.abs(expectedTons - totalTons) / totalTons > 0.05) {
      issues.push({
        id: `vol-mismatch-${contract.id}`,
        severity: 'warning',
        category: 'VOLUME_MISMATCH',
        contractNumber: contract.number,
        contractId: contract.id,
        message: `Divergência entre sacas (${totalBags.toLocaleString('pt-BR')}) e toneladas (${totalTons.toLocaleString('pt-BR')}).`
      });
    }

    if (contract.currency === 'USD' && Number(contract.finalPrice) > 200) {
      issues.push({
        id: `price-outlier-${contract.id}`,
        severity: 'warning',
        category: 'PRICE_OUTLIER',
        contractNumber: contract.number,
        contractId: contract.id,
        message: `Preço em USD atípico (${contract.finalPrice}) — verificar se unidade ou casa decimal estão corretas.`
      });
    }

    if (
      (contract.paymentType === 'SOB_RODAS' || contract.paymentType === 'POS_RETIRADA') &&
      contract.paymentDate
    ) {
      issues.push({
        id: `artificial-pay-${contract.id}`,
        severity: 'info',
        category: 'ARTIFICIAL_PAYMENT_DATE',
        contractNumber: contract.number,
        contractId: contract.id,
        message: `Modalidade ${contract.paymentType}: data de pagamento fixa ignorada para vencimento financeiro.`
      });
    }

    return {
      contract,
      normalizedStatus,
      closingParts,
      shipmentEndParts,
      producer,
      farm,
      logistics
    };
  });

  return { enriched, issues };
};

// --- SHARED FILTERING (SECTION 3) ---

export interface ReportFilterState {
  startDate: string;
  endDate: string;
  years: string[];
  months: string[]; // '01'..'12'
  crops: string[];
  products: string[];
  producerKeys: string[];
  farmNames: string[];
  economicGroupId: string; // '' or group id (supports local/session or permanent groups)
  currencies: CurrencyCode[];
  statuses: NormalizedContractStatus[];
  forecastOrigins: ForecastOrigin[];
}

export const DEFAULT_REPORT_FILTERS: ReportFilterState = {
  startDate: '',
  endDate: '',
  years: [],
  months: [],
  crops: [],
  products: [],
  producerKeys: [],
  farmNames: [],
  economicGroupId: '',
  currencies: [],
  statuses: [],
  forecastOrigins: []
};

export const filterEnrichedContracts = (
  items: EnrichedContract[],
  filters: ReportFilterState,
  options?: {
    economicGroups?: EconomicGroup[];
    dateExtractor?: (item: EnrichedContract) => IsoDateParts | null;
  }
): EnrichedContract[] => {
  const activeGroup = filters.economicGroupId
    ? options?.economicGroups?.find((g) => g.id === filters.economicGroupId)
    : undefined;
  const groupProducerSet = activeGroup ? new Set(activeGroup.producerIds) : null;

  return items.filter((item) => {
    const c = item.contract;
    const dateParts = options?.dateExtractor ? options.dateExtractor(item) : item.closingParts;

    if (filters.startDate) {
      if (!dateParts || dateParts.isoDate < filters.startDate) return false;
    }
    if (filters.endDate) {
      if (!dateParts || dateParts.isoDate > filters.endDate) return false;
    }
    if (filters.years.length > 0) {
      if (!dateParts || !filters.years.includes(String(dateParts.year))) return false;
    }
    if (filters.months.length > 0) {
      if (!dateParts || !filters.months.includes(String(dateParts.month).padStart(2, '0'))) return false;
    }
    if (filters.crops.length > 0 && !filters.crops.includes(c.crop)) return false;
    if (filters.products.length > 0 && !filters.products.includes(c.product)) return false;
    if (filters.producerKeys.length > 0 && !filters.producerKeys.includes(item.producer.producerKey)) {
      return false;
    }
    if (groupProducerSet && (!item.producer.producerId || !groupProducerSet.has(item.producer.producerId))) {
      return false;
    }
    if (filters.farmNames.length > 0 && !filters.farmNames.includes(item.farm.farmName)) {
      return false;
    }
    if (filters.currencies.length > 0 && !filters.currencies.includes(c.currency)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(item.normalizedStatus)) return false;

    return true;
  });
};

// --- TAB 1: COMMISSIONS ENGINE (SECTION 5) ---

export interface CommissionForecastSlice {
  monthKey: string; // YYYY-MM or '__UNDEFINED__'
  dueDate: string | null;
  amount: number;
  bags: number;
  origin: ForecastOrigin;
  label: string;
}

export interface CommissionContractRow {
  contractId: string;
  contractNumber: string;
  producerKey: string;
  producerName: string;
  producerDoc: string;
  producerMatchMethod: ProducerMatchMethod;
  farmName: string;
  product: string;
  crop: string;
  closingDate: string;
  status: NormalizedContractStatus;
  paymentType?: string;
  totalBags: number;
  shippedBags: number;
  commissionPerBag: number; // sempre em R$/sc
  contractedCommission: number; // sempre em R$ (totalBags * commissionPerBag)
  shippedCommission: number; // sempre em R$ (shippedBags * commissionPerBag)
  contractCurrency: CurrencyCode; // moeda da negociação da mercadoria (informativo/filtro apenas)
  commissionCurrency: 'BRL'; // comissão é invariavelmente BRL
  dueDate: string | null;
  dueMonthKey: string | null;
  forecastOrigin: ForecastOrigin;
  forecastOriginLabel: string;
  slices: CommissionForecastSlice[];
  effectiveReceiptDate: string | null;
  receivedAmount: number | null;
  receivableBalance: number | null;
  financialStatus: CommissionFinancialStatus;
  financialStatusLabel: string;
  observation: string;
}

export interface CommissionMatrixData {
  rowDimension: 'PRODUCER' | 'GROUP_SELECTION' | 'PRODUCT' | 'CROP';
  monthKeys: string[];
  rows: Array<{
    key: string;
    label: string;
    subLabel?: string;
    cells: Record<string, { amount: number; contractIds: string[] }>;
    totalBRL: number;
    undefinedBRL: number;
    contractIds: string[];
  }>;
  colTotalsBRL: Record<string, number>;
  grandTotalBRL: number;
  grandUndefinedBRL: number;
}

export const resolveCommissionForContract = (
  item: EnrichedContract,
  todayIso: string
): CommissionContractRow => {
  const c = item.contract;
  const totalBags = Number(c.totalBags) || 0;
  const shippedBags = item.logistics.knownShippedBags;
  const commissionPerBag = Number(c.commissionPerBag) || 0;
  // Regra definitiva: Comissão Total = Volume contratado em sacas x Valor unitário em R$ (sem conversão cambial)
  const contractedCommission = totalBags * commissionPerBag;
  const shippedCommission = shippedBags * commissionPerBag;

  let dueDate: string | null = null;
  let forecastOrigin: ForecastOrigin = 'UNDEFINED';
  let forecastOriginLabel = 'Sem vencimento definido';
  const slices: CommissionForecastSlice[] = [];

  if (item.normalizedStatus === 'Cancelado') {
    forecastOrigin = 'UNDEFINED';
    forecastOriginLabel = 'Contrato cancelado';
  } else if (c.paymentType === 'SOB_RODAS' || c.paymentType === 'POS_RETIRADA') {
    // Regra obrigatória (5.6): não utilizar paymentDate artificial salvo na criação do contrato
    if (item.logistics.shipments.length > 0) {
      let shippedAccountedBags = 0;
      for (const s of item.logistics.shipments) {
        const sBags = Number(s.bagsCount) || (Number(s.weightKg) || 0) / 60;
        shippedAccountedBags += sBags;
        const basePay =
          s.paymentDueDate ||
          (c.paymentType === 'SOB_RODAS'
            ? s.deliveryDate
            : c.paymentDays
            ? addDaysIso(s.deliveryDate, c.paymentDays)
            : null);
        const estDue = basePay ? addDaysIso(basePay, 1) : null;
        const parts = parseIsoDateParts(estDue);
        slices.push({
          monthKey: parts ? parts.monthKey : '__UNDEFINED__',
          dueDate: estDue,
          amount: sBags * commissionPerBag,
          bags: sBags,
          origin: estDue ? 'ESTIMATED_BY_SHIPMENT' : 'UNDEFINED',
          label: estDue ? 'Estimada por embarque (a validar)' : 'Embarque sem vencimento'
        });
      }
      const remainingBags = Math.max(0, totalBags - shippedAccountedBags);
      if (remainingBags > 0.01) {
        slices.push({
          monthKey: '__UNDEFINED__',
          dueDate: null,
          amount: remainingBags * commissionPerBag,
          bags: remainingBags,
          origin: 'UNDEFINED',
          label: 'Saldo aguardando embarque'
        });
      }
      const datedSlices = slices.filter((sl) => sl.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
      dueDate = datedSlices.length > 0 ? datedSlices[datedSlices.length - 1].dueDate : null;
      forecastOrigin = datedSlices.length > 0 ? 'ESTIMATED_BY_SHIPMENT' : 'UNDEFINED';
      forecastOriginLabel =
        datedSlices.length > 0
          ? 'Estimada por embarque (depende de validação comercial)'
          : 'Aguardando embarque';
    } else {
      forecastOrigin = 'UNDEFINED';
      forecastOriginLabel = 'Sem vencimento definido (aguarda embarque)';
      slices.push({
        monthKey: '__UNDEFINED__',
        dueDate: null,
        amount: contractedCommission,
        bags: totalBags,
        origin: 'UNDEFINED',
        label: forecastOriginLabel
      });
    }
  } else {
    // DATA_FIXA ou legado (payment_type NULL)
    const commDueParts = parseIsoDateParts(c.commissionDueDate);
    const payParts = parseIsoDateParts(c.paymentDate);

    if (commDueParts) {
      dueDate = commDueParts.isoDate;
      forecastOrigin = 'CONFIRMED';
      forecastOriginLabel =
        c.paymentType === 'DATA_FIXA'
          ? 'Confirmada (Vencimento do contrato)'
          : 'Confirmada (Vencimento registrado)';
    } else if (payParts) {
      dueDate = addDaysIso(payParts.isoDate, 1);
      forecastOrigin = 'ESTIMATED_LEGACY';
      forecastOriginLabel = 'Estimada (Legado: Pgto mercadoria + 1 dia)';
    } else {
      dueDate = null;
      forecastOrigin = 'UNDEFINED';
      forecastOriginLabel = 'Sem vencimento definido';
    }

    const parts = parseIsoDateParts(dueDate);
    slices.push({
      monthKey: parts ? parts.monthKey : '__UNDEFINED__',
      dueDate,
      amount: contractedCommission,
      bags: totalBags,
      origin: forecastOrigin,
      label: forecastOriginLabel
    });
  }

  const dueParts = parseIsoDateParts(dueDate);
  let financialStatus: CommissionFinancialStatus = 'SEM_VENCIMENTO';
  let financialStatusLabel = 'Sem vencimento definido';

  if (item.normalizedStatus === 'Cancelado') {
    financialStatus = 'CANCELADA';
    financialStatusLabel = 'Cancelada';
  } else if (forecastOrigin === 'CONFIRMED') {
    financialStatus = 'PREVISTA_CONFIRMADA';
    financialStatusLabel =
      dueDate && dueDate < todayIso
        ? 'Prevista confirmada (venc. anterior a hoje — sem controle de baixa)'
        : 'Prevista confirmada';
  } else if (forecastOrigin === 'ESTIMATED_LEGACY' || forecastOrigin === 'ESTIMATED_BY_SHIPMENT') {
    financialStatus = 'PREVISTA_ESTIMADA';
    financialStatusLabel =
      forecastOrigin === 'ESTIMATED_BY_SHIPMENT'
        ? 'Estimada por embarque (a validar)'
        : 'Prevista estimada (legado)';
  } else if (c.paymentType === 'SOB_RODAS' || c.paymentType === 'POS_RETIRADA') {
    financialStatus = 'AGUARDANDO_EMBARQUE';
    financialStatusLabel = 'Aguardando embarque';
  }

  return {
    contractId: c.id,
    contractNumber: c.number,
    producerKey: item.producer.producerKey,
    producerName: item.producer.displayName,
    producerDoc: item.producer.doc,
    producerMatchMethod: item.producer.matchMethod,
    farmName: item.farm.farmName,
    product: c.product,
    crop: c.crop,
    closingDate: c.closingDate || c.createdAt,
    status: item.normalizedStatus,
    paymentType: c.paymentType,
    totalBags,
    shippedBags,
    commissionPerBag,
    contractedCommission,
    shippedCommission,
    contractCurrency: c.currency,
    commissionCurrency: 'BRL',
    dueDate,
    dueMonthKey: dueParts ? dueParts.monthKey : null,
    forecastOrigin,
    forecastOriginLabel,
    slices,
    effectiveReceiptDate: null,
    receivedAmount: null,
    receivableBalance: null,
    financialStatus,
    financialStatusLabel,
    observation: c.observation || ''
  };
};

export interface CommissionAnalyticsResult {
  rows: CommissionContractRow[];
  contractsCount: number;
  totalBags: number;
  totalShippedBags: number;
  totalContractedBRL: number;
  totalShippedBRL: number;
  forecastConfirmedBRL: number;
  forecastEstimatedBRL: number;
  forecastTotalPeriodBRL: number;
  undefinedDueBRL: number;
  weightedAvgPerBagBRL: number | null;
  monthlySeries: Array<{
    monthKey: string;
    label: string;
    confirmedBRL: number;
    estimatedBRL: number;
    totalBRL: number;
    volumeBags: number;
    contractIds: string[];
  }>;
  summaryByProducer: Array<{
    key: string;
    name: string;
    doc: string;
    contractsCount: number;
    totalBags: number;
    totalBRL: number;
    confirmedBRL: number;
    estimatedBRL: number;
    undefinedBRL: number;
    contractIds: string[];
  }>;
  summaryByProduct: Array<{
    product: string;
    contractsCount: number;
    totalBags: number;
    totalBRL: number;
  }>;
  summaryByCrop: Array<{
    crop: string;
    contractsCount: number;
    totalBags: number;
    totalBRL: number;
  }>;
}

export const buildCommissionAnalytics = (
  enrichedItems: EnrichedContract[],
  filters: ReportFilterState,
  economicGroups: EconomicGroup[] = []
): CommissionAnalyticsResult => {
  const todayIso = getTodayIsoLocal();

  // First filter by non-date filters + status/producer/crop/product/commodity currency
  const activeGroup = filters.economicGroupId
    ? economicGroups.find((g) => g.id === filters.economicGroupId)
    : undefined;
  const groupProducerSet = activeGroup ? new Set(activeGroup.producerIds) : null;

  const preFiltered = enrichedItems.filter((item) => {
    const c = item.contract;
    if (filters.crops.length > 0 && !filters.crops.includes(c.crop)) return false;
    if (filters.products.length > 0 && !filters.products.includes(c.product)) return false;
    if (filters.producerKeys.length > 0 && !filters.producerKeys.includes(item.producer.producerKey)) return false;
    if (groupProducerSet && (!item.producer.producerId || !groupProducerSet.has(item.producer.producerId))) return false;
    if (filters.farmNames.length > 0 && !filters.farmNames.includes(item.farm.farmName)) return false;
    if (filters.currencies.length > 0 && !filters.currencies.includes(c.currency)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(item.normalizedStatus)) return false;
    return true;
  });

  const allResolved = preFiltered.map((item) => resolveCommissionForContract(item, todayIso));

  // Filter by forecast origin & due date period (if period/year/month filter is set)
  const hasDateFilter = Boolean(
    filters.startDate || filters.endDate || filters.years.length > 0 || filters.months.length > 0
  );

  const rows = allResolved.filter((row) => {
    if (filters.forecastOrigins.length > 0 && !filters.forecastOrigins.includes(row.forecastOrigin)) {
      return false;
    }
    if (!hasDateFilter) return true;

    // Match if at least one slice falls inside the requested forecast window
    return row.slices.some((sl) => {
      if (!sl.dueDate) return false;
      const parts = parseIsoDateParts(sl.dueDate);
      if (!parts) return false;
      if (filters.startDate && parts.isoDate < filters.startDate) return false;
      if (filters.endDate && parts.isoDate > filters.endDate) return false;
      if (filters.years.length > 0 && !filters.years.includes(String(parts.year))) return false;
      if (filters.months.length > 0 && !filters.months.includes(String(parts.month).padStart(2, '0'))) return false;
      return true;
    });
  });

  let totalContractedBRL = 0;
  let totalShippedBRL = 0;
  let forecastConfirmedBRL = 0;
  let forecastEstimatedBRL = 0;
  let forecastTotalPeriodBRL = 0;
  let undefinedDueBRL = 0;
  let totalBags = 0;
  let totalShippedBags = 0;

  const monthlyMap = new Map<
    string,
    {
      monthKey: string;
      label: string;
      confirmedBRL: number;
      estimatedBRL: number;
      totalBRL: number;
      volumeBags: number;
      contractIds: Set<string>;
    }
  >();

  const producerMap = new Map<
    string,
    {
      key: string;
      name: string;
      doc: string;
      contractsCount: number;
      totalBags: number;
      totalBRL: number;
      confirmedBRL: number;
      estimatedBRL: number;
      undefinedBRL: number;
      contractIds: string[];
    }
  >();

  const productMap = new Map<
    string,
    { product: string; contractsCount: number; totalBags: number; totalBRL: number }
  >();

  const cropMap = new Map<
    string,
    { crop: string; contractsCount: number; totalBags: number; totalBRL: number }
  >();

  for (const row of rows) {
    totalBags += row.totalBags;
    totalShippedBags += row.shippedBags;
    totalContractedBRL += row.contractedCommission;
    totalShippedBRL += row.shippedCommission;

    // Producer summary (sempre consolidado em BRL)
    const pEntry = producerMap.get(row.producerKey) || {
      key: row.producerKey,
      name: row.producerName,
      doc: row.producerDoc,
      contractsCount: 0,
      totalBags: 0,
      totalBRL: 0,
      confirmedBRL: 0,
      estimatedBRL: 0,
      undefinedBRL: 0,
      contractIds: []
    };
    pEntry.contractsCount += 1;
    pEntry.totalBags += row.totalBags;
    pEntry.totalBRL += row.contractedCommission;
    pEntry.contractIds.push(row.contractId);

    // Product summary
    const prodEntry = productMap.get(row.product) || {
      product: row.product,
      contractsCount: 0,
      totalBags: 0,
      totalBRL: 0
    };
    prodEntry.contractsCount += 1;
    prodEntry.totalBags += row.totalBags;
    prodEntry.totalBRL += row.contractedCommission;
    productMap.set(row.product, prodEntry);

    // Crop summary
    const cropEntry = cropMap.get(row.crop) || {
      crop: row.crop,
      contractsCount: 0,
      totalBags: 0,
      totalBRL: 0
    };
    cropEntry.contractsCount += 1;
    cropEntry.totalBags += row.totalBags;
    cropEntry.totalBRL += row.contractedCommission;
    cropMap.set(row.crop, cropEntry);

    // Slices for monthly forecast & due classification (sempre em BRL)
    for (const sl of row.slices) {
      if (hasDateFilter) {
        if (!sl.dueDate) continue;
        const parts = parseIsoDateParts(sl.dueDate);
        if (!parts) continue;
        if (filters.startDate && parts.isoDate < filters.startDate) continue;
        if (filters.endDate && parts.isoDate > filters.endDate) continue;
        if (filters.years.length > 0 && !filters.years.includes(String(parts.year))) continue;
        if (filters.months.length > 0 && !filters.months.includes(String(parts.month).padStart(2, '0'))) continue;
      }

      if (sl.origin === 'UNDEFINED' || sl.monthKey === '__UNDEFINED__') {
        undefinedDueBRL += sl.amount;
        pEntry.undefinedBRL += sl.amount;
        continue;
      }

      forecastTotalPeriodBRL += sl.amount;
      if (sl.origin === 'CONFIRMED') {
        forecastConfirmedBRL += sl.amount;
        pEntry.confirmedBRL += sl.amount;
      } else {
        forecastEstimatedBRL += sl.amount;
        pEntry.estimatedBRL += sl.amount;
      }

      const mEntry = monthlyMap.get(sl.monthKey) || {
        monthKey: sl.monthKey,
        label: formatMonthLabel(sl.monthKey),
        confirmedBRL: 0,
        estimatedBRL: 0,
        totalBRL: 0,
        volumeBags: 0,
        contractIds: new Set<string>()
      };

      if (sl.origin === 'CONFIRMED') mEntry.confirmedBRL += sl.amount;
      else mEntry.estimatedBRL += sl.amount;
      mEntry.totalBRL += sl.amount;
      mEntry.volumeBags += sl.bags;
      mEntry.contractIds.add(row.contractId);
      monthlyMap.set(sl.monthKey, mEntry);
    }

    producerMap.set(row.producerKey, pEntry);
  }

  const monthlySeries = Array.from(monthlyMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => ({
      ...m,
      contractIds: Array.from(m.contractIds)
    }));

  const summaryByProducer = Array.from(producerMap.values()).sort((a, b) => b.totalBRL - a.totalBRL);
  const summaryByProduct = Array.from(productMap.values()).sort((a, b) => b.totalBRL - a.totalBRL);
  const summaryByCrop = Array.from(cropMap.values()).sort(
    (a, b) => getCropYearNumber(b.crop) - getCropYearNumber(a.crop)
  );

  return {
    rows,
    contractsCount: rows.length,
    totalBags,
    totalShippedBags,
    totalContractedBRL,
    totalShippedBRL,
    forecastConfirmedBRL,
    forecastEstimatedBRL,
    forecastTotalPeriodBRL,
    undefinedDueBRL,
    weightedAvgPerBagBRL: totalBags > 0 ? totalContractedBRL / totalBags : null,
    monthlySeries,
    summaryByProducer,
    summaryByProduct,
    summaryByCrop
  };
};

export const buildCommissionMatrix = (
  rows: CommissionContractRow[],
  rowDimension: CommissionMatrixData['rowDimension'],
  filters: ReportFilterState,
  consolidatedLabel?: string
): CommissionMatrixData => {
  const hasDateFilter = Boolean(
    filters.startDate || filters.endDate || filters.years.length > 0 || filters.months.length > 0
  );
  const monthKeySet = new Set<string>();
  const rowMap = new Map<
    string,
    {
      key: string;
      label: string;
      subLabel?: string;
      cells: Record<string, { amount: number; contractIds: Set<string> }>;
      totalBRL: number;
      undefinedBRL: number;
      contractIds: Set<string>;
    }
  >();

  for (const r of rows) {
    let rowKey = r.producerKey;
    let rowLabel = r.producerName;
    let rowSubLabel = r.producerDoc || undefined;

    if (rowDimension === 'GROUP_SELECTION') {
      rowKey = '__CONSOLIDATED_GROUP__';
      rowLabel = consolidatedLabel || 'Grupo / Seleção Consolidada';
      rowSubLabel = 'Visão consolidada dos produtores selecionados';
    } else if (rowDimension === 'PRODUCT') {
      rowKey = r.product;
      rowLabel = r.product;
      rowSubLabel = undefined;
    } else if (rowDimension === 'CROP') {
      rowKey = r.crop;
      rowLabel = `Safra ${r.crop}`;
      rowSubLabel = undefined;
    }

    const entry = rowMap.get(rowKey) || {
      key: rowKey,
      label: rowLabel,
      subLabel: rowSubLabel,
      cells: {},
      totalBRL: 0,
      undefinedBRL: 0,
      contractIds: new Set<string>()
    };

    entry.contractIds.add(r.contractId);

    for (const sl of r.slices) {
      if (hasDateFilter) {
        if (!sl.dueDate) continue;
        const parts = parseIsoDateParts(sl.dueDate);
        if (!parts) continue;
        if (filters.startDate && parts.isoDate < filters.startDate) continue;
        if (filters.endDate && parts.isoDate > filters.endDate) continue;
        if (filters.years.length > 0 && !filters.years.includes(String(parts.year))) continue;
        if (filters.months.length > 0 && !filters.months.includes(String(parts.month).padStart(2, '0'))) continue;
      }

      if (sl.origin === 'UNDEFINED' || sl.monthKey === '__UNDEFINED__') {
        entry.undefinedBRL += sl.amount;
        continue;
      }

      monthKeySet.add(sl.monthKey);
      if (!entry.cells[sl.monthKey]) {
        entry.cells[sl.monthKey] = { amount: 0, contractIds: new Set<string>() };
      }
      entry.cells[sl.monthKey].amount += sl.amount;
      entry.cells[sl.monthKey].contractIds.add(r.contractId);
      entry.totalBRL += sl.amount;
    }

    rowMap.set(rowKey, entry);
  }

  const monthKeys = Array.from(monthKeySet).sort((a, b) => a.localeCompare(b));
  const colTotalsBRL: Record<string, number> = {};
  monthKeys.forEach((mk) => {
    colTotalsBRL[mk] = 0;
  });

  let grandTotalBRL = 0;
  let grandUndefinedBRL = 0;

  const finalRows = Array.from(rowMap.values())
    .map((entry) => {
      const cells: Record<string, { amount: number; contractIds: string[] }> = {};
      for (const mk of monthKeys) {
        if (entry.cells[mk]) {
          cells[mk] = {
            amount: entry.cells[mk].amount,
            contractIds: Array.from(entry.cells[mk].contractIds)
          };
          colTotalsBRL[mk] += entry.cells[mk].amount;
        }
      }
      grandTotalBRL += entry.totalBRL;
      grandUndefinedBRL += entry.undefinedBRL;

      return {
        key: entry.key,
        label: entry.label,
        subLabel: entry.subLabel,
        cells,
        totalBRL: entry.totalBRL,
        undefinedBRL: entry.undefinedBRL,
        contractIds: Array.from(entry.contractIds)
      };
    })
    .sort((a, b) => b.totalBRL - a.totalBRL);

  return {
    rowDimension,
    monthKeys,
    rows: finalRows,
    colTotalsBRL,
    grandTotalBRL,
    grandUndefinedBRL
  };
};

// --- TAB 2: COMMERCIAL VOLUME & DYNAMIC MATRIX (SECTION 6) ---

export type VolumeRowDimension = 'PRODUCER' | 'GROUP_SELECTION' | 'FARM' | 'PRODUCT' | 'CROP';
export type VolumeColDimension = 'MONTH' | 'QUARTER' | 'YEAR' | 'CROP';
export type VolumeMetricMode = 'CONTRACTED' | 'SHIPPED' | 'PENDING' | 'SHARE_PCT';

export interface VolumeMatrixResult {
  colKeys: string[];
  colLabels: Record<string, string>;
  rows: Array<{
    key: string;
    label: string;
    subLabel?: string;
    cells: Record<string, { value: number; contractIds: string[] }>;
    total: number;
    sharePct: number;
    contractIds: string[];
  }>;
  colTotals: Record<string, number>;
  colCumulative: Record<string, number>;
  grandTotal: number;
}

export interface VolumeAnalyticsResult {
  contractsCount: number;
  producersCount: number;
  totalContracted: number;
  totalShipped: number;
  totalPending: number;
  avgPerContract: number;
  avgPerProducer: number;
  logisticsCoverage: {
    contractsWithShipments: number;
    contractsTotal: number;
    contractsPct: number;
    volumeWithShipments: number;
  };
  monthlySeries: Array<{
    monthKey: string;
    label: string;
    contracted: number;
    shipped: number;
    cumulativeContracted: number;
    cumulativeShipped: number;
    contractIds: string[];
  }>;
  producerRanking: Array<{
    producerKey: string;
    name: string;
    doc: string;
    contractsCount: number;
    contracted: number;
    shipped: number;
    pending: number;
    sharePct: number;
    contractIds: string[];
  }>;
  byProduct: Array<{ product: string; contracted: number; shipped: number; pending: number; contractsCount: number }>;
  byCrop: Array<{
    crop: string;
    contracted: number;
    shipped: number;
    pending: number;
    contractsCount: number;
    growthVsPrevPct: number | null;
  }>;
}

export const buildVolumeAnalytics = (
  filteredItems: EnrichedContract[],
  unit: VolumeUnit
): VolumeAnalyticsResult => {
  let totalContracted = 0;
  let totalShipped = 0;
  let totalPending = 0;
  let contractsWithShipments = 0;
  let volumeWithShipments = 0;

  const producerMap = new Map<
    string,
    {
      producerKey: string;
      name: string;
      doc: string;
      contractsCount: number;
      contracted: number;
      shipped: number;
      pending: number;
      contractIds: string[];
    }
  >();

  const monthMap = new Map<
    string,
    { monthKey: string; label: string; contracted: number; shipped: number; contractIds: Set<string> }
  >();

  const productMap = new Map<
    string,
    { product: string; contracted: number; shipped: number; pending: number; contractsCount: number }
  >();

  const cropMap = new Map<
    string,
    { crop: string; contracted: number; shipped: number; pending: number; contractsCount: number }
  >();

  for (const item of filteredItems) {
    const c = item.contract;
    const contracted = bagsToUnit(Number(c.totalBags) || 0, unit);
    const shipped = bagsToUnit(item.logistics.knownShippedBags, unit);
    const pending = bagsToUnit(item.logistics.pendingBags, unit);

    totalContracted += contracted;
    totalShipped += shipped;
    totalPending += pending;

    if (item.logistics.hasShipmentRows || Number(c.deliveredBags) > 0) {
      contractsWithShipments += 1;
      volumeWithShipments += contracted;
    }

    // Producer
    const p = producerMap.get(item.producer.producerKey) || {
      producerKey: item.producer.producerKey,
      name: item.producer.displayName,
      doc: item.producer.doc,
      contractsCount: 0,
      contracted: 0,
      shipped: 0,
      pending: 0,
      contractIds: []
    };
    p.contractsCount += 1;
    p.contracted += contracted;
    p.shipped += shipped;
    p.pending += pending;
    p.contractIds.push(c.id);
    producerMap.set(item.producer.producerKey, p);

    // Month (contracted by closingDate)
    if (item.closingParts) {
      const m = monthMap.get(item.closingParts.monthKey) || {
        monthKey: item.closingParts.monthKey,
        label: formatMonthLabel(item.closingParts.monthKey),
        contracted: 0,
        shipped: 0,
        contractIds: new Set<string>()
      };
      m.contracted += contracted;
      m.contractIds.add(c.id);
      monthMap.set(item.closingParts.monthKey, m);
    }

    // Month (shipped by deliveryDate)
    for (const s of item.logistics.shipments) {
      const delParts = parseIsoDateParts(s.deliveryDate);
      if (!delParts) continue;
      const sVol = bagsToUnit(Number(s.bagsCount) || (Number(s.weightKg) || 0) / 60, unit);
      const m = monthMap.get(delParts.monthKey) || {
        monthKey: delParts.monthKey,
        label: formatMonthLabel(delParts.monthKey),
        contracted: 0,
        shipped: 0,
        contractIds: new Set<string>()
      };
      m.shipped += sVol;
      m.contractIds.add(c.id);
      monthMap.set(delParts.monthKey, m);
    }

    // Product
    const pr = productMap.get(c.product) || {
      product: c.product,
      contracted: 0,
      shipped: 0,
      pending: 0,
      contractsCount: 0
    };
    pr.contractsCount += 1;
    pr.contracted += contracted;
    pr.shipped += shipped;
    pr.pending += pending;
    productMap.set(c.product, pr);

    // Crop
    const cr = cropMap.get(c.crop) || {
      crop: c.crop,
      contracted: 0,
      shipped: 0,
      pending: 0,
      contractsCount: 0
    };
    cr.contractsCount += 1;
    cr.contracted += contracted;
    cr.shipped += shipped;
    cr.pending += pending;
    cropMap.set(c.crop, cr);
  }

  const sortedMonths = Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  let runContracted = 0;
  let runShipped = 0;
  const monthlySeries = sortedMonths.map((m) => {
    runContracted += m.contracted;
    runShipped += m.shipped;
    return {
      monthKey: m.monthKey,
      label: m.label,
      contracted: m.contracted,
      shipped: m.shipped,
      cumulativeContracted: runContracted,
      cumulativeShipped: runShipped,
      contractIds: Array.from(m.contractIds)
    };
  });

  const producerRanking = Array.from(producerMap.values())
    .sort((a, b) => b.contracted - a.contracted)
    .map((p) => ({
      ...p,
      sharePct: totalContracted > 0 ? (p.contracted / totalContracted) * 100 : 0
    }));

  const byProduct = Array.from(productMap.values()).sort((a, b) => b.contracted - a.contracted);

  const cropsSortedAsc = Array.from(cropMap.values()).sort(
    (a, b) => getCropYearNumber(a.crop) - getCropYearNumber(b.crop)
  );
  const byCrop = cropsSortedAsc.map((c, idx) => {
    const prev = idx > 0 ? cropsSortedAsc[idx - 1] : null;
    const growthVsPrevPct =
      prev && prev.contracted > 0 ? ((c.contracted - prev.contracted) / prev.contracted) * 100 : null;
    return { ...c, growthVsPrevPct };
  });

  const contractsCount = filteredItems.length;
  const producersCount = producerMap.size;

  return {
    contractsCount,
    producersCount,
    totalContracted,
    totalShipped,
    totalPending,
    avgPerContract: contractsCount > 0 ? totalContracted / contractsCount : 0,
    avgPerProducer: producersCount > 0 ? totalContracted / producersCount : 0,
    logisticsCoverage: {
      contractsWithShipments,
      contractsTotal: contractsCount,
      contractsPct: contractsCount > 0 ? (contractsWithShipments / contractsCount) * 100 : 0,
      volumeWithShipments
    },
    monthlySeries,
    producerRanking,
    byProduct,
    byCrop
  };
};

export const buildVolumeMatrix = (
  filteredItems: EnrichedContract[],
  rowDim: VolumeRowDimension,
  colDim: VolumeColDimension,
  metric: VolumeMetricMode,
  unit: VolumeUnit,
  consolidatedLabel?: string
): VolumeMatrixResult => {
  const colKeySet = new Set<string>();
  const colLabels: Record<string, string> = {};

  const getColKeyAndLabel = (parts: IsoDateParts | null, crop: string): { key: string; label: string } => {
    if (colDim === 'CROP') {
      return { key: crop || 'Sem Safra', label: `Safra ${crop || '-'}` };
    }
    if (!parts) return { key: '__NO_DATE__', label: 'Sem Data' };
    if (colDim === 'YEAR') return { key: String(parts.year), label: String(parts.year) };
    if (colDim === 'QUARTER') return { key: parts.quarterKey, label: parts.quarterKey };
    return { key: parts.monthKey, label: formatMonthLabel(parts.monthKey) };
  };

  const getRowKeyAndLabel = (item: EnrichedContract): { key: string; label: string; subLabel?: string } => {
    if (rowDim === 'GROUP_SELECTION') {
      return {
        key: '__CONSOLIDATED_GROUP__',
        label: consolidatedLabel || 'Grupo / Seleção Consolidada',
        subLabel: 'Consolidação dos produtores filtrados'
      };
    }
    if (rowDim === 'FARM') {
      return {
        key: `${item.producer.producerKey}::${item.farm.farmName}`,
        label: item.farm.farmName,
        subLabel: item.producer.displayName
      };
    }
    if (rowDim === 'PRODUCT') {
      return { key: item.contract.product, label: item.contract.product };
    }
    if (rowDim === 'CROP') {
      return { key: item.contract.crop, label: `Safra ${item.contract.crop}` };
    }
    return {
      key: item.producer.producerKey,
      label: item.producer.displayName,
      subLabel: item.producer.doc || undefined
    };
  };

  const rowMap = new Map<
    string,
    {
      key: string;
      label: string;
      subLabel?: string;
      cells: Record<string, { value: number; contractIds: Set<string> }>;
      total: number;
      contractIds: Set<string>;
    }
  >();

  const addCell = (
    rowInfo: { key: string; label: string; subLabel?: string },
    colInfo: { key: string; label: string },
    val: number,
    contractId: string
  ) => {
    colKeySet.add(colInfo.key);
    colLabels[colInfo.key] = colInfo.label;
    const entry = rowMap.get(rowInfo.key) || {
      key: rowInfo.key,
      label: rowInfo.label,
      subLabel: rowInfo.subLabel,
      cells: {},
      total: 0,
      contractIds: new Set<string>()
    };
    if (!entry.cells[colInfo.key]) {
      entry.cells[colInfo.key] = { value: 0, contractIds: new Set<string>() };
    }
    entry.cells[colInfo.key].value += val;
    entry.cells[colInfo.key].contractIds.add(contractId);
    entry.total += val;
    entry.contractIds.add(contractId);
    rowMap.set(rowInfo.key, entry);
  };

  for (const item of filteredItems) {
    const c = item.contract;
    const rowInfo = getRowKeyAndLabel(item);

    if (metric === 'CONTRACTED' || metric === 'SHARE_PCT') {
      const vol = bagsToUnit(Number(c.totalBags) || 0, unit);
      const colInfo = getColKeyAndLabel(item.closingParts, c.crop);
      addCell(rowInfo, colInfo, vol, c.id);
    } else if (metric === 'SHIPPED') {
      if (item.logistics.shipments.length > 0) {
        for (const s of item.logistics.shipments) {
          const sVol = bagsToUnit(Number(s.bagsCount) || (Number(s.weightKg) || 0) / 60, unit);
          const delParts = parseIsoDateParts(s.deliveryDate);
          const colInfo = getColKeyAndLabel(delParts, c.crop);
          addCell(rowInfo, colInfo, sVol, c.id);
        }
      } else if (Number(c.deliveredBags) > 0) {
        const vol = bagsToUnit(Number(c.deliveredBags), unit);
        const colInfo = getColKeyAndLabel(item.closingParts, c.crop);
        addCell(rowInfo, colInfo, vol, c.id);
      }
    } else if (metric === 'PENDING') {
      const pending = bagsToUnit(item.logistics.pendingBags, unit);
      if (pending > 0) {
        // Critério explícito (Seção 6.2): mês previsto de conclusão do embarque (shipmentEndDate), fallback closingDate
        const refParts = item.shipmentEndParts || item.closingParts;
        const colInfo = getColKeyAndLabel(refParts, c.crop);
        addCell(rowInfo, colInfo, pending, c.id);
      }
    }
  }

  const colKeys = Array.from(colKeySet).sort((a, b) => {
    if (a === '__NO_DATE__') return 1;
    if (b === '__NO_DATE__') return -1;
    if (colDim === 'CROP') return getCropYearNumber(a) - getCropYearNumber(b);
    return a.localeCompare(b);
  });

  const colTotals: Record<string, number> = {};
  colKeys.forEach((ck) => (colTotals[ck] = 0));

  let grandTotal = 0;
  for (const entry of rowMap.values()) {
    grandTotal += entry.total;
    for (const ck of colKeys) {
      if (entry.cells[ck]) {
        colTotals[ck] += entry.cells[ck].value;
      }
    }
  }

  const colCumulative: Record<string, number> = {};
  let running = 0;
  for (const ck of colKeys) {
    running += colTotals[ck];
    colCumulative[ck] = metric === 'SHARE_PCT' && grandTotal > 0 ? (running / grandTotal) * 100 : running;
  }

  const rows = Array.from(rowMap.values())
    .map((entry) => {
      const cells: Record<string, { value: number; contractIds: string[] }> = {};
      for (const ck of colKeys) {
        if (entry.cells[ck]) {
          const rawVal = entry.cells[ck].value;
          cells[ck] = {
            value: metric === 'SHARE_PCT' && grandTotal > 0 ? (rawVal / grandTotal) * 100 : rawVal,
            contractIds: Array.from(entry.cells[ck].contractIds)
          };
        }
      }
      return {
        key: entry.key,
        label: entry.label,
        subLabel: entry.subLabel,
        cells,
        total: metric === 'SHARE_PCT' && grandTotal > 0 ? (entry.total / grandTotal) * 100 : entry.total,
        sharePct: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
        contractIds: Array.from(entry.contractIds)
      };
    })
    .sort((a, b) => b.total - a.total);

  if (metric === 'SHARE_PCT' && grandTotal > 0) {
    for (const ck of colKeys) {
      colTotals[ck] = (colTotals[ck] / grandTotal) * 100;
    }
  }

  return {
    colKeys,
    colLabels,
    rows,
    colTotals,
    colCumulative,
    grandTotal: metric === 'SHARE_PCT' ? (grandTotal > 0 ? 100 : 0) : grandTotal
  };
};

// --- TAB 3: CROP PACING (SECTION 7) ---

export interface PacingAnalysisResult {
  crops: string[];
  cropStatusMap: Record<string, { isOngoing: boolean; totalVolume: number; color: string }>;
  chartData: Array<Record<string, any>>;
  cutoffMetrics: Array<{
    crop: string;
    volumeAtCutoff: number;
    totalCropVolume: number;
    pctOfRecordedTotal: number;
    vsPrevPct: number | null;
    prevCrop: string | null;
    isOngoing: boolean;
    color: string;
  }>;
}

export const buildPacingAnalytics = (
  items: EnrichedContract[],
  selectedCrops: string[],
  selectedProducts: string[],
  selectedProducerKeys: string[],
  selectedStatuses: NormalizedContractStatus[],
  comparisonDate: string,
  unit: VolumeUnit,
  metricMode: 'VOLUME' | 'PERCENT'
): PacingAnalysisResult => {
  const filtered = items.filter((item) => {
    const c = item.contract;
    if (selectedProducts.length > 0 && !selectedProducts.includes(c.product)) return false;
    if (selectedProducerKeys.length > 0 && !selectedProducerKeys.includes(item.producer.producerKey)) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.normalizedStatus)) return false;
    if (selectedCrops.length > 0 && !selectedCrops.includes(c.crop)) return false;
    return true;
  });

  const crops = Array.from(new Set(filtered.map((i) => i.contract.crop))).sort(
    (a, b) => getCropYearNumber(a) - getCropYearNumber(b)
  );

  const totalByCrop: Record<string, number> = {};
  crops.forEach((cr) => (totalByCrop[cr] = 0));
  for (const item of filtered) {
    const vol = bagsToUnit(Number(item.contract.totalBags) || 0, unit);
    totalByCrop[item.contract.crop] = (totalByCrop[item.contract.crop] || 0) + vol;
  }

  const currentYear = new Date().getFullYear();
  const todayIso = getTodayIsoLocal();
  const cropStatusMap: Record<string, { isOngoing: boolean; totalVolume: number; color: string }> = {};
  crops.forEach((cr, idx) => {
    const cropYear = getCropYearNumber(cr);
    const hasFutureShipments = filtered.some(
      (i) => i.contract.crop === cr && i.shipmentEndParts && i.shipmentEndParts.isoDate >= todayIso
    );
    cropStatusMap[cr] = {
      isOngoing: cropYear >= currentYear || hasFutureShipments,
      totalVolume: totalByCrop[cr] || 0,
      color: CROP_CURVE_COLORS[idx % CROP_CURVE_COLORS.length]
    };
  });

  // Timeline alignment across ~24 months using virtual year 2000 (harvest year) and 1999 (pre-year)
  const timelineMap = new Map<string, any>();
  for (const item of filtered) {
    const c = item.contract;
    const parts = item.closingParts;
    if (!parts) continue;
    const cropYear = getCropYearNumber(c.crop);
    const yearDiff = cropYear - parts.year;
    const virtualYear = 2000 - yearDiff;
    const mm = String(parts.month).padStart(2, '0');
    const dd = String(parts.day).padStart(2, '0');
    const key = `${virtualYear}-${mm}-${dd}`;

    if (!timelineMap.has(key)) {
      const row: any = {
        name: `${dd}/${mm}`,
        virtualDate: key,
        periodLabel: yearDiff > 0 ? `Ano Ant. (-${yearDiff})` : yearDiff < 0 ? `Ano Post. (+${Math.abs(yearDiff)})` : 'Ano Safra'
      };
      crops.forEach((cr) => (row[cr] = 0));
      timelineMap.set(key, row);
    }

    const row = timelineMap.get(key)!;
    row[c.crop] = (row[c.crop] || 0) + bagsToUnit(Number(c.totalBags) || 0, unit);
  }

  const sortedTimeline = Array.from(timelineMap.values()).sort((a, b) =>
    a.virtualDate.localeCompare(b.virtualDate)
  );

  const running: Record<string, number> = {};
  crops.forEach((cr) => (running[cr] = 0));

  const chartData = sortedTimeline.map((dayRow) => {
    const out: any = {
      name: dayRow.name,
      virtualDate: dayRow.virtualDate,
      periodLabel: dayRow.periodLabel
    };
    crops.forEach((cr) => {
      running[cr] += dayRow[cr] || 0;
      const total = totalByCrop[cr] || 0;
      out[cr] = metricMode === 'PERCENT' ? (total > 0 ? (running[cr] / total) * 100 : 0) : running[cr];
    });
    return out;
  });

  // Equivalent cutoff calculation (timezone-safe)
  const cutParts = parseIsoDateParts(comparisonDate) || parseIsoDateParts(todayIso)!;
  const cutYear = cutParts.year;

  const cutoffMetrics = crops.map((cr, idx) => {
    const cropYear = getCropYearNumber(cr);
    const yearShift = cropYear - cutYear;
    const shiftedCutYear = cutYear + yearShift;
    const mm = String(cutParts.month).padStart(2, '0');
    const dd = String(cutParts.day).padStart(2, '0');
    const limitIso = `${shiftedCutYear}-${mm}-${dd}`;

    const volumeAtCutoff = filtered
      .filter((i) => i.contract.crop === cr)
      .reduce((acc, i) => {
        if (!i.closingParts) return acc;
        if (i.closingParts.isoDate <= limitIso) {
          return acc + bagsToUnit(Number(i.contract.totalBags) || 0, unit);
        }
        return acc;
      }, 0);

    const totalCropVolume = totalByCrop[cr] || 0;
    const pctOfRecordedTotal = totalCropVolume > 0 ? (volumeAtCutoff / totalCropVolume) * 100 : 0;

    return {
      crop: cr,
      volumeAtCutoff,
      totalCropVolume,
      pctOfRecordedTotal,
      vsPrevPct: null as number | null,
      prevCrop: idx > 0 ? crops[idx - 1] : null,
      isOngoing: cropStatusMap[cr].isOngoing,
      color: cropStatusMap[cr].color
    };
  });

  for (let i = 1; i < cutoffMetrics.length; i++) {
    const prevVol = cutoffMetrics[i - 1].volumeAtCutoff;
    if (prevVol > 0) {
      cutoffMetrics[i].vsPrevPct = ((cutoffMetrics[i].volumeAtCutoff - prevVol) / prevVol) * 100;
    }
  }

  return {
    crops,
    cropStatusMap,
    chartData,
    cutoffMetrics
  };
};

// --- TAB 4: PRODUCER COMMERCIAL INTELLIGENCE (SECTION 8) ---

export type PriceClassification =
  | 'FIXED_VALID'
  | 'TO_FIX_INDICATIVE'
  | 'TO_FIX_NO_PRICE'
  | 'INVALID_PRICE';

export const classifyContractPrice = (contract: Contract): PriceClassification => {
  const price = Number(contract.finalPrice) || 0;
  if (contract.isFixed) {
    return price > 0 ? 'FIXED_VALID' : 'INVALID_PRICE';
  }
  return price > 0 ? 'TO_FIX_INDICATIVE' : 'TO_FIX_NO_PRICE';
};

export interface ProducerIntelligenceCropRow {
  crop: string;
  volume: number;
  fixedVolume: number;
  toFixVolume: number;
  dealsCount: number;
  weightedAvgPrice: number | null;
  priceCoveragePct: number;
  maxPrice: number | null;
  minPrice: number | null;
  grossNegotiatedValue: number;
  volumeEvolutionPct: number | null;
  priceEvolutionPct: number | null;
  valueEvolutionPct: number | null;
}

export interface ProducerIntelligenceMonthRow {
  monthKey: string;
  label: string;
  volume: number;
  dealsCount: number;
  weightedAvgPrice: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  grossNegotiatedValue: number;
  sharePct: number;
  cumulativeVolume: number;
}

export interface ProducerIntelligenceBreakdownRow {
  key: string;
  label: string;
  product?: string;
  volume: number;
  dealsCount: number;
  weightedAvgPrice: number | null;
  grossNegotiatedValue: number;
  sharePct: number;
}

export interface ProducerIntelligenceResult {
  canComputeSingleAverage: boolean;
  distinctProducts: string[];
  distinctCurrencies: CurrencyCode[];
  currency: CurrencyCode | null;
  totalVolume: number;
  totalBags: number;
  dealsCount: number;
  fixedVolume: number;
  toFixVolume: number;
  indicativeVolume: number;
  invalidPriceVolume: number;
  priceCoveragePct: number;
  weightedAvgPrice: number | null;
  maxPrice: number | null;
  minPrice: number | null;
  grossNegotiatedValue: number;
  bestCropByVolume: ProducerIntelligenceCropRow | null;
  bestCropByAvgPrice: ProducerIntelligenceCropRow | null;
  bestCropByGrossValue: ProducerIntelligenceCropRow | null;
  cropComparison: ProducerIntelligenceCropRow[];
  monthlyStrategy: ProducerIntelligenceMonthRow[];
  monthlyByCropSeries: {
    crops: string[];
    rows: Array<Record<string, any>>;
  };
  highlights: {
    peakVolumeMonth: ProducerIntelligenceMonthRow | null;
    peakPriceMonth: ProducerIntelligenceMonthRow | null;
    lowestPriceMonth: ProducerIntelligenceMonthRow | null;
    topConcentrationMonths: ProducerIntelligenceMonthRow[];
  };
  byProduct: ProducerIntelligenceBreakdownRow[];
  byFarm: ProducerIntelligenceBreakdownRow[];
  byFarmAndProduct: ProducerIntelligenceBreakdownRow[];
  contracts: Array<{
    id: string;
    number: string;
    closingDate: string;
    product: string;
    crop: string;
    farmName: string;
    buyerName: string;
    volume: number;
    bags: number;
    finalPrice: number;
    currency: CurrencyCode;
    priceStatus: PriceClassification;
    grossValue: number;
    status: NormalizedContractStatus;
  }>;
}

export const buildProducerIntelligence = (
  filteredItems: EnrichedContract[],
  unit: VolumeUnit
): ProducerIntelligenceResult => {
  const distinctProducts = Array.from(new Set(filteredItems.map((i) => i.contract.product)));
  const distinctCurrencies = Array.from(new Set(filteredItems.map((i) => i.contract.currency)));

  // Regra 8.3: não misturar preços de culturas diferentes ou moedas diferentes em uma única média
  const canComputeSingleAverage = distinctProducts.length <= 1 && distinctCurrencies.length <= 1;
  const currency: CurrencyCode | null = distinctCurrencies.length === 1 ? distinctCurrencies[0] : null;

  let totalBags = 0;
  let totalVolume = 0;
  let fixedBags = 0;
  let fixedVolume = 0;
  let toFixVolume = 0;
  let indicativeVolume = 0;
  let invalidPriceVolume = 0;
  let weightedPriceNumerator = 0; // sum(bags * finalPrice)
  let grossNegotiatedValue = 0;
  let maxPrice: number | null = null;
  let minPrice: number | null = null;

  interface BucketAgg {
    bags: number;
    volume: number;
    dealsCount: number;
    fixedBags: number;
    weightedNum: number;
    grossVal: number;
    maxP: number | null;
    minP: number | null;
  }

  const makeBucket = (): BucketAgg => ({
    bags: 0,
    volume: 0,
    dealsCount: 0,
    fixedBags: 0,
    weightedNum: 0,
    grossVal: 0,
    maxP: null,
    minP: null
  });

  const cropMap = new Map<string, BucketAgg>();
  const monthMap = new Map<string, BucketAgg>();
  const productMap = new Map<string, BucketAgg>();
  const farmMap = new Map<string, BucketAgg>();
  const farmProductMap = new Map<string, BucketAgg & { farmName: string; product: string }>();

  const contractsOut: ProducerIntelligenceResult['contracts'] = [];

  for (const item of filteredItems) {
    const c = item.contract;
    const bags = Number(c.totalBags) || 0;
    const vol = bagsToUnit(bags, unit);
    const price = Number(c.finalPrice) || 0;
    const priceStatus = classifyContractPrice(c);
    const grossVal = priceStatus === 'FIXED_VALID' ? bags * price : 0;

    totalBags += bags;
    totalVolume += vol;
    grossNegotiatedValue += grossVal;

    if (priceStatus === 'FIXED_VALID') {
      fixedBags += bags;
      fixedVolume += vol;
      weightedPriceNumerator += bags * price;
      if (maxPrice === null || price > maxPrice) maxPrice = price;
      if (minPrice === null || price < minPrice) minPrice = price;
    } else if (priceStatus === 'TO_FIX_INDICATIVE') {
      toFixVolume += vol;
      indicativeVolume += vol;
    } else if (priceStatus === 'TO_FIX_NO_PRICE') {
      toFixVolume += vol;
    } else {
      invalidPriceVolume += vol;
    }

    const updateBucket = (b: BucketAgg) => {
      b.bags += bags;
      b.volume += vol;
      b.dealsCount += 1;
      if (priceStatus === 'FIXED_VALID') {
        b.fixedBags += bags;
        b.weightedNum += bags * price;
        b.grossVal += grossVal;
        if (b.maxP === null || price > b.maxP) b.maxP = price;
        if (b.minP === null || price < b.minP) b.minP = price;
      }
    };

    const cropBucket = cropMap.get(c.crop) || makeBucket();
    updateBucket(cropBucket);
    cropMap.set(c.crop, cropBucket);

    if (item.closingParts) {
      const mBucket = monthMap.get(item.closingParts.monthKey) || makeBucket();
      updateBucket(mBucket);
      monthMap.set(item.closingParts.monthKey, mBucket);
    }

    const pKey = `${c.product} (${c.currency})`;
    const pBucket = productMap.get(pKey) || makeBucket();
    updateBucket(pBucket);
    productMap.set(pKey, pBucket);

    const fBucket = farmMap.get(item.farm.farmName) || makeBucket();
    updateBucket(fBucket);
    farmMap.set(item.farm.farmName, fBucket);

    const fpKey = `${item.farm.farmName}::${c.product}::${c.currency}`;
    const fpBucket = farmProductMap.get(fpKey) || {
      ...makeBucket(),
      farmName: item.farm.farmName,
      product: `${c.product} (${c.currency})`
    };
    updateBucket(fpBucket);
    farmProductMap.set(fpKey, fpBucket);

    contractsOut.push({
      id: c.id,
      number: c.number,
      closingDate: c.closingDate || c.createdAt,
      product: c.product,
      crop: c.crop,
      farmName: item.farm.farmName,
      buyerName: c.buyerName,
      volume: vol,
      bags,
      finalPrice: price,
      currency: c.currency,
      priceStatus,
      grossValue: grossVal,
      status: item.normalizedStatus
    });
  }

  const weightedAvgPrice =
    canComputeSingleAverage && fixedBags > 0 ? weightedPriceNumerator / fixedBags : null;

  const sortedCrops = Array.from(cropMap.entries()).sort(
    ([a], [b]) => getCropYearNumber(a) - getCropYearNumber(b)
  );

  const cropComparison: ProducerIntelligenceCropRow[] = sortedCrops.map(([crop, b], idx) => {
    const avgP = canComputeSingleAverage && b.fixedBags > 0 ? b.weightedNum / b.fixedBags : null;
    const prev = idx > 0 ? sortedCrops[idx - 1][1] : null;
    const prevAvgP =
      canComputeSingleAverage && prev && prev.fixedBags > 0 ? prev.weightedNum / prev.fixedBags : null;

    return {
      crop,
      volume: b.volume,
      fixedVolume: bagsToUnit(b.fixedBags, unit),
      toFixVolume: b.volume - bagsToUnit(b.fixedBags, unit),
      dealsCount: b.dealsCount,
      weightedAvgPrice: avgP,
      priceCoveragePct: b.bags > 0 ? (b.fixedBags / b.bags) * 100 : 0,
      maxPrice: canComputeSingleAverage ? b.maxP : null,
      minPrice: canComputeSingleAverage ? b.minP : null,
      grossNegotiatedValue: distinctCurrencies.length <= 1 ? b.grossVal : 0,
      volumeEvolutionPct: prev && prev.volume > 0 ? ((b.volume - prev.volume) / prev.volume) * 100 : null,
      priceEvolutionPct:
        avgP !== null && prevAvgP !== null && prevAvgP > 0 ? ((avgP - prevAvgP) / prevAvgP) * 100 : null,
      valueEvolutionPct:
        distinctCurrencies.length <= 1 && prev && prev.grossVal > 0
          ? ((b.grossVal - prev.grossVal) / prev.grossVal) * 100
          : null
    };
  });

  const bestCropByVolume =
    cropComparison.length > 0
      ? [...cropComparison].sort((a, b) => b.volume - a.volume)[0]
      : null;

  const cropsWithAvg = cropComparison.filter((c) => c.weightedAvgPrice !== null);
  const bestCropByAvgPrice =
    cropsWithAvg.length > 0
      ? [...cropsWithAvg].sort((a, b) => (b.weightedAvgPrice || 0) - (a.weightedAvgPrice || 0))[0]
      : null;

  const bestCropByGrossValue =
    distinctCurrencies.length <= 1 && cropComparison.length > 0
      ? [...cropComparison].sort((a, b) => b.grossNegotiatedValue - a.grossNegotiatedValue)[0]
      : null;

  // Monthly strategy
  const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  let cumVol = 0;
  const monthlyStrategy: ProducerIntelligenceMonthRow[] = sortedMonths.map(([monthKey, b]) => {
    cumVol += b.volume;
    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      volume: b.volume,
      dealsCount: b.dealsCount,
      weightedAvgPrice: canComputeSingleAverage && b.fixedBags > 0 ? b.weightedNum / b.fixedBags : null,
      maxPrice: canComputeSingleAverage ? b.maxP : null,
      minPrice: canComputeSingleAverage ? b.minP : null,
      grossNegotiatedValue: distinctCurrencies.length <= 1 ? b.grossVal : 0,
      sharePct: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0,
      cumulativeVolume: cumVol
    };
  });

  // Monthly comparison by crop (aligned calendar month 1..12)
  const cropNames = sortedCrops.map(([cr]) => cr);
  const monthNumbersMap = new Map<number, Record<string, number>>();
  for (let m = 1; m <= 12; m++) {
    const init: Record<string, number> = {};
    cropNames.forEach((cr) => (init[cr] = 0));
    monthNumbersMap.set(m, init);
  }
  for (const item of filteredItems) {
    if (!item.closingParts) continue;
    const row = monthNumbersMap.get(item.closingParts.month);
    if (row) {
      row[item.contract.crop] = (row[item.contract.crop] || 0) + bagsToUnit(Number(item.contract.totalBags) || 0, unit);
    }
  }
  const monthlyByCropRows = Array.from(monthNumbersMap.entries()).map(([m, vals]) => ({
    monthNum: m,
    monthLabel: MONTH_SHORT_PT[m - 1],
    ...vals
  }));

  const peakVolumeMonth =
    monthlyStrategy.length > 0 ? [...monthlyStrategy].sort((a, b) => b.volume - a.volume)[0] : null;
  const monthsWithPrice = monthlyStrategy.filter((m) => m.weightedAvgPrice !== null);
  const peakPriceMonth =
    monthsWithPrice.length > 0
      ? [...monthsWithPrice].sort((a, b) => (b.weightedAvgPrice || 0) - (a.weightedAvgPrice || 0))[0]
      : null;
  const lowestPriceMonth =
    monthsWithPrice.length > 0
      ? [...monthsWithPrice].sort((a, b) => (a.weightedAvgPrice || 0) - (b.weightedAvgPrice || 0))[0]
      : null;
  const topConcentrationMonths = [...monthlyStrategy]
    .sort((a, b) => b.sharePct - a.sharePct)
    .slice(0, 3);

  const byProduct: ProducerIntelligenceBreakdownRow[] = Array.from(productMap.entries())
    .map(([key, b]) => ({
      key,
      label: key,
      volume: b.volume,
      dealsCount: b.dealsCount,
      weightedAvgPrice: b.fixedBags > 0 ? b.weightedNum / b.fixedBags : null,
      grossNegotiatedValue: b.grossVal,
      sharePct: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0
    }))
    .sort((a, b) => b.volume - a.volume);

  const byFarm: ProducerIntelligenceBreakdownRow[] = Array.from(farmMap.entries())
    .map(([key, b]) => ({
      key,
      label: key,
      volume: b.volume,
      dealsCount: b.dealsCount,
      weightedAvgPrice: canComputeSingleAverage && b.fixedBags > 0 ? b.weightedNum / b.fixedBags : null,
      grossNegotiatedValue: distinctCurrencies.length <= 1 ? b.grossVal : 0,
      sharePct: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0
    }))
    .sort((a, b) => b.volume - a.volume);

  const byFarmAndProduct: ProducerIntelligenceBreakdownRow[] = Array.from(farmProductMap.entries())
    .map(([key, b]) => ({
      key,
      label: b.farmName,
      product: b.product,
      volume: b.volume,
      dealsCount: b.dealsCount,
      weightedAvgPrice: b.fixedBags > 0 ? b.weightedNum / b.fixedBags : null,
      grossNegotiatedValue: b.grossVal,
      sharePct: totalVolume > 0 ? (b.volume / totalVolume) * 100 : 0
    }))
    .sort((a, b) => b.volume - a.volume);

  return {
    canComputeSingleAverage,
    distinctProducts,
    distinctCurrencies,
    currency,
    totalVolume,
    totalBags,
    dealsCount: filteredItems.length,
    fixedVolume,
    toFixVolume,
    indicativeVolume,
    invalidPriceVolume,
    priceCoveragePct: totalBags > 0 ? (fixedBags / totalBags) * 100 : 0,
    weightedAvgPrice,
    maxPrice: canComputeSingleAverage ? maxPrice : null,
    minPrice: canComputeSingleAverage ? minPrice : null,
    grossNegotiatedValue: distinctCurrencies.length <= 1 ? grossNegotiatedValue : 0,
    bestCropByVolume,
    bestCropByAvgPrice,
    bestCropByGrossValue,
    cropComparison,
    monthlyStrategy,
    monthlyByCropSeries: { crops: cropNames, rows: monthlyByCropRows },
    highlights: {
      peakVolumeMonth,
      peakPriceMonth,
      lowestPriceMonth,
      topConcentrationMonths
    },
    byProduct,
    byFarm,
    byFarmAndProduct,
    contracts: contractsOut.sort((a, b) => b.closingDate.localeCompare(a.closingDate))
  };
};
