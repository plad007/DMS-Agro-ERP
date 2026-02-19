
export enum PricingMode {
  FIXED = 'FIXED',
  COMPONENTS = 'COMPONENTS'
}

export enum ContractStatus {
  DRAFT = 'Rascunho',
  AWAITING_SIGNATURE = 'Aguardando Assinatura',
  SIGNED = 'Assinado',
  COMPLETED = 'Concluído'
}

export type FreightType = 'CIF' | 'FOB';

export interface BankAccount {
    bankName: string;
    agency: string;
    account: string;
    holder?: string; // Optional redundancy
    holderDoc?: string; // Optional redundancy
}

export interface Contract {
  id: string;
  number: string; // Ex: 1001S26
  product: 'SOJA' | 'MILHO' | 'TRIGO';
  crop: string; // Ex: 23/24
  
  // Parties
  sellerName: string;
  sellerDoc?: string; // NOVO: CPF/CNPJ Vendedor
  buyerName: string;
  buyerDoc?: string; // NOVO: CNPJ Comprador
  
  // Logistics & Terms
  totalBags: number; // Quantidade em sacas (60kg)
  totalTons: number; // Quantidade em toneladas
  deliveredBags: number;
  freightType: FreightType;
  pickupLocation: string; // Local de Embarque
  shipmentStartDate: string;
  shipmentEndDate: string;
  observation?: string;

  // Financials
  currency: 'BRL' | 'USD';
  exchangeRate: number; // Câmbio
  
  pricingMode: PricingMode;
  isFixed: boolean; // Botão FIXAR
  
  // Pricing Components (Values per bag)
  basePrice: number; // Used for FIXED mode
  cbotComponent?: number;
  basisComponent?: number;
  costComponent?: number;
  finalPrice: number; // Calculated or Manual
  
  commissionPerBag: number;
  paymentDate: string;
  commissionDueDate: string; // paymentDate + 1
  
  closingDate: string; // Nova Data de Fechamento do Negócio

  // Specific Bank Details for this contract (Snapshot)
  sellerBankDetails?: BankAccount; 

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
  bagsCount: number; // Calculated
  date: string;
}

export interface MarketData {
  usd: number;
  cbotCorn: number;
  cbotSoy: number;
}

export interface Farm {
    id: string;
    name: string; // FAZENDA
    address: string; // ENDEREÇO FAZENDA
}

export interface Producer {
    id: string;
    name: string; // PRODUTOR
    doc: string; // CPF/CNPJ
    stateInsc: string; // I.E. VENDEDOR
    email?: string;
    region: string; // REGIÃO
    farms: Farm[]; // Lista de fazendas
    bankDetails: BankAccount[]; // Lista de contas bancárias (Atualizado para Array)
    funruralType: 'FOLHA' | 'COMERCIALIZACAO' | 'PJ_ISENTO'; // TIPO DE FUNRURAL ATUALIZADO
}

export interface Buyer {
    id: string;
    name: string; // COMPRADOR
    doc: string; // CNPJ
    stateInsc: string; // I.E.
    address: string; // ENDEREÇO
    type: 'TRADING' | 'MERCADO_INTERNO'; // TIPO
}
