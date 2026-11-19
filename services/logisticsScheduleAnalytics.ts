import {
  EconomicGroup,
  FreightType,
  NormalizedContractStatus
} from '../types';
import {
  EnrichedContract,
  IsoDateParts,
  MONTH_SHORT_PT,
  VolumeUnit,
  addDaysIso,
  bagsToUnit,
  formatDateBR,
  formatMonthLabel,
  getTodayIsoLocal,
  parseIsoDateParts
} from './reportsAnalytics';

export const MONTH_FULL_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export type FortnightNumber = 1 | 2;
export type FortnightCode = 'Q1' | 'Q2';

export type DeliveryWindowKind =
  | 'SINGLE_FORTNIGHT'
  | 'FULL_MONTH'
  | 'INTRA_MONTH_WINDOW'
  | 'MULTI_MONTH'
  | 'INVALID_DATES';

export type LogisticsDeliveryStatus =
  | 'PROGRAMADO'
  | 'EM_PERIODO_DE_ENTREGA'
  | 'PARCIALMENTE_ENTREGUE'
  | 'ENTREGA_CONCLUIDA'
  | 'EM_ATRASO_CONFIRMADO'
  | 'PRAZO_ENCERRADO_SEM_CONFIRMACAO'
  | 'SEM_ACOMPANHAMENTO_LOGISTICO'
  | 'PERIODO_INCONSISTENTE';

export const LOGISTICS_STATUS_LABELS: Record<LogisticsDeliveryStatus, string> = {
  PROGRAMADO: 'Programado',
  EM_PERIODO_DE_ENTREGA: 'Em período de entrega',
  PARCIALMENTE_ENTREGUE: 'Parcialmente entregue',
  ENTREGA_CONCLUIDA: 'Entrega concluída',
  EM_ATRASO_CONFIRMADO: 'Em atraso confirmado',
  PRAZO_ENCERRADO_SEM_CONFIRMACAO: 'Prazo encerrado sem confirmação de entrega',
  SEM_ACOMPANHAMENTO_LOGISTICO: 'Sem acompanhamento logístico',
  PERIODO_INCONSISTENTE: 'Período inconsistente'
};

export const LOGISTICS_STATUS_ORDER: LogisticsDeliveryStatus[] = [
  'EM_ATRASO_CONFIRMADO',
  'PRAZO_ENCERRADO_SEM_CONFIRMACAO',
  'EM_PERIODO_DE_ENTREGA',
  'PARCIALMENTE_ENTREGUE',
  'PROGRAMADO',
  'ENTREGA_CONCLUIDA',
  'SEM_ACOMPANHAMENTO_LOGISTICO',
  'PERIODO_INCONSISTENTE'
];

export interface FortnightSegment {
  key: string; // YYYY-MM-Q1 | YYYY-MM-Q2
  year: number;
  month: number; // 1..12
  fortnight: FortnightNumber;
  code: FortnightCode;
  monthKey: string; // YYYY-MM
  quarterKey: string; // YYYY-T1..T4
  startIso: string;
  endIso: string;
  label: string; // "1ª Quinzena Dezembro/2026"
  shortLabel: string; // "1ª Q Dez/26"
}

export interface ClassifiedDeliveryWindow {
  kind: DeliveryWindowKind;
  isValid: boolean;
  startIso: string | null;
  endIso: string | null;
  startParts: IsoDateParts | null;
  endParts: IsoDateParts | null;
  isNonStandardStartDay: boolean;
  isExactFortnight: boolean;
  isExactMonth: boolean;
  isExactQuarter: boolean;
  singleFortnightKey: string | null;
  singleMonthKey: string | null;
  singleQuarterKey: string | null;
  periodKey: string;
  periodLabel: string;
  periodShortLabel: string;
  exactDatesLabel: string;
  calendarDays: number;
}

export interface SimulatedFortnightSlice {
  segment: FortnightSegment;
  overlapDays: number;
  weightPct: number;
  bags: number;
  volume: number;
}

export interface ShipmentTimelinePoint {
  deliveryDate: string;
  monthKey: string;
  fortnightKey: string;
  bags: number;
  volume: number;
  shipmentsCount: number;
  ticketNumbers: string[];
}

export interface LogisticsContractRow {
  contractId: string;
  contractNumber: string;
  closingDate: string;
  producerKey: string;
  producerId?: string;
  producerName: string;
  producerDoc: string;
  farmName: string;
  product: string;
  crop: string;
  buyerName: string;
  freightType: FreightType;
  pickupLocation: string;
  contractStatus: NormalizedContractStatus;
  contractedBags: number;
  contractedVolume: number;
  deliveredBags: number;
  deliveredVolume: number;
  balanceBags: number;
  balanceVolume: number;
  excessBags: number;
  excessVolume: number;
  deliveredPct: number;
  deliverySource: 'SHIPMENTS_TABLE' | 'CONTRACT_FALLBACK' | 'NONE';
  hasLogisticsDiscrepancy: boolean;
  shipmentsCount: number;
  shipmentPoints: ShipmentTimelinePoint[];
  window: ClassifiedDeliveryWindow;
  logisticsStatus: LogisticsDeliveryStatus;
  logisticsStatusLabel: string;
  daysUntilEnd: number | null;
  daysSinceEnd: number | null;
}

export interface LogisticsFilterState {
  startDate: string;
  endDate: string;
  referenceDate: string;
  operationalCutoffDate: string;
  years: string[];
  months: string[];
  fortnights: FortnightCode[];
  producerKeys: string[];
  economicGroupId: string;
  products: string[];
  crops: string[];
  farmNames: string[];
  pickupLocations: string[];
  freightTypes: FreightType[];
  contractStatuses: NormalizedContractStatus[];
  deliveryStatuses: LogisticsDeliveryStatus[];
  excludeCancelled: boolean;
  simulateDistribution: boolean;
}

export const createDefaultLogisticsFilters = (): LogisticsFilterState => ({
  startDate: '',
  endDate: '',
  referenceDate: getTodayIsoLocal(),
  operationalCutoffDate: '2026-01-01',
  years: [],
  months: [],
  fortnights: [],
  producerKeys: [],
  economicGroupId: '',
  products: [],
  crops: [],
  farmNames: [],
  pickupLocations: [],
  freightTypes: [],
  contractStatuses: [],
  deliveryStatuses: [],
  excludeCancelled: true,
  simulateDistribution: false
});

// --- CALENDAR & PERIOD HELPERS (UTC-SAFE, ZERO TIMEZONE DRIFT) ---

export const getDaysInMonth = (year: number, month1To12: number): number =>
  new Date(Date.UTC(year, month1To12, 0)).getUTCDate();

export const getFortnightOfDay = (day: number): FortnightNumber => (day <= 15 ? 1 : 2);

export const buildFortnightSegment = (
  year: number,
  month1To12: number,
  fortnight: FortnightNumber
): FortnightSegment => {
  const mm = String(month1To12).padStart(2, '0');
  const lastDay = getDaysInMonth(year, month1To12);
  const startDay = fortnight === 1 ? 1 : 16;
  const endDay = fortnight === 1 ? 15 : lastDay;
  const quarter = Math.ceil(month1To12 / 3);
  const monthFull = MONTH_FULL_PT[month1To12 - 1] || mm;
  const monthShort = MONTH_SHORT_PT[month1To12 - 1] || mm;
  return {
    key: `${year}-${mm}-Q${fortnight}`,
    year,
    month: month1To12,
    fortnight,
    code: fortnight === 1 ? 'Q1' : 'Q2',
    monthKey: `${year}-${mm}`,
    quarterKey: `${year}-T${quarter}`,
    startIso: `${year}-${mm}-${String(startDay).padStart(2, '0')}`,
    endIso: `${year}-${mm}-${String(endDay).padStart(2, '0')}`,
    label: `${fortnight}ª Quinzena ${monthFull}/${year}`,
    shortLabel: `${fortnight}ª Q ${monthShort}/${String(year).slice(-2)}`
  };
};

export const diffDaysInclusiveIso = (startIso: string, endIso: string): number => {
  const s = parseIsoDateParts(startIso);
  const e = parseIsoDateParts(endIso);
  if (!s || !e) return 0;
  const t1 = Date.UTC(s.year, s.month - 1, s.day);
  const t2 = Date.UTC(e.year, e.month - 1, e.day);
  return Math.floor((t2 - t1) / 86400000) + 1;
};

