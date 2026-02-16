
import { Contract, Shipment, ContractStatus, PricingMode, MarketData, Producer, Buyer } from '../types';

// Mock Databases
export const mockProducers: Producer[] = [
    { 
        id: 'p1', 
        name: 'Fazenda Santa Rita', 
        doc: '12.345.678/0001-90',
        stateInsc: '123.456.789',
        email: 'financeiro@santarita.com.br',
        region: 'Sorriso - MT',
        funruralType: 'COMERCIALIZACAO',
        farms: [
            { id: 'f1', name: 'Sede Santa Rita', address: 'Rodovia MT-242, Km 50' },
            { id: 'f2', name: 'Retiro do Lago', address: 'Estrada Vicinal, Km 10' }
        ],
        bankDetails: {
            bankName: 'Banco do Brasil',
            agency: '1234-5',
            account: '998877-X'
        }
    },
    { 
        id: 'p2', 
        name: 'Grupo Bom Futuro', 
        doc: '98.765.432/0001-10',
        stateInsc: '987.654.321',
        email: 'comercial@bomfuturo.com.br',
        region: 'Cuiabá - MT',
        funruralType: 'FOLHA',
        farms: [
             { id: 'f3', name: 'Fazenda Colorado', address: 'BR 163, Km 200' }
        ],
        bankDetails: {
            bankName: 'Sicredi',
            agency: '0810',
            account: '11223-3'
        }
    }
];

export const mockBuyers: Buyer[] = [
    { 
        id: 'b1', 
        name: 'Cargill Agrícola', 
        doc: '60.494.463/0001-05',
        address: 'Av. Nações Unidas, 12345 - São Paulo/SP',
        stateInsc: '123.123.123.111',
        type: 'TRADING'
    },
    { 
        id: 'b2', 
        name: 'Granja Faria',
        doc: '84.046.101/0001-93',
        address: 'Rodovia Jorge Lacerda, Km 20 - Gaspar/SC',
        stateInsc: '222.333.444.555',
        type: 'MERCADO_INTERNO'
    },
    { 
        id: 'b3', 
        name: 'Amaggi Commodities',
        doc: '77.777.777/0001-77',
        address: 'Cuiabá - MT',
        stateInsc: '777.888.999',
        type: 'TRADING'
    },
    { 
        id: 'b4', 
        name: 'DMS Trading (Interno)',
        doc: '33.082.718/0001-23',
        address: 'Palmas - TO',
        stateInsc: 'Isento',
        type: 'TRADING'
    }
];

// Mock Initial Data
let contracts: Contract[] = [
  {
    id: '1',
    number: '1101S26', 
    product: 'SOJA',
    crop: '2026',
    sellerName: 'Fazenda Santa Rita',
    buyerName: 'Amaggi Commodities',
    totalBags: 19200,
    totalTons: 1152,
    deliveredBags: 0,
    freightType: 'FOB',
    pickupLocation: 'Sede Santa Rita',
    shipmentStartDate: '2026-03-01',
    shipmentEndDate: '2026-03-31',
    currency: 'BRL',
    exchangeRate: 5.10,
    pricingMode: PricingMode.FIXED,
    isFixed: true,
    basePrice: 104.00,
    finalPrice: 104.00,
    commissionPerBag: 0.50,
    paymentDate: '2026-04-30',
    commissionDueDate: '2026-05-01',
    status: ContractStatus.SIGNED,
    createdAt: '2026-02-12',
    signatureData: {
      signedAt: '2026-02-12T14:30:00Z',
      ip: '192.168.1.1',
      device: 'iPhone 13'
    },
    observation: 'Na hipótese de falta de produto na fazenda, descontar do preço da soja.\nCliente possui créditos de DPI no Site da Monsanto para apropriar no contrato e liberar o pagamento.'
  }
];

let shipments: Shipment[] = [];

// Mutable Arrays for Runtime Updates
let producers = [...mockProducers];
let buyers = [...mockBuyers];

export const getMarketData = (): MarketData => {
  return {
    usd: 5.15,
    cbotSoy: 1180.50,
    cbotCorn: 440.25
  };
};

export const getContracts = () => [...contracts];
export const getProducers = () => [...producers];
export const getBuyers = () => [...buyers];

// --- PRODUCER CRUD ---
export const saveProducer = (producer: Producer) => {
    const index = producers.findIndex(p => p.id === producer.id);
    if (index >= 0) {
        producers[index] = producer;
    } else {
        producers.push(producer);
    }
    return producer;
};

export const deleteProducer = (id: string) => {
    producers = producers.filter(p => p.id !== id);
};

// --- BUYER CRUD ---
export const saveBuyer = (buyer: Buyer) => {
    const index = buyers.findIndex(b => b.id === buyer.id);
    if (index >= 0) {
        buyers[index] = buyer;
    } else {
        buyers.push(buyer);
    }
    return buyer;
};

export const deleteBuyer = (id: string) => {
    buyers = buyers.filter(b => b.id !== id);
};

// --- CONTRACT CRUD ---
export const saveContract = (contract: Contract) => {
  const index = contracts.findIndex(c => c.id === contract.id);
  if (index >= 0) {
    contracts[index] = contract;
  } else {
    contracts.push(contract);
  }
  return contract;
};

export const getShipments = (contractId?: string) => {
  if (contractId) return shipments.filter(s => s.contractId === contractId);
  return shipments;
};

export const addShipment = (shipment: Shipment) => {
  shipments.push(shipment);
  const contract = contracts.find(c => c.id === shipment.contractId);
  if (contract) {
    contract.deliveredBags += shipment.bagsCount;
  }
  return shipment;
};

export const generateContractNumber = (product: string, crop: string): string => {
  // Logic: 100 (Prefix) + 1 (Start Sequence) + [Letter] + [Year]
  const letter = product === 'SOJA' ? 'S' : product === 'MILHO' ? 'M' : 'T';
  const cleanCrop = crop.trim();
  let yearSuffix = '00';
  
  if (cleanCrop.includes('/')) {
    yearSuffix = cleanCrop.split('/')[1]; 
  } else if (cleanCrop.length >= 2) {
    yearSuffix = cleanCrop.slice(-2); 
  }

  const existingCount = contracts.filter(c => 
    c.product === product && 
    c.crop === crop
  ).length;

  const seq = 1001 + existingCount;
  
  return `${seq}${letter}${yearSuffix}`;
};
