import { supabase } from './supabase';
import { Contract, Shipment, ContractStatus, PricingMode, MarketData, Producer, Buyer, Farm } from '../types';

// --- MAPPING HELPERS ---
// Converte do Banco (snake_case) para App (camelCase)
const mapProducerFromDB = (p: any): Producer => ({
    id: p.id,
    name: p.name,
    doc: p.doc,
    stateInsc: p.state_insc,
    email: p.email,
    region: p.region,
    funruralType: p.funrural_type,
    bankDetails: p.bank_details || {},
    farms: p.farms ? p.farms.map((f: any) => ({
        id: f.id,
        name: f.name,
        address: f.address
    })) : []
});

const mapBuyerFromDB = (b: any): Buyer => ({
    id: b.id,
    name: b.name,
    doc: b.doc,
    stateInsc: b.state_insc,
    address: b.address,
    type: b.type
});

const mapContractFromDB = (c: any): Contract => ({
    id: c.id,
    number: c.number,
    product: c.product,
    crop: c.crop,
    sellerName: c.seller_name,
    buyerName: c.buyer_name,
    totalBags: c.total_bags,
    totalTons: c.total_tons,
    deliveredBags: c.delivered_bags,
    freightType: c.freight_type,
    pickupLocation: c.pickup_location,
    shipmentStartDate: c.shipment_start_date,
    shipmentEndDate: c.shipment_end_date,
    observation: c.observation,
    currency: c.currency,
    exchangeRate: c.exchange_rate,
    pricingMode: c.pricing_mode,
    isFixed: c.is_fixed,
    basePrice: c.base_price,
    cbotComponent: c.cbot_component,
    basisComponent: c.basis_component,
    costComponent: c.cost_component,
    finalPrice: c.final_price,
    commissionPerBag: c.commission_per_bag,
    paymentDate: c.payment_date,
    commissionDueDate: c.commission_due_date,
    status: c.status,
    createdAt: c.created_at,
    signatureData: c.signature_data
});

const mapShipmentFromDB = (s: any): Shipment => ({
    id: s.id,
    contractId: s.contract_id,
    plate: s.plate,
    ticketNumber: s.ticket_number,
    weightKg: s.weight_kg,
    bagsCount: s.bags_count,
    date: s.date
});

// --- API FUNCTIONS ---

export const getMarketData = (): MarketData => {
  // Mock fixo por enquanto, poderia vir de outra tabela
  return {
    usd: 5.15,
    cbotSoy: 1180.50,
    cbotCorn: 440.25
  };
};

export const getProducers = async (): Promise<Producer[]> => {
    const { data, error } = await supabase
        .from('producers')
        .select('*, farms(*)');
    
    if (error) {
        console.error('Error fetching producers:', error);
        return [];
    }
    return data.map(mapProducerFromDB);
};

export const getBuyers = async (): Promise<Buyer[]> => {
    const { data, error } = await supabase
        .from('buyers')
        .select('*');

    if (error) {
        console.error('Error fetching buyers:', error);
        return [];
    }
    return data.map(mapBuyerFromDB);
};

export const getContracts = async (): Promise<Contract[]> => {
    const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching contracts:', error);
        return [];
    }
    return data.map(mapContractFromDB);
};