export const enumerateFortnightSegments = (
  startIso: string,
  endIso: string,
  maxMonthsGuard = 120
): FortnightSegment[] => {
  const s = parseIsoDateParts(startIso);
  const e = parseIsoDateParts(endIso);
  if (!s || !e || s.isoDate > e.isoDate) return [];

  const segments: FortnightSegment[] = [];
  let year = s.year;
  let month = s.month;
  let guard = 0;

  while (
    (year < e.year || (year === e.year && month <= e.month)) &&
    guard < maxMonthsGuard
  ) {
    guard++;
    const q1 = buildFortnightSegment(year, month, 1);
    if (q1.startIso <= e.isoDate && q1.endIso >= s.isoDate) {
      segments.push(q1);
    }
    const q2 = buildFortnightSegment(year, month, 2);
    if (q2.startIso <= e.isoDate && q2.endIso >= s.isoDate) {
      segments.push(q2);
    }
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return segments;
};

// --- WINDOW CLASSIFICATION (SECTION 4) ---

export const classifyDeliveryWindow = (
  shipmentStartDate?: string | null,
  shipmentEndDate?: string | null
): ClassifiedDeliveryWindow => {
  const s = parseIsoDateParts(shipmentStartDate);
  const e = parseIsoDateParts(shipmentEndDate);

  if (!s || !e || s.isoDate > e.isoDate) {
    const exactDatesLabel =
      s && e
        ? `${formatDateBR(s.isoDate)} a ${formatDateBR(e.isoDate)} (inválido)`
        : s
        ? `${formatDateBR(s.isoDate)} (sem fim)`
        : e
        ? `(sem início) a ${formatDateBR(e.isoDate)}`
        : 'Datas não informadas';

    return {
      kind: 'INVALID_DATES',
      isValid: false,
      startIso: s?.isoDate || null,
      endIso: e?.isoDate || null,
      startParts: s,
      endParts: e,
      isNonStandardStartDay: false,
      isExactFortnight: false,
      isExactMonth: false,
      isExactQuarter: false,
      singleFortnightKey: null,
      singleMonthKey: null,
      singleQuarterKey: null,
      periodKey: '__INVALID_DATES__',
      periodLabel: 'Período inconsistente',
      periodShortLabel: 'Inconsistente',
      exactDatesLabel,
      calendarDays: 0
    };
  }

  const startQ = getFortnightOfDay(s.day);
  const endQ = getFortnightOfDay(e.day);
  const startSeg = buildFortnightSegment(s.year, s.month, startQ);
  const endSeg = buildFortnightSegment(e.year, e.month, endQ);
  const isNonStandardStartDay = s.day !== 1 && s.day !== 16;
  const calendarDays = diffDaysInclusiveIso(s.isoDate, e.isoDate);
  const exactDatesLabel = `${formatDateBR(s.isoDate)} a ${formatDateBR(e.isoDate)}`;

  // 4.1 Single Fortnight (same year, month, and fortnight)
  if (s.monthKey === e.monthKey && startQ === endQ) {
    return {
      kind: 'SINGLE_FORTNIGHT',
      isValid: true,
      startIso: s.isoDate,
      endIso: e.isoDate,
      startParts: s,
      endParts: e,
      isNonStandardStartDay,
      isExactFortnight: true,
      isExactMonth: true,
      isExactQuarter: true,
      singleFortnightKey: startSeg.key,
      singleMonthKey: s.monthKey,
      singleQuarterKey: s.quarterKey,
      periodKey: startSeg.key,
      periodLabel: startSeg.label,
      periodShortLabel: startSeg.shortLabel,
      exactDatesLabel,
      calendarDays
    };
  }

  // 4.2 Full Month (01..lastDay of same month) OR Intra-month window (e.g. 13/12..31/12)
  if (s.monthKey === e.monthKey) {
    const lastDay = getDaysInMonth(s.year, s.month);
    const isFullMonth = s.day === 1 && e.day === lastDay;
    const monthFull = MONTH_FULL_PT[s.month - 1] || String(s.month);
    const monthShort = MONTH_SHORT_PT[s.month - 1] || String(s.month);
    const yearShort = String(s.year).slice(-2);

    if (isFullMonth) {
      return {
        kind: 'FULL_MONTH',
        isValid: true,
        startIso: s.isoDate,
        endIso: e.isoDate,
        startParts: s,
        endParts: e,
        isNonStandardStartDay: false,
        isExactFortnight: false,
        isExactMonth: true,
        isExactQuarter: true,
        singleFortnightKey: null,
        singleMonthKey: s.monthKey,
        singleQuarterKey: s.quarterKey,
        periodKey: `${s.monthKey}-FULL`,
        periodLabel: `${monthFull}/${s.year} — Mês integral`,
        periodShortLabel: `${monthShort}/${yearShort} (Mês int.)`,
        exactDatesLabel,
        calendarDays
      };
    }

    // Intra-month window (spans Q1..Q2 without being full month, e.g. 13/12/2026..31/12/2026)
    return {
      kind: 'INTRA_MONTH_WINDOW',
      isValid: true,
      startIso: s.isoDate,
      endIso: e.isoDate,
      startParts: s,
      endParts: e,
      isNonStandardStartDay,
      isExactFortnight: false,
      isExactMonth: true,
      isExactQuarter: true,
      singleFortnightKey: null,
      singleMonthKey: s.monthKey,
      singleQuarterKey: s.quarterKey,
      periodKey: `WIN:${s.isoDate}..${e.isoDate}`,
      periodLabel: `${monthFull}/${s.year} (${exactDatesLabel})`,
      periodShortLabel: `${formatDateBR(s.isoDate).slice(0, 5)}–${formatDateBR(e.isoDate).slice(0, 5)}/${yearShort}`,
      exactDatesLabel,
      calendarDays
    };
  }

  // 4.3 Multi-month / Multi-fortnight Window
  const isSameQuarter = s.quarterKey === e.quarterKey;
  return {
    kind: 'MULTI_MONTH',
    isValid: true,
    startIso: s.isoDate,
    endIso: e.isoDate,
    startParts: s,
    endParts: e,
    isNonStandardStartDay,
    isExactFortnight: false,
    isExactMonth: false,
    isExactQuarter: isSameQuarter,
    singleFortnightKey: null,
    singleMonthKey: null,
    singleQuarterKey: isSameQuarter ? s.quarterKey : null,
    periodKey: `WIN:${startSeg.key}..${endSeg.key}`,
    periodLabel: `${startSeg.label} até ${endSeg.label}`,
    periodShortLabel: `${startSeg.shortLabel} → ${endSeg.shortLabel}`,
    exactDatesLabel,
    calendarDays
  };
};

// --- PROPORTIONAL FORTNIGHT SIMULATION WITH EXACT RECONCILIATION (SECTION 4.4) ---

const reconcileRoundedAmounts = (rawAmounts: number[], targetTotal: number): number[] => {
  if (rawAmounts.length === 0) return [];
  const scale = 100;
  const targetCents = Math.round(targetTotal * scale);
  const floors = rawAmounts.map((v) => Math.floor(v * scale + 1e-9));
  const currentSum = floors.reduce((acc, v) => acc + v, 0);
  const diff = targetCents - currentSum;

  const indexedRemainders = rawAmounts
    .map((v, idx) => ({ idx, rem: v * scale - floors[idx] }))
    .sort((a, b) => b.rem - a.rem);

  const adjusted = [...floors];
  if (diff > 0) {
    for (let i = 0; i < diff; i++) {
      const target = indexedRemainders[i % indexedRemainders.length];
      adjusted[target.idx] += 1;
    }
  } else if (diff < 0) {
    const asc = [...indexedRemainders].reverse();
    for (let i = 0; i < Math.abs(diff); i++) {
      const target = asc[i % asc.length];
      if (adjusted[target.idx] > 0) adjusted[target.idx] -= 1;
    }
  }

  return adjusted.map((c) => c / scale);
};

export const simulateFortnightDistribution = (
  window: ClassifiedDeliveryWindow,
  bags: number,
  unit: VolumeUnit
): SimulatedFortnightSlice[] => {
  if (!window.isValid || !window.startIso || !window.endIso || bags <= 0) return [];

  const segments = enumerateFortnightSegments(window.startIso, window.endIso);
  if (segments.length === 0) return [];

  const overlapDaysList = segments.map((seg) => {
    const segStart = seg.startIso > window.startIso! ? seg.startIso : window.startIso!;
    const segEnd = seg.endIso < window.endIso! ? seg.endIso : window.endIso!;
    return Math.max(1, diffDaysInclusiveIso(segStart, segEnd));
  });

  const totalOverlapDays = overlapDaysList.reduce((sum, d) => sum + d, 0);
  if (totalOverlapDays <= 0) return [];

  const rawBags = overlapDaysList.map((d) => (bags * d) / totalOverlapDays);
  const reconciledBags = reconcileRoundedAmounts(rawBags, bags);

  const targetUnitTotal = bagsToUnit(bags, unit);
  const rawUnit = overlapDaysList.map((d) => (targetUnitTotal * d) / totalOverlapDays);
  const reconciledUnit =
    unit === 'SCS' ? reconciledBags : reconcileRoundedAmounts(rawUnit, targetUnitTotal);

  return segments.map((seg, i) => ({
    segment: seg,
    overlapDays: overlapDaysList[i],
    weightPct: (overlapDaysList[i] / totalOverlapDays) * 100,
    bags: reconciledBags[i],
    volume: reconciledUnit[i]
  }));
};

// --- LOGISTICS STATUS CLASSIFIER (SECTION 6 & 9) ---

export const resolveLogisticsDeliveryStatus = (params: {
  window: ClassifiedDeliveryWindow;
  contractedBags: number;
  deliveredBags: number;
  hasShipmentRows: boolean;
  referenceDate: string;
  operationalCutoffDate: string;
}): LogisticsDeliveryStatus => {
  const {
    window,
    contractedBags,
    deliveredBags,
    hasShipmentRows,
    referenceDate,
    operationalCutoffDate
  } = params;

  if (!window.isValid || !window.startIso || !window.endIso) {
    return 'PERIODO_INCONSISTENTE';
  }

  if (contractedBags > 0 && deliveredBags >= contractedBags - 0.01) {
    return 'ENTREGA_CONCLUIDA';
  }

  const refDate = parseIsoDateParts(referenceDate)?.isoDate || getTodayIsoLocal();
  const cutoffDate = parseIsoDateParts(operationalCutoffDate)?.isoDate || '2026-01-01';
  const hasPartial = deliveredBags > 0.01 && deliveredBags < contractedBags - 0.01;

  // Past end date
  if (window.endIso < refDate) {
    if (hasPartial || hasShipmentRows) {
      return 'EM_ATRASO_CONFIRMADO';
    }
    // Zero deliveries recorded: distinguish historical untracked vs recent post-cutoff unconfirmed
    if (window.endIso < cutoffDate) {
      return 'SEM_ACOMPANHAMENTO_LOGISTICO';
    }
    return 'PRAZO_ENCERRADO_SEM_CONFIRMACAO';
  }

  // Within [startIso..endIso] or before startIso
  if (hasPartial) {
    return 'PARCIALMENTE_ENTREGUE';
  }

  if (window.startIso <= refDate && window.endIso >= refDate) {
    return 'EM_PERIODO_DE_ENTREGA';
  }

  return 'PROGRAMADO';
};

// --- BUILD BASE LOGISTICS ROWS ---

export const buildLogisticsRows = (
  enrichedContracts: EnrichedContract[],
  unit: VolumeUnit,
  referenceDate: string,
  operationalCutoffDate: string
): LogisticsContractRow[] => {
  const refParts = parseIsoDateParts(referenceDate) || parseIsoDateParts(getTodayIsoLocal())!;
  const refMs = Date.UTC(refParts.year, refParts.month - 1, refParts.day);

  return enrichedContracts.map((item) => {
    const c = item.contract;
    const window = classifyDeliveryWindow(c.shipmentStartDate, c.shipmentEndDate);
    const contractedBags = Math.max(0, Number(c.totalBags) || 0);
    const deliveredBags = Math.max(0, Number(item.logistics.knownShippedBags) || 0);
    const balanceBags = Math.max(0, contractedBags - deliveredBags);
    const excessBags = Math.max(0, deliveredBags - contractedBags);
    const deliveredPct = contractedBags > 0 ? Math.min(100, (deliveredBags / contractedBags) * 100) : 0;

    const deliverySource: LogisticsContractRow['deliverySource'] = item.logistics.hasShipmentRows
      ? 'SHIPMENTS_TABLE'
      : deliveredBags > 0
      ? 'CONTRACT_FALLBACK'
      : 'NONE';

    // Group actual shipments by delivery_date (never mixing with contractual schedule dates)
    const shipmentGroupMap = new Map<
      string,
      { bags: number; count: number; tickets: string[] }
    >();
    for (const s of item.logistics.shipments) {
      const dParts = parseIsoDateParts(s.deliveryDate || s.date);
      const iso = dParts?.isoDate || 'SEM_DATA';
      const bagsVal = Number(s.bagsCount) || (Number(s.weightKg) || 0) / 60;
      const cur = shipmentGroupMap.get(iso) || { bags: 0, count: 0, tickets: [] };
      cur.bags += bagsVal;
      cur.count += 1;
      if (s.ticketNumber) cur.tickets.push(s.ticketNumber);
      shipmentGroupMap.set(iso, cur);
    }

    const shipmentPoints: ShipmentTimelinePoint[] = Array.from(shipmentGroupMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([deliveryDate, meta]) => {
        const dp = parseIsoDateParts(deliveryDate);
        const q = dp ? getFortnightOfDay(dp.day) : 1;
        return {
          deliveryDate,
          monthKey: dp ? dp.monthKey : 'SEM_DATA',
          fortnightKey: dp ? `${dp.monthKey}-Q${q}` : 'SEM_DATA',
          bags: meta.bags,
          volume: bagsToUnit(meta.bags, unit),
          shipmentsCount: meta.count,
          ticketNumbers: meta.tickets
        };
      });

    const logisticsStatus = resolveLogisticsDeliveryStatus({
      window,
      contractedBags,
      deliveredBags,
      hasShipmentRows: item.logistics.hasShipmentRows,
      referenceDate: refParts.isoDate,
      operationalCutoffDate
    });

    let daysUntilEnd: number | null = null;
    let daysSinceEnd: number | null = null;
    if (window.isValid && window.endParts) {
      const endMs = Date.UTC(window.endParts.year, window.endParts.month - 1, window.endParts.day);
      const diff = Math.round((endMs - refMs) / 86400000);
      if (diff >= 0) daysUntilEnd = diff;
      else daysSinceEnd = Math.abs(diff);
    }

    return {
      contractId: c.id,
      contractNumber: c.number,
      closingDate: c.closingDate || c.createdAt,
      producerKey: item.producer.producerKey,
      producerId: item.producer.producerId,
      producerName: item.producer.displayName,
      producerDoc: item.producer.doc,
      farmName: item.farm.farmName,
      product: c.product,
      crop: c.crop,
      buyerName: c.buyerName || '-',
      freightType: c.freightType || 'FOB',
      pickupLocation: (c.pickupLocation || '').trim() || 'Local não informado',
      contractStatus: item.normalizedStatus,
      contractedBags,
      contractedVolume: bagsToUnit(contractedBags, unit),
      deliveredBags,
      deliveredVolume: bagsToUnit(deliveredBags, unit),
      balanceBags,
      balanceVolume: bagsToUnit(balanceBags, unit),
      excessBags,
      excessVolume: bagsToUnit(excessBags, unit),
      deliveredPct,
      deliverySource,
      hasLogisticsDiscrepancy: item.logistics.hasLogisticsDiscrepancy,
      shipmentsCount: item.logistics.shipmentsCount,
      shipmentPoints,
      window,
      logisticsStatus,
      logisticsStatusLabel: LOGISTICS_STATUS_LABELS[logisticsStatus],
      daysUntilEnd,
      daysSinceEnd
    };
  });
};

// --- INTERSECTION FILTERING (SECTION 10) ---

export const doesWindowIntersectFilters = (
  window: ClassifiedDeliveryWindow,
  filters: Pick<LogisticsFilterState, 'startDate' | 'endDate' | 'years' | 'months' | 'fortnights'>
): boolean => {
  const hasAnyPeriodFilter = Boolean(
    filters.startDate ||
      filters.endDate ||
      filters.years.length > 0 ||
      filters.months.length > 0 ||
      filters.fortnights.length > 0
  );

  if (!hasAnyPeriodFilter) return true;
  if (!window.isValid || !window.startIso || !window.endIso) return false;

  // Date range intersection: contractStart <= filterEnd && contractEnd >= filterStart
  if (filters.startDate && window.endIso < filters.startDate) return false;
  if (filters.endDate && window.startIso > filters.endDate) return false;

  const hasSegmentFilter =
    filters.years.length > 0 || filters.months.length > 0 || filters.fortnights.length > 0;
  if (!hasSegmentFilter) return true;

  const segments = enumerateFortnightSegments(window.startIso, window.endIso);
  if (segments.length === 0) return false;

  return segments.some((seg) => {
    if (filters.years.length > 0 && !filters.years.includes(String(seg.year))) return false;
    if (filters.months.length > 0 && !filters.months.includes(String(seg.month).padStart(2, '0'))) {
      return false;
    }
    if (filters.fortnights.length > 0 && !filters.fortnights.includes(seg.code)) return false;
    return true;
  });
};

export const filterLogisticsRows = (
  rows: LogisticsContractRow[],
  filters: LogisticsFilterState,
  economicGroups: EconomicGroup[] = []
): LogisticsContractRow[] => {
  const activeGroup = filters.economicGroupId
    ? economicGroups.find((g) => g.id === filters.economicGroupId)
    : undefined;
  const groupSet = activeGroup ? new Set(activeGroup.producerIds) : null;

  return rows.filter((row) => {
    if (filters.excludeCancelled && row.contractStatus === 'Cancelado') return false;
    if (filters.contractStatuses.length > 0 && !filters.contractStatuses.includes(row.contractStatus)) {
      return false;
    }
    if (filters.deliveryStatuses.length > 0 && !filters.deliveryStatuses.includes(row.logisticsStatus)) {
      return false;
    }
    if (filters.products.length > 0 && !filters.products.includes(row.product)) return false;
    if (filters.crops.length > 0 && !filters.crops.includes(row.crop)) return false;
    if (filters.producerKeys.length > 0 && !filters.producerKeys.includes(row.producerKey)) {
      return false;
    }
    if (groupSet && (!row.producerId || !groupSet.has(row.producerId))) return false;
    if (filters.farmNames.length > 0 && !filters.farmNames.includes(row.farmName)) return false;
    if (filters.pickupLocations.length > 0 && !filters.pickupLocations.includes(row.pickupLocation)) {
      return false;
    }
    if (filters.freightTypes.length > 0 && !filters.freightTypes.includes(row.freightType)) {
      return false;
    }
    if (!doesWindowIntersectFilters(row.window, filters)) return false;
    return true;
  });
};

// --- KPIs, HORIZONS (SECTION 8) & SUMMARY BREAKDOWNS ---

export interface LogisticsHorizonCard {
  days: 15 | 30 | 60 | 90;
  horizonEndDate: string;
  contractsCount: number;
  definedVolume: number; // Single fortnight or window fully inside [ref..horizonEnd]
  coincidentVolume: number; // Multi-period window overlapping [ref..horizonEnd] without full containment
  totalOverlappingVolume: number;
  fobVolume: number;
  cifVolume: number;
  contractIds: string[];
}

export interface LogisticsBreakdownItem {
  key: string;
  label: string;
  contractsCount: number;
  contractedVolume: number;
  deliveredVolume: number;
  balanceVolume: number;
  fobVolume: number;
  cifVolume: number;
  contractIds: string[];
}

export interface LogisticsPeriodChartItem {
  key: string;
  label: string;
  definedVolume: number;
  openWindowVolume: number;
  totalVolume: number;
  simulatedVolume: number;
  contractIds: string[];
}

export interface LogisticsAnalyticsSummary {
  rows: LogisticsContractRow[];
  contractsCount: number;
  producersCount: number;
  totalContracted: number;
  totalDelivered: number;
  totalBalance: number;
  totalExcess: number;
  definedFortnightContracted: number;
  fullMonthContracted: number;
  openWindowContracted: number;
  invalidDatesContracted: number;
  invalidDatesCount: number;
  nonStandardStartCount: number;
  fobContracted: number;
  cifContracted: number;
  fobBalance: number;
  cifBalance: number;
  contractsWithShipments: number;
  contractsFallbackDelivered: number;
  statusCounts: Record<LogisticsDeliveryStatus, { count: number; contracted: number; balance: number }>;
  horizons: LogisticsHorizonCard[];
  byPeriodChart: LogisticsPeriodChartItem[];
  byProduct: LogisticsBreakdownItem[];
  byProducer: LogisticsBreakdownItem[];
  byPickupLocation: LogisticsBreakdownItem[];
  byFreight: LogisticsBreakdownItem[];
  shipmentTimeline: Array<{
    monthKey: string;
    label: string;
    deliveredVolume: number;
    shipmentsCount: number;
    contractsCount: number;
  }>;
  alerts: {
    overdueConfirmed: LogisticsContractRow[];
    pastEndUnconfirmed: LogisticsContractRow[];
    endingSoon15d: LogisticsContractRow[];
    inconsistentDates: LogisticsContractRow[];
    discrepancyRows: LogisticsContractRow[];
  };
}

export const buildLogisticsAnalyticsSummary = (
  rows: LogisticsContractRow[],
  unit: VolumeUnit,
  referenceDate: string,
  simulateDistribution: boolean
): LogisticsAnalyticsSummary => {
  const refIso = parseIsoDateParts(referenceDate)?.isoDate || getTodayIsoLocal();

  let totalContracted = 0;
  let totalDelivered = 0;
  let totalBalance = 0;
  let totalExcess = 0;
  let definedFortnightContracted = 0;
  let fullMonthContracted = 0;
  let openWindowContracted = 0;
  let invalidDatesContracted = 0;
  let invalidDatesCount = 0;
  let nonStandardStartCount = 0;
  let fobContracted = 0;
  let cifContracted = 0;
  let fobBalance = 0;
  let cifBalance = 0;
  let contractsWithShipments = 0;
  let contractsFallbackDelivered = 0;

  const producersSet = new Set<string>();
  const statusCounts = {} as Record<
    LogisticsDeliveryStatus,
    { count: number; contracted: number; balance: number }
  >;
  for (const st of LOGISTICS_STATUS_ORDER) {
    statusCounts[st] = { count: 0, contracted: 0, balance: 0 };
  }

  const productMap = new Map<string, LogisticsBreakdownItem>();
  const producerMap = new Map<string, LogisticsBreakdownItem>();
  const pickupMap = new Map<string, LogisticsBreakdownItem>();
  const freightMap = new Map<string, LogisticsBreakdownItem>();
  const periodChartMap = new Map<
    string,
    {
      key: string;
      label: string;
      definedVolume: number;
      openWindowVolume: number;
      simulatedVolume: number;
      contractIds: Set<string>;
    }
  >();
  const shipmentMonthMap = new Map<
    string,
    { monthKey: string; deliveredVolume: number; shipmentsCount: number; contractIds: Set<string> }
  >();

  const upsertBreakdown = (
    map: Map<string, LogisticsBreakdownItem>,
    key: string,
    label: string,
    row: LogisticsContractRow
  ) => {
    const cur = map.get(key) || {
      key,
      label,
      contractsCount: 0,
      contractedVolume: 0,
      deliveredVolume: 0,
      balanceVolume: 0,
      fobVolume: 0,
      cifVolume: 0,
      contractIds: []
    };
    cur.contractsCount += 1;
    cur.contractedVolume += row.contractedVolume;
    cur.deliveredVolume += row.deliveredVolume;
    cur.balanceVolume += row.balanceVolume;
    if (row.freightType === 'FOB') cur.fobVolume += row.contractedVolume;
    else cur.cifVolume += row.contractedVolume;
    cur.contractIds.push(row.contractId);
    map.set(key, cur);
  };

  for (const row of rows) {
    producersSet.add(row.producerKey);
    totalContracted += row.contractedVolume;
    totalDelivered += row.deliveredVolume;
    totalBalance += row.balanceVolume;
    totalExcess += row.excessVolume;

    if (row.window.kind === 'SINGLE_FORTNIGHT') {
      definedFortnightContracted += row.contractedVolume;
    } else if (row.window.kind === 'FULL_MONTH') {
      fullMonthContracted += row.contractedVolume;
    } else if (row.window.kind === 'INVALID_DATES') {
      invalidDatesContracted += row.contractedVolume;
      invalidDatesCount += 1;
    } else {
      openWindowContracted += row.contractedVolume;
    }

    if (row.window.isNonStandardStartDay) nonStandardStartCount += 1;
    if (row.freightType === 'FOB') {
      fobContracted += row.contractedVolume;
      fobBalance += row.balanceVolume;
    } else {
      cifContracted += row.contractedVolume;
      cifBalance += row.balanceVolume;
    }

    if (row.deliverySource === 'SHIPMENTS_TABLE') contractsWithShipments += 1;
    else if (row.deliverySource === 'CONTRACT_FALLBACK') contractsFallbackDelivered += 1;

    statusCounts[row.logisticsStatus].count += 1;
    statusCounts[row.logisticsStatus].contracted += row.contractedVolume;
    statusCounts[row.logisticsStatus].balance += row.balanceVolume;

    upsertBreakdown(productMap, row.product, row.product, row);
    upsertBreakdown(producerMap, row.producerKey, row.producerName, row);
    upsertBreakdown(pickupMap, row.pickupLocation, row.pickupLocation, row);
    upsertBreakdown(freightMap, row.freightType, row.freightType, row);

    if (row.window.isValid) {
      if (simulateDistribution) {
        const slices = simulateFortnightDistribution(row.window, row.contractedBags, unit);
        for (const sl of slices) {
          const cur = periodChartMap.get(sl.segment.monthKey) || {
            key: sl.segment.monthKey,
            label: formatMonthLabel(sl.segment.monthKey),
            definedVolume: 0,
            openWindowVolume: 0,
            simulatedVolume: 0,
            contractIds: new Set<string>()
          };
          cur.simulatedVolume += sl.volume;
          cur.contractIds.add(row.contractId);
          periodChartMap.set(sl.segment.monthKey, cur);
        }
      } else {
        const startMonthKey = row.window.startParts!.monthKey;
        const cur = periodChartMap.get(startMonthKey) || {
          key: startMonthKey,
          label: formatMonthLabel(startMonthKey),
          definedVolume: 0,
          openWindowVolume: 0,
          simulatedVolume: 0,
          contractIds: new Set<string>()
        };
        if (row.window.isExactMonth) cur.definedVolume += row.contractedVolume;
        else cur.openWindowVolume += row.contractedVolume;
        cur.contractIds.add(row.contractId);
        periodChartMap.set(startMonthKey, cur);
      }
    }

    for (const sp of row.shipmentPoints) {
      if (sp.monthKey === 'SEM_DATA') continue;
      const cur = shipmentMonthMap.get(sp.monthKey) || {
        monthKey: sp.monthKey,
        deliveredVolume: 0,
        shipmentsCount: 0,
        contractIds: new Set<string>()
      };
      cur.deliveredVolume += sp.volume;
      cur.shipmentsCount += sp.shipmentsCount;
      cur.contractIds.add(row.contractId);
      shipmentMonthMap.set(sp.monthKey, cur);
    }
  }

  // Cumulative Future Horizons (15, 30, 60, 90 days from referenceDate)
  const horizons: LogisticsHorizonCard[] = ([15, 30, 60, 90] as const).map((days) => {
    const horizonEndDate = addDaysIso(refIso, days) || refIso;
    let definedVolume = 0;
    let coincidentVolume = 0;
    let fobVolume = 0;
    let cifVolume = 0;
    const contractIds: string[] = [];

    for (const row of rows) {
      if (!row.window.isValid || !row.window.startIso || !row.window.endIso) continue;
      if (row.balanceBags <= 0.01) continue;
      // Overlapping with [refIso..horizonEndDate]
      if (row.window.startIso <= horizonEndDate && row.window.endIso >= refIso) {
        const isStrictlyContainedOrExact =
          row.window.kind === 'SINGLE_FORTNIGHT' || row.window.endIso <= horizonEndDate;
        if (isStrictlyContainedOrExact) {
          definedVolume += row.balanceVolume;
        } else {
          coincidentVolume += row.balanceVolume;
        }
        if (row.freightType === 'FOB') fobVolume += row.balanceVolume;
        else cifVolume += row.balanceVolume;
        contractIds.push(row.contractId);
      }
    }

    return {
      days,
      horizonEndDate,
      contractsCount: contractIds.length,
      definedVolume,
      coincidentVolume,
      totalOverlappingVolume: definedVolume + coincidentVolume,
      fobVolume,
      cifVolume,
      contractIds
    };
  });

  const sortBreakdown = (map: Map<string, LogisticsBreakdownItem>) =>
    Array.from(map.values()).sort((a, b) => b.contractedVolume - a.contractedVolume);

  const byPeriodChart: LogisticsPeriodChartItem[] = Array.from(periodChartMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => ({
      key: m.key,
      label: m.label,
      definedVolume: m.definedVolume,
      openWindowVolume: m.openWindowVolume,
      totalVolume: simulateDistribution ? m.simulatedVolume : m.definedVolume + m.openWindowVolume,
      simulatedVolume: m.simulatedVolume,
      contractIds: Array.from(m.contractIds)
    }));

  const shipmentTimeline = Array.from(shipmentMonthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => ({
      monthKey: m.monthKey,
      label: formatMonthLabel(m.monthKey),
      deliveredVolume: m.deliveredVolume,
      shipmentsCount: m.shipmentsCount,
      contractsCount: m.contractIds.size
    }));

  const alerts = {
    overdueConfirmed: rows
      .filter((r) => r.logisticsStatus === 'EM_ATRASO_CONFIRMADO')
      .sort((a, b) => (b.daysSinceEnd || 0) - (a.daysSinceEnd || 0)),
    pastEndUnconfirmed: rows
      .filter((r) => r.logisticsStatus === 'PRAZO_ENCERRADO_SEM_CONFIRMACAO')
      .sort((a, b) => (b.daysSinceEnd || 0) - (a.daysSinceEnd || 0)),
    endingSoon15d: rows
      .filter(
        (r) =>
          r.window.isValid &&
          r.balanceBags > 0.01 &&
          r.daysUntilEnd !== null &&
          r.daysUntilEnd >= 0 &&
          r.daysUntilEnd <= 15
      )
      .sort((a, b) => (a.daysUntilEnd || 0) - (b.daysUntilEnd || 0)),
    inconsistentDates: rows.filter((r) => r.logisticsStatus === 'PERIODO_INCONSISTENTE'),
    discrepancyRows: rows.filter((r) => r.hasLogisticsDiscrepancy)
  };

  return {
    rows,
    contractsCount: rows.length,
    producersCount: producersSet.size,
    totalContracted,
    totalDelivered,
    totalBalance,
    totalExcess,
    definedFortnightContracted,
    fullMonthContracted,
    openWindowContracted,
    invalidDatesContracted,
    invalidDatesCount,
    nonStandardStartCount,
    fobContracted,
    cifContracted,
    fobBalance,
    cifBalance,
    contractsWithShipments,
    contractsFallbackDelivered,
    statusCounts,
    horizons,
    byPeriodChart,
    byProduct: sortBreakdown(productMap),
    byProducer: sortBreakdown(producerMap),
    byPickupLocation: sortBreakdown(pickupMap),
    byFreight: sortBreakdown(freightMap),
    shipmentTimeline,
    alerts
  };
};

// --- DYNAMIC SYNTHETIC PIVOT MATRIX (SECTION 5.1) ---

export type LogisticsMatrixRowDim =
  | 'PRODUCER'
  | 'GROUP'
  | 'FARM'
  | 'PRODUCT'
  | 'CROP'
  | 'PICKUP_LOCATION'
  | 'FREIGHT_TYPE';

export type LogisticsMatrixColDim =
  | 'CONTRACTED_PERIOD'
  | 'FORTNIGHT'
  | 'MONTH'
  | 'QUARTER';

export type LogisticsMatrixMetric = 'CONTRACTED' | 'DELIVERED' | 'BALANCE';

export interface LogisticsMatrixCell {
  value: number;
  contractsCount: number;
  contractIds: string[];
  isSimulated: boolean;
}

export interface LogisticsMatrixColumn {
  key: string;
  label: string;
  subLabel?: string;
  sortKey: string;
  isDefinedSchedule: boolean;
  isSpecialBucket: boolean;
}

export interface LogisticsMatrixRow {
  key: string;
  label: string;
  cells: Record<string, LogisticsMatrixCell>;
  definedTotal: number;
  openWindowTotal: number;
  invalidTotal: number;
  total: number;
  sharePct: number;
  contractIds: string[];
}

export interface LogisticsMatrixResult {
  columns: LogisticsMatrixColumn[];
  rows: LogisticsMatrixRow[];
  colTotals: Record<string, number>;
  grandDefinedTotal: number;
  grandOpenWindowTotal: number;
  grandInvalidTotal: number;
  grandTotal: number;
  isSimulated: boolean;
}

export const buildLogisticsSyntheticMatrix = (params: {
  rows: LogisticsContractRow[];
  rowDim: LogisticsMatrixRowDim;
  colDim: LogisticsMatrixColDim;
  metric: LogisticsMatrixMetric;
  unit: VolumeUnit;
  simulateDistribution: boolean;
  consolidatedLabel: string;
}): LogisticsMatrixResult => {
  const { rows, rowDim, colDim, metric, unit, simulateDistribution, consolidatedLabel } = params;

  const getMetricBags = (r: LogisticsContractRow) => {
    if (metric === 'DELIVERED') return r.deliveredBags;
    if (metric === 'BALANCE') return r.balanceBags;
    return r.contractedBags;
  };
  const getMetricValue = (r: LogisticsContractRow) => {
    if (metric === 'DELIVERED') return r.deliveredVolume;
    if (metric === 'BALANCE') return r.balanceVolume;
    return r.contractedVolume;
  };

  const getRowInfo = (r: LogisticsContractRow): { key: string; label: string } => {
    switch (rowDim) {
      case 'PRODUCER':
        return { key: r.producerKey, label: r.producerName };
      case 'GROUP':
        return { key: consolidatedLabel, label: consolidatedLabel };
      case 'FARM':
        return { key: r.farmName, label: r.farmName };
      case 'PRODUCT':
        return { key: r.product, label: r.product };
      case 'CROP':
        return { key: r.crop || 'Sem safra', label: r.crop ? `Safra ${r.crop}` : 'Sem safra' };
      case 'PICKUP_LOCATION':
        return { key: r.pickupLocation, label: r.pickupLocation };
      case 'FREIGHT_TYPE':
        return { key: r.freightType, label: r.freightType };
    }
  };

  const colDefMap = new Map<string, LogisticsMatrixColumn>();
  const rowMap = new Map<
    string,
    {
      key: string;
      label: string;
      cells: Record<string, { value: number; contractIds: Set<string>; isSimulated: boolean }>;
      definedTotal: number;
      openWindowTotal: number;
      invalidTotal: number;
      total: number;
      contractIds: Set<string>;
    }
  >();

  const ensureCol = (col: LogisticsMatrixColumn) => {
    if (!colDefMap.has(col.key)) {
      colDefMap.set(col.key, col);
    }
  };

  const addCell = (
    rowKey: string,
    rowLabel: string,
    col: LogisticsMatrixColumn,
    val: number,
    contractId: string,
    isSimulated: boolean,
    bucketType: 'DEFINED' | 'OPEN' | 'INVALID'
  ) => {
    ensureCol(col);
    let rEntry = rowMap.get(rowKey);
    if (!rEntry) {
      rEntry = {
        key: rowKey,
        label: rowLabel,
        cells: {},
        definedTotal: 0,
        openWindowTotal: 0,
        invalidTotal: 0,
        total: 0,
        contractIds: new Set<string>()
      };
      rowMap.set(rowKey, rEntry);
    }
    if (!rEntry.cells[col.key]) {
      rEntry.cells[col.key] = { value: 0, contractIds: new Set<string>(), isSimulated };
    }
    rEntry.cells[col.key].value += val;
    rEntry.cells[col.key].contractIds.add(contractId);
    rEntry.cells[col.key].isSimulated = rEntry.cells[col.key].isSimulated || isSimulated;
    rEntry.total += val;
    if (bucketType === 'DEFINED') rEntry.definedTotal += val;
    else if (bucketType === 'OPEN') rEntry.openWindowTotal += val;
    else rEntry.invalidTotal += val;
    rEntry.contractIds.add(contractId);
  };

  const applySimulation =
    simulateDistribution &&
    (colDim === 'FORTNIGHT' || colDim === 'MONTH' || colDim === 'QUARTER');

  for (const r of rows) {
    const { key: rowKey, label: rowLabel } = getRowInfo(r);
    const val = getMetricValue(r);
    const bags = getMetricBags(r);

    if (!r.window.isValid) {
      addCell(
        rowKey,
        rowLabel,
        {
          key: '__INVALID_DATES__',
          label: 'Período inconsistente',
          sortKey: '9999-99-Z',
          isDefinedSchedule: false,
          isSpecialBucket: true
        },
        val,
        r.contractId,
        false,
        'INVALID'
      );
      continue;
    }

    if (colDim === 'CONTRACTED_PERIOD') {
      const isDefined = r.window.kind === 'SINGLE_FORTNIGHT' || r.window.kind === 'FULL_MONTH';
      addCell(
        rowKey,
        rowLabel,
        {
          key: r.window.periodKey,
          label: r.window.periodShortLabel,
          subLabel: r.window.exactDatesLabel,
          sortKey: `0-${r.window.startIso}-${r.window.endIso}`,
          isDefinedSchedule: isDefined,
          isSpecialBucket: false
        },
        val,
        r.contractId,
        false,
        isDefined ? 'DEFINED' : 'OPEN'
      );
      continue;
    }

    if (applySimulation) {
      const slices = simulateFortnightDistribution(r.window, bags, unit);
      if (slices.length === 0) {
        addCell(
          rowKey,
          rowLabel,
          {
            key: '__OPEN_WINDOW__',
            label: 'Sem distribuição',
            sortKey: '9998-00-Z',
            isDefinedSchedule: false,
            isSpecialBucket: true
          },
          val,
          r.contractId,
          false,
          'OPEN'
        );
        continue;
      }

      if (colDim === 'FORTNIGHT') {
        for (const sl of slices) {
          addCell(
            rowKey,
            rowLabel,
            {
              key: sl.segment.key,
              label: sl.segment.shortLabel,
              subLabel: `${formatDateBR(sl.segment.startIso)}–${formatDateBR(sl.segment.endIso)}`,
              sortKey: `0-${sl.segment.key}`,
              isDefinedSchedule: r.window.isExactFortnight,
              isSpecialBucket: false
            },
            sl.volume,
            r.contractId,
            !r.window.isExactFortnight,
            'DEFINED'
          );
        }
      } else if (colDim === 'MONTH') {
        const monthBuckets = new Map<string, number>();
        for (const sl of slices) {
          monthBuckets.set(sl.segment.monthKey, (monthBuckets.get(sl.segment.monthKey) || 0) + sl.volume);
        }
        for (const [mk, mVal] of monthBuckets.entries()) {
          addCell(
            rowKey,
            rowLabel,
            {
              key: mk,
              label: formatMonthLabel(mk),
              sortKey: `0-${mk}`,
              isDefinedSchedule: r.window.isExactMonth,
              isSpecialBucket: false
            },
            mVal,
            r.contractId,
            !r.window.isExactMonth,
            'DEFINED'
          );
        }
      } else {
        const quarterBuckets = new Map<string, number>();
        for (const sl of slices) {
          quarterBuckets.set(
            sl.segment.quarterKey,
            (quarterBuckets.get(sl.segment.quarterKey) || 0) + sl.volume
          );
        }
        for (const [qk, qVal] of quarterBuckets.entries()) {
          addCell(
            rowKey,
            rowLabel,
            {
              key: qk,
              label: qk.replace('-T', ' · T'),
              sortKey: `0-${qk}`,
              isDefinedSchedule: r.window.isExactQuarter,
              isSpecialBucket: false
            },
            qVal,
            r.contractId,
            !r.window.isExactQuarter,
            'DEFINED'
          );
        }
      }
      continue;
    }

    // ORIGINAL (UNSIMULATED) MODE — NEVER SPLIT OR DUPLICATE
    if (colDim === 'FORTNIGHT') {
      if (r.window.kind === 'SINGLE_FORTNIGHT' && r.window.singleFortnightKey) {
        const seg = buildFortnightSegment(
          r.window.startParts!.year,
          r.window.startParts!.month,
          getFortnightOfDay(r.window.startParts!.day)
        );
        addCell(
          rowKey,
          rowLabel,
          {
            key: seg.key,
            label: seg.shortLabel,
            subLabel: `${formatDateBR(seg.startIso)}–${formatDateBR(seg.endIso)}`,
            sortKey: `0-${seg.key}`,
            isDefinedSchedule: true,
            isSpecialBucket: false
          },
          val,
          r.contractId,
          false,
          'DEFINED'
        );
      } else if (r.window.kind === 'FULL_MONTH') {
        addCell(
          rowKey,
          rowLabel,
          {
            key: r.window.periodKey,
            label: r.window.periodShortLabel,
            subLabel: 'Mês integral (sem divisão 50/50)',
            sortKey: `1-${r.window.singleMonthKey}`,
            isDefinedSchedule: false,
            isSpecialBucket: true
          },
          val,
          r.contractId,
          false,
          'OPEN'
        );
      } else {
        addCell(
          rowKey,
          rowLabel,
          {
            key: '__OPEN_MULTI_FORTNIGHT__',
            label: 'Janelas abertas / Múltiplas Q.',
            subLabel: 'Sem divisão automática por quinzena',
            sortKey: '9990-00-A',
            isDefinedSchedule: false,
            isSpecialBucket: true
          },
          val,
          r.contractId,
          false,
          'OPEN'
        );
      }
    } else if (colDim === 'MONTH') {
      if (r.window.isExactMonth && r.window.singleMonthKey) {
        addCell(
          rowKey,
          rowLabel,
          {
            key: r.window.singleMonthKey,
            label: formatMonthLabel(r.window.singleMonthKey),
            sortKey: `0-${r.window.singleMonthKey}`,
            isDefinedSchedule: true,
            isSpecialBucket: false
          },
          val,
          r.contractId,
          false,
          'DEFINED'
        );
      } else {
        addCell(
          rowKey,
          rowLabel,
          {
            key: '__OPEN_MULTI_MONTH__',
            label: 'Janelas multimês',
            subLabel: 'Período abrangendo 2+ meses',
            sortKey: '9990-00-A',
            isDefinedSchedule: false,
            isSpecialBucket: true
          },
          val,
          r.contractId,
          false,
          'OPEN'
        );
      }
    } else {
      // QUARTER
      if (r.window.isExactQuarter && r.window.singleQuarterKey) {
        addCell(
          rowKey,
          rowLabel,
          {
            key: r.window.singleQuarterKey,
            label: r.window.singleQuarterKey.replace('-T', ' · T'),
            sortKey: `0-${r.window.singleQuarterKey}`,
            isDefinedSchedule: true,
            isSpecialBucket: false
          },
          val,
          r.contractId,
          false,
          'DEFINED'
        );
      } else {
        addCell(
          rowKey,
          rowLabel,
          {
            key: '__OPEN_MULTI_QUARTER__',
            label: 'Janelas multitrimestre',
            subLabel: 'Período abrangendo 2+ trimestres',
            sortKey: '9990-00-A',
            isDefinedSchedule: false,
            isSpecialBucket: true
          },
          val,
          r.contractId,
          false,
          'OPEN'
        );
      }
    }
  }

  const columns = Array.from(colDefMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const colTotals: Record<string, number> = {};
  for (const c of columns) colTotals[c.key] = 0;

  let grandTotal = 0;
  let grandDefinedTotal = 0;
  let grandOpenWindowTotal = 0;
  let grandInvalidTotal = 0;

  const rawRows = Array.from(rowMap.values());
  for (const r of rawRows) {
    grandTotal += r.total;
    grandDefinedTotal += r.definedTotal;
    grandOpenWindowTotal += r.openWindowTotal;
    grandInvalidTotal += r.invalidTotal;
    for (const c of columns) {
      const cellVal = r.cells[c.key]?.value || 0;
      colTotals[c.key] = (colTotals[c.key] || 0) + cellVal;
    }
  }

  const matrixRows: LogisticsMatrixRow[] = rawRows
    .map((r) => {
      const serializedCells: Record<string, LogisticsMatrixCell> = {};
      for (const c of columns) {
        const rawCell = r.cells[c.key];
        if (rawCell) {
          serializedCells[c.key] = {
            value: rawCell.value,
            contractsCount: rawCell.contractIds.size,
            contractIds: Array.from(rawCell.contractIds),
            isSimulated: rawCell.isSimulated
          };
        }
      }
      return {
        key: r.key,
        label: r.label,
        cells: serializedCells,
        definedTotal: r.definedTotal,
        openWindowTotal: r.openWindowTotal,
        invalidTotal: r.invalidTotal,
        total: r.total,
        sharePct: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
        contractIds: Array.from(r.contractIds)
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    columns,
    rows: matrixRows,
    colTotals,
    grandDefinedTotal,
    grandOpenWindowTotal,
    grandInvalidTotal,
    grandTotal,
    isSimulated: applySimulation
  };
};

// --- TIMELINE / GANTT BUILDER (SECTION 5.2) ---

export interface LogisticsGanttMonthGroup {
  monthKey: string;
  label: string;
  segmentCount: number;
}

export interface LogisticsGanttBarItem {
  row: LogisticsContractRow;
  startSlotIndex: number;
  endSlotIndex: number;
  spanSlots: number;
}

export interface LogisticsGanttData {
  segments: FortnightSegment[];
  monthGroups: LogisticsGanttMonthGroup[];
  items: LogisticsGanttBarItem[];
  invalidItems: LogisticsContractRow[];
}

export const buildLogisticsGanttData = (rows: LogisticsContractRow[]): LogisticsGanttData => {
  const validRows = rows.filter((r) => r.window.isValid && r.window.startIso && r.window.endIso);
  const invalidItems = rows.filter((r) => !r.window.isValid);

  if (validRows.length === 0) {
    return { segments: [], monthGroups: [], items: [], invalidItems };
  }

  let minStart = validRows[0].window.startIso!;
  let maxEnd = validRows[0].window.endIso!;
  for (const r of validRows) {
    if (r.window.startIso! < minStart) minStart = r.window.startIso!;
    if (r.window.endIso! > maxEnd) maxEnd = r.window.endIso!;
  }

  const segments = enumerateFortnightSegments(minStart, maxEnd, 120);
  const segIndexByKey = new Map<string, number>();
  segments.forEach((seg, idx) => segIndexByKey.set(seg.key, idx));

  const monthGroups: LogisticsGanttMonthGroup[] = [];
  for (const seg of segments) {
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.monthKey === seg.monthKey) {
      last.segmentCount += 1;
    } else {
      monthGroups.push({
        monthKey: seg.monthKey,
        label: formatMonthLabel(seg.monthKey),
        segmentCount: 1
      });
    }
  }

  const items: LogisticsGanttBarItem[] = [];
  const sortedValid = [...validRows].sort((a, b) => {
    const prodCmp = a.producerName.localeCompare(b.producerName, 'pt-BR', { sensitivity: 'base' });
    if (prodCmp !== 0) return prodCmp;
    const farmCmp = a.farmName.localeCompare(b.farmName, 'pt-BR', { sensitivity: 'base' });
    if (farmCmp !== 0) return farmCmp;
    return a.window.startIso!.localeCompare(b.window.startIso!);
  });

  for (const row of sortedValid) {
    const sParts = row.window.startParts!;
    const eParts = row.window.endParts!;
    const startKey = `${sParts.monthKey}-Q${getFortnightOfDay(sParts.day)}`;
    const endKey = `${eParts.monthKey}-Q${getFortnightOfDay(eParts.day)}`;
    const startIdx = segIndexByKey.get(startKey);
    const endIdx = segIndexByKey.get(endKey);
    if (startIdx !== undefined && endIdx !== undefined) {
      items.push({
        row,
        startSlotIndex: startIdx,
        endSlotIndex: Math.max(startIdx, endIdx),
        spanSlots: Math.max(1, endIdx - startIdx + 1)
      });
    }
  }

  return { segments, monthGroups, items, invalidItems };
};

// --- STRICTLY ISOLATED PRODUCER LOGISTICS VIEW (SECTIONS 2 & 12) ---

export interface ProducerLogisticsScheduleRow {
  periodKey: string;
  periodLabel: string;
  exactDatesLabel: string;
  isExactSchedule: boolean;
  contractsCount: number;
  contractedVolume: number;
  deliveredVolume: number;
  balanceVolume: number;
  fobVolume: number;
  cifVolume: number;
}

export interface ProducerLogisticsExternalView {
  targetTitle: string;
  targetDocs: string;
  referenceDate: string;
  unit: VolumeUnit;
  contractsCount: number;
  totalContracted: number;
  totalDelivered: number;
  totalBalance: number;
  totalExcess: number;
  deliveredPct: number;
  fobContracted: number;
  cifContracted: number;
  horizons: LogisticsHorizonCard[];
  scheduleRows: ProducerLogisticsScheduleRow[];
  byProductAndCrop: Array<{
    key: string;
    product: string;
    crop: string;
    contractsCount: number;
    contractedVolume: number;
    deliveredVolume: number;
    balanceVolume: number;
  }>;
  byFarm: Array<{
    key: string;
    farmName: string;
    pickupLocation: string;
    contractsCount: number;
    contractedVolume: number;
    deliveredVolume: number;
    balanceVolume: number;
  }>;
  gantt: LogisticsGanttData;
  contracts: Array<{
    contractId: string;
    contractNumber: string;
    closingDate: string;
    product: string;
    crop: string;
    farmName: string;
    pickupLocation: string;
    freightType: FreightType;
    buyerName: string;
    periodLabel: string;
    exactDatesLabel: string;
    contractedVolume: number;
    deliveredVolume: number;
    balanceVolume: number;
    deliveredPct: number;
    logisticsStatusLabel: string;
    logisticsStatus: LogisticsDeliveryStatus;
  }>;
}

export const buildProducerLogisticsExternalView = (params: {
  scopedRows: LogisticsContractRow[];
  targetTitle: string;
  targetDocs: string;
  unit: VolumeUnit;
  referenceDate: string;
}): ProducerLogisticsExternalView => {
  const { scopedRows, targetTitle, targetDocs, unit, referenceDate } = params;
  const summary = buildLogisticsAnalyticsSummary(scopedRows, unit, referenceDate, false);

  const scheduleMap = new Map<
    string,
    ProducerLogisticsScheduleRow & { sortKey: string }
  >();
  const productCropMap = new Map<
    string,
    {
      key: string;
      product: string;
      crop: string;
      contractsCount: number;
      contractedVolume: number;
      deliveredVolume: number;
      balanceVolume: number;
    }
  >();
  const farmMap = new Map<
    string,
    {
      key: string;
      farmName: string;
      pickupLocation: string;
      contractsCount: number;
      contractedVolume: number;
      deliveredVolume: number;
      balanceVolume: number;
    }
  >();

  for (const r of scopedRows) {
    const pKey = r.window.periodKey;
    const curSched = scheduleMap.get(pKey) || {
      periodKey: pKey,
      periodLabel: r.window.periodLabel,
      exactDatesLabel: r.window.exactDatesLabel,
      isExactSchedule: r.window.isExactFortnight || r.window.isExactMonth,
      contractsCount: 0,
      contractedVolume: 0,
      deliveredVolume: 0,
      balanceVolume: 0,
      fobVolume: 0,
      cifVolume: 0,
      sortKey: r.window.isValid ? `0-${r.window.startIso}-${r.window.endIso}` : '9-INVALID'
    };
    curSched.contractsCount += 1;
    curSched.contractedVolume += r.contractedVolume;
    curSched.deliveredVolume += r.deliveredVolume;
    curSched.balanceVolume += r.balanceVolume;
    if (r.freightType === 'FOB') curSched.fobVolume += r.contractedVolume;
    else curSched.cifVolume += r.contractedVolume;
    scheduleMap.set(pKey, curSched);

    const pcKey = `${r.product}__${r.crop}`;
    const curPc = productCropMap.get(pcKey) || {
      key: pcKey,
      product: r.product,
      crop: r.crop,
      contractsCount: 0,
      contractedVolume: 0,
      deliveredVolume: 0,
      balanceVolume: 0
    };
    curPc.contractsCount += 1;
    curPc.contractedVolume += r.contractedVolume;
    curPc.deliveredVolume += r.deliveredVolume;
    curPc.balanceVolume += r.balanceVolume;
    productCropMap.set(pcKey, curPc);

    const fKey = `${r.farmName}__${r.pickupLocation}`;
    const curF = farmMap.get(fKey) || {
      key: fKey,
      farmName: r.farmName,
      pickupLocation: r.pickupLocation,
      contractsCount: 0,
      contractedVolume: 0,
      deliveredVolume: 0,
      balanceVolume: 0
    };
    curF.contractsCount += 1;
    curF.contractedVolume += r.contractedVolume;
    curF.deliveredVolume += r.deliveredVolume;
    curF.balanceVolume += r.balanceVolume;
    farmMap.set(fKey, curF);
  }

  const scheduleRows = Array.from(scheduleMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _s, ...rest }) => rest);

  const gantt = buildLogisticsGanttData(scopedRows);

  const contracts = [...scopedRows]
    .sort((a, b) => (a.window.startIso || '9999').localeCompare(b.window.startIso || '9999'))
    .map((r) => ({
      contractId: r.contractId,
      contractNumber: r.contractNumber,
      closingDate: r.closingDate,
      product: r.product,
      crop: r.crop,
      farmName: r.farmName,
      pickupLocation: r.pickupLocation,
      freightType: r.freightType,
      buyerName: r.buyerName,
      periodLabel: r.window.periodLabel,
      exactDatesLabel: r.window.exactDatesLabel,
      contractedVolume: r.contractedVolume,
      deliveredVolume: r.deliveredVolume,
      balanceVolume: r.balanceVolume,
      deliveredPct: r.deliveredPct,
      logisticsStatusLabel: r.logisticsStatusLabel,
      logisticsStatus: r.logisticsStatus
    }));

  return {
    targetTitle,
    targetDocs,
    referenceDate,
    unit,
    contractsCount: summary.contractsCount,
    totalContracted: summary.totalContracted,
    totalDelivered: summary.totalDelivered,
    totalBalance: summary.totalBalance,
    totalExcess: summary.totalExcess,
    deliveredPct:
      summary.totalContracted > 0
        ? Math.min(100, (summary.totalDelivered / summary.totalContracted) * 100)
        : 0,
    fobContracted: summary.fobContracted,
    cifContracted: summary.cifContracted,
    horizons: summary.horizons,
    scheduleRows,
    byProductAndCrop: Array.from(productCropMap.values()).sort(
      (a, b) => b.contractedVolume - a.contractedVolume
    ),
    byFarm: Array.from(farmMap.values()).sort((a, b) => b.contractedVolume - a.contractedVolume),
    gantt,
    contracts
  };
};

// --- CONTRACT FORM DATE PRESERVATION HELPERS (SECTION 14) ---

export interface ContractPeriodResolution {
  hasValidStart: boolean;
  hasValidEnd: boolean;
  isInvalidRange: boolean;
  isNonStandardDates: boolean;
  startYear: number;
  startMonth0: number; // 0..11
  startFortnight: '1' | '2';
  endYear: number;
  endMonth0: number; // 0..11
  endFortnight: '1' | '2';
  preservedStartDate: string;
  preservedEndDate: string;
}

export const buildContractYearsRange = (extraYears: number[] = []): number[] => {
  const currentYear = new Date().getFullYear();
  const minYear = 2018;
  const maxYear = Math.max(2030, currentYear + 5);
  const set = new Set<number>();
  for (let y = minYear; y <= maxYear; y++) set.add(y);
  for (const y of extraYears) {
    if (Number.isInteger(y) && y >= 2000 && y <= 2100) set.add(y);
  }
  return Array.from(set).sort((a, b) => a - b);
};

export const computePeriodDatesFromSelectors = (params: {
  isImmediate: boolean;
  startFortnight: '1' | '2';
  startMonth0: number;
  startYear: number;
  endFortnight: '1' | '2';
  endMonth0: number;
  endYear: number;
  todayIso?: string;
}): { shipmentStartDate: string; shipmentEndDate: string } => {
  const {
    isImmediate,
    startFortnight,
    startMonth0,
    startYear,
    endFortnight,
    endMonth0,
    endYear,
    todayIso = getTodayIsoLocal()
  } = params;

  const startDate = isImmediate
    ? todayIso
    : buildFortnightSegment(startYear, startMonth0 + 1, startFortnight === '1' ? 1 : 2).startIso;

  const endDate = buildFortnightSegment(
    endYear,
    endMonth0 + 1,
    endFortnight === '1' ? 1 : 2
  ).endIso;

  return {
    shipmentStartDate: startDate,
    shipmentEndDate: endDate
  };
};

export const resolveContractPeriodOnEdit = (
  shipmentStartDate?: string | null,
  shipmentEndDate?: string | null
): ContractPeriodResolution => {
  const s = parseIsoDateParts(shipmentStartDate);
  const e = parseIsoDateParts(shipmentEndDate);
  const now = new Date();

  const startYear = s ? s.year : now.getFullYear();
  const startMonth0 = s ? s.month - 1 : now.getMonth();
  const startFortnight: '1' | '2' = s && s.day > 15 ? '2' : '1';

  const endYear = e ? e.year : startYear;
  const endMonth0 = e ? e.month - 1 : startMonth0;
  const endFortnight: '1' | '2' = e ? (e.day <= 15 ? '1' : '2') : '2';

  const isInvalidRange = Boolean(!s || !e || s.isoDate > e.isoDate);

  let isNonStandardDates = false;
  if (s && e) {
    const startStandard = s.day === 1 || s.day === 16;
    const endLastDay = getDaysInMonth(e.year, e.month);
    const endStandard = e.day === 15 || e.day === endLastDay;
    isNonStandardDates = !startStandard || !endStandard;
  }

  return {
    hasValidStart: Boolean(s),
    hasValidEnd: Boolean(e),
    isInvalidRange,
    isNonStandardDates,
    startYear,
    startMonth0,
    startFortnight,
    endYear,
    endMonth0,
    endFortnight,
    preservedStartDate: s?.isoDate || shipmentStartDate || '',
    preservedEndDate: e?.isoDate || shipmentEndDate || ''
  };
};

export const validateContractDeliveryPeriod = (
  shipmentStartDate?: string | null,
  shipmentEndDate?: string | null
): { valid: boolean; error?: string } => {
  const s = parseIsoDateParts(shipmentStartDate);
  const e = parseIsoDateParts(shipmentEndDate);
  if (!s || !e) {
    return {
      valid: false,
      error: 'Informe datas válidas de início e término do período de embarque.'
    };
  }
  if (s.isoDate > e.isoDate) {
    return {
      valid: false,
      error: `Período de entrega inválido: o início (${formatDateBR(s.isoDate)}) não pode ser posterior ao término (${formatDateBR(e.isoDate)}).`
    };
  }
  return { valid: true };
};
