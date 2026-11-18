
export enum PricingMode {
  FIXED = 'FIXED',
  COMPONENTS = 'COMPONENTS'
}

export enum ContractStatus {
  DRAFT = 'Rascunho',
  AWAITING_SIGNATURE = 'Aguardando Assinatura',
  SIGNED = 'Assinado',
  COMPLETED = 'Concluído',
  CANCELLED = 'Cancelado'
}

export type NormalizedContractStatus =
  | 'Rascunho'
  | 'Aguardando Assinatura'
  | 'Assinado'
  | 'Concluído'
  | 'Cancelado'
  | 'Outro';

export type FreightType = 'CIF' | 'FOB';

export type PaymentType = 'DATA_FIXA' | 'SOB_RODAS' | 'POS_RETIRADA';

export type CurrencyCode = 'BRL' | 'USD';

export interface DataLoadIntegrity {
  table: string;
  loadedCount: number;
  expectedCount: number | null;
  isComplete: boolean;
  error?: string;
}

export interface SystemDataIntegrity {
  contracts: DataLoadIntegrity;
  shipments: DataLoadIntegrity;
  producers: DataLoadIntegrity;
  buyers: DataLoadIntegrity;
  hasIncompleteData: boolean;
}

export interface EconomicGroup {
  id: string;
  name: string;
  notes?: string;
  producerIds: string[];
  createdAt?: string;
}

export type CommissionFinancialStatus =
  | 'RECEBIDA'
  | 'PARCIAL'
  | 'PREVISTA_CONFIRMADA'
  | 'PREVISTA_ESTIMADA'
  | 'AGUARDANDO_EMBARQUE'
  | 'SEM_VENCIMENTO'
  | 'CANCELADA';

export type ForecastOrigin =
  | 'CONFIRMED'
  | 'ESTIMATED_LEGACY'
  | 'ESTIMATED_BY_SHIPMENT'
  | 'UNDEFINED';

export interface CommissionReceipt {
  id: string;
  contractId: string;
  receiptDate: string;
  amount: number;
  currency: 'BRL';
  paymentMethod?: string;
  notes?: string;
  isReversed?: boolean;
  reversedReason?: string;
  createdAt?: string;
}

export interface BankAccount {
    bankName: string;
    agency: string;
    account: string;
    holder?: string;
    holderDoc?: string;
}

export interface Contract {
  id: string;
  number: string;
  product: 'SOJA' | 'MILHO' | 'TRIGO' | 'SORGO';
  crop: string;
  sellerId?: string;
  sellerName: string;
  sellerDoc?: string;
  farmId?: string;
  farmName?: string;
  buyerName: string;
  buyerDoc?: string;
  totalBags: number;
  totalTons: number;
  deliveredBags: number;
  freightType: FreightType;
  pickupLocation: string;
  shipmentStartDate: string;
  shipmentEndDate: string;
  observation?: string;
  currency: 'BRL' | 'USD';
  exchangeRate: number;
  pricingMode: PricingMode;
  isFixed: boolean;
  basePrice: number;
  cbotComponent?: number;
  basisComponent?: number;
  costComponent?: number;
  finalPrice: number;
  commissionPerBag: number;
  paymentDate: string;
  commissionDueDate: string;
  closingDate: string;
  sellerBankDetails?: BankAccount;
  paymentType?: PaymentType;
  paymentDays?: number;
  status: ContractStatus;
  createdAt: string;
  signatureData?: {
    signedAt: string;
    ip: string;
    device: string;
  };
}

export interface Shipment {
  id: string;
  contractId: string;
  plate: string;
  ticketNumber: string;
  weightKg: number;
  bagsCount: number;
  date: string;
  deliveryDate: string;
  paymentDueDate?: string;
  promissoryNoteIssued?: boolean;
  promissoryNoteIssuedAt?: string;
  promissoryNoteNumber?: string;
  paid?: boolean;
  paidAt?: string;
}

export interface MarketData {
  usd: number;
  cbotCorn: number;
  cbotSoy: number;
}

export interface Farm {
    id: string;
    name: string;
    address: string;
}

export interface Producer {
    id: string;
    name: string;
    doc: string;
    stateInsc: string;
    email?: string;
    region: string;
    farms: Farm[];
    bankDetails: BankAccount[];
    funruralType: 'FOLHA' | 'COMERCIALIZACAO' | 'PJ_ISENTO';
}

export interface BuyerPartner {
    name: string;
    cpf: string;
    rg?: string;
    address?: string;
}

export interface Buyer {
    id: string;
    name: string;
    doc: string;
    stateInsc: string;
    address: string;
    type: 'TRADING' | 'MERCADO_INTERNO';
    partners?: BuyerPartner[];
}