export const getShipments = async (contractId?: string): Promise<Shipment[]> => {
    let query = supabase.from('shipments').select('*').order('date', { ascending: false });
    
    if (contractId) {
        query = query.eq('contract_id', contractId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching shipments:', error);
        return [];
    }
    return data.map(mapShipmentFromDB);
};

// --- CRUD OPERATIONS ---

export const saveProducer = async (producer: Producer): Promise<Producer | null> => {
    // 1. Save Producer Info
    const dbProducer = {
        name: producer.name,
        doc: producer.doc,
        state_insc: producer.stateInsc,
        email: producer.email,
        region: producer.region,
        funrural_type: producer.funruralType,
        bank_details: producer.bankDetails
    };

    let producerId = producer.id;
    let result = null;

    const isNew = producer.id.length < 15; 

    if (isNew) {
        const { data, error } = await supabase.from('producers').insert(dbProducer).select().single();
        if (error) throw error;
        result = data;
        producerId = data.id;
    } else {
        const { data, error } = await supabase.from('producers').update(dbProducer).eq('id', producerId).select().single();
        if (error) throw error;
        result = data;
    }

    // 2. Save Farms
    if (producer.farms && producer.farms.length > 0) {
        const farmsToUpsert = producer.farms.map(f => ({
            id: f.id.length < 15 ? undefined : f.id,
            producer_id: producerId,
            name: f.name,
            address: f.address
        }));
        
        const { error: farmsError } = await supabase.from('farms').upsert(farmsToUpsert);
        if (farmsError) console.error("Error saving farms", farmsError);
    }
    
    return mapProducerFromDB(result); 
};

export const deleteProducer = async (id: string) => {
    await supabase.from('producers').delete().eq('id', id);
};

export const saveBuyer = async (buyer: Buyer) => {
    const dbBuyer = {
        name: buyer.name,
        doc: buyer.doc,
        state_insc: buyer.stateInsc,
        address: buyer.address,
        type: buyer.type
    };

    const isNew = buyer.id.length < 15;

    if (isNew) {
        await supabase.from('buyers').insert(dbBuyer);
    } else {
        await supabase.from('buyers').update(dbBuyer).eq('id', buyer.id);
    }
};

export const deleteBuyer = async (id: string) => {
    await supabase.from('buyers').delete().eq('id', id);
};

export const saveContract = async (contract: Contract) => {
    const dbContract = {
        number: contract.number,
        product: contract.product,
        crop: contract.crop,
        seller_name: contract.sellerName,
        buyer_name: contract.buyerName,
        total_bags: contract.totalBags,
        total_tons: contract.totalTons,
        delivered_bags: contract.deliveredBags,
        freight_type: contract.freightType,
        pickup_location: contract.pickupLocation,
        shipment_start_date: contract.shipmentStartDate,
        shipment_end_date: contract.shipmentEndDate,
        observation: contract.observation,
        currency: contract.currency,
        exchange_rate: contract.exchangeRate,
        pricing_mode: contract.pricingMode,
        is_fixed: contract.isFixed,
        base_price: contract.basePrice,
        cbot_component: contract.cbotComponent,
        basis_component: contract.basisComponent,
        cost_component: contract.costComponent,
        final_price: contract.finalPrice,
        commission_per_bag: contract.commissionPerBag,
        payment_date: contract.paymentDate,
        commission_due_date: contract.commissionDueDate,
        status: contract.status,
        signature_data: contract.signatureData
    };

    const isNew = contract.id.length < 15;

    if (isNew) {
        await supabase.from('contracts').insert(dbContract);
    } else {
        await supabase.from('contracts').update(dbContract).eq('id', contract.id);
    }
};

export const addShipment = async (shipment: Shipment) => {
    const dbShipment = {
        contract_id: shipment.contractId,
        plate: shipment.plate,
        ticket_number: shipment.ticketNumber,
        weight_kg: shipment.weightKg,
        bags_count: shipment.bagsCount,
        date: shipment.date
    };
    
    await supabase.from('shipments').insert(dbShipment);

    const { data: contract } = await supabase.from('contracts').select('delivered_bags').eq('id', shipment.contractId).single();
    if (contract) {
        const newTotal = (Number(contract.delivered_bags) || 0) + shipment.bagsCount;
        await supabase.from('contracts').update({ delivered_bags: newTotal }).eq('id', shipment.contractId);
    }
};

export const generateContractNumber = async (product: string, crop: string): Promise<string> => {
  const letter = product === 'SOJA' ? 'S' : product === 'MILHO' ? 'M' : 'T';
  const cleanCrop = crop.trim();
  let yearSuffix = '00';
  
  if (cleanCrop.includes('/')) {
    yearSuffix = cleanCrop.split('/')[1]; 
  } else if (cleanCrop.length >= 2) {
    yearSuffix = cleanCrop.slice(-2); 
  }

  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('product', product)
    .eq('crop', crop);

  const seq = 1001 + (count || 0);
  
  return `${seq}${letter}${yearSuffix}`;
};

// --- BULK OPERATIONS FOR CSV IMPORT ---

export const bulkInsert = async (table: string, data: any[]) => {
    const { error } = await supabase.from(table).insert(data);
    if (error) throw error;
};

// Special function to handle Farm import by linking Document (CPF/CNPJ) to Producer ID
export const bulkInsertFarms = async (csvData: any[]) => {
    if (csvData.length === 0) return;

    // 1. Extract all producer documents from CSV
    const documents = [...new Set(csvData.map(row => row.producer_doc).filter(Boolean))];

    // 2. Fetch Producer IDs matching these documents
    const { data: producers, error } = await supabase
        .from('producers')
        .select('id, doc')
        .in('doc', documents);

    if (error) throw new Error('Erro ao buscar produtores: ' + error.message);
    if (!producers) return;

    // 3. Create a map: Document -> UUID
    const docMap = new Map();
    producers.forEach(p => docMap.set(p.doc, p.id));

    // 4. Prepare Farms for Insert
    const farmsToInsert: any[] = [];
    const errors: string[] = [];

    csvData.forEach(row => {
        const producerId = docMap.get(row.producer_doc);
        if (producerId) {
            farmsToInsert.push({
                producer_id: producerId,
                name: row.name,
                address: row.address
            });
        } else {
            errors.push(`Produtor com CPF/CNPJ ${row.producer_doc} não encontrado.`);
        }
    });

    // 5. Insert
    if (farmsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('farms').insert(farmsToInsert);
        if (insertError) throw insertError;
    }

    if (errors.length > 0) {
        console.warn("Algumas fazendas não foram importadas:", errors);
        throw new Error(`Importação parcial. ${farmsToInsert.length} salvas. ${errors.length} falharam (Produtor não encontrado).`);
    }
};