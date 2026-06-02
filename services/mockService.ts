import { supabase } from './supabase';
import { Contract, Shipment, MarketData, Producer, Buyer, BankAccount, PaymentType } from '../types';

const mapProducerFromDB = (p: any): Producer => {
    let banks: BankAccount[] = [];
    if (Array.isArray(p.bank_details)) {
        banks = p.bank_details;
    } else if (p.bank_details && typeof p.bank_details === 'object') {
        banks = [p.bank_details];
    }
    return {
        id: p.id,
        name: p.name,
        doc: p.doc,
        stateInsc: p.state_insc,
        email: p.email,
        region: p.region,
        funruralType: p.funrural_type,
        bankDetails: banks,
        farms: p.farms ? p.farms.map((f: any) => ({ id: f.id, name: f.name, address: f.address })) : []
    };
};

const mapBuyerFromDB = (b: any): Buyer => ({
    id: b.id, name: b.name, doc: b.doc,
    stateInsc: b.state_insc, address: b.address, type: b.type,
    partners: Array.isArray(b.partners) ? b.partners : []
});

const mapContractFromDB = (c: any): Contract => {
    let bankDetails: BankAccount | undefined = undefined;
    if (c.seller_bank_details) {
        if (typeof c.seller_bank_details === 'string') {
            try { bankDetails = JSON.parse(c.seller_bank_details); }
            catch (e) { console.error("Erro ao parsear conta bancária do contrato", c.number); }
        } else {
            bankDetails = c.seller_bank_details;
        }
    }
    return {
        id: c.id, number: c.number, product: c.product, crop: c.crop,
        sellerName: c.seller_name, sellerDoc: c.seller_doc,
        buyerName: c.buyer_name, buyerDoc: c.buyer_doc,
        totalBags: c.total_bags, totalTons: c.total_tons, deliveredBags: c.delivered_bags,
        freightType: c.freight_type, pickupLocation: c.pickup_location,
        shipmentStartDate: c.shipment_start_date, shipmentEndDate: c.shipment_end_date,
        observation: c.observation, currency: c.currency, exchangeRate: c.exchange_rate,
        pricingMode: c.pricing_mode, isFixed: c.is_fixed, basePrice: c.base_price,
        cbotComponent: c.cbot_component, basisComponent: c.basis_component,
        costComponent: c.cost_component, finalPrice: c.final_price,
        commissionPerBag: c.commission_per_bag, paymentDate: c.payment_date,
        commissionDueDate: c.commission_due_date, closingDate: c.closing_date,
        sellerBankDetails: bankDetails,
        paymentType: c.payment_type ?? undefined,
        paymentDays: c.payment_days ?? undefined,
        status: c.status, createdAt: c.created_at, signatureData: c.signature_data
    };
};

const mapShipmentFromDB = (s: any): Shipment => ({
    id: s.id, contractId: s.contract_id, plate: s.plate,
    ticketNumber: s.ticket_number, weightKg: s.weight_kg,
    bagsCount: s.weight_kg / 60, date: s.date,
    deliveryDate: s.delivery_date ?? s.date,
    paymentDueDate: s.payment_due_date ?? undefined,
    promissoryNoteIssued: s.promissory_note_issued ?? false,
    promissoryNoteIssuedAt: s.promissory_note_issued_at ?? undefined,
    promissoryNoteNumber: s.promissory_note_number ?? undefined,
    paid: s.paid ?? false,
    paidAt: s.paid_at ?? undefined
});

const calcPaymentDueDate = (
    deliveryDate: string,
    paymentType?: PaymentType,
    paymentDays?: number,
    contractPaymentDate?: string
): string | undefined => {
    if (!paymentType) return undefined;
    const base = new Date(deliveryDate);
    if (paymentType === 'SOB_RODAS') return deliveryDate;
    if (paymentType === 'POS_RETIRADA' && paymentDays) {
        base.setDate(base.getDate() + paymentDays);
        return base.toISOString().split('T')[0];
    }
    if (paymentType === 'DATA_FIXA') return contractPaymentDate ?? undefined;
    return undefined;
};

export const getMarketData = (): MarketData => ({
    usd: 5.15, cbotSoy: 1180.50, cbotCorn: 440.25
});

export const getProducers = async (): Promise<Producer[]> => {
    const { data, error } = await supabase.from('producers').select('*, farms(*)');
    if (error) { console.error('Error fetching producers:', error); return []; }
    return data.map(mapProducerFromDB);
};

export const getBuyers = async (): Promise<Buyer[]> => {
    const { data, error } = await supabase.from('buyers').select('*');
    if (error) { console.error('Error fetching buyers:', error); return []; }
    return data.map(mapBuyerFromDB);
};

export const getContracts = async (): Promise<Contract[]> => {
    const { data, error } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching contracts:', error); return []; }
    return data.map(mapContractFromDB);
};

export const getShipments = async (contractId?: string): Promise<Shipment[]> => {
    let query = supabase.from('shipments').select('*').order('delivery_date', { ascending: false });
    if (contractId) query = query.eq('contract_id', contractId);
    const { data, error } = await query;
    if (error) { console.error('Error fetching shipments:', error); return []; }
    return data.map(mapShipmentFromDB);
};

export const saveProducer = async (producer: Producer): Promise<Producer | null> => {
    const dbProducer = {
        name: producer.name, doc: producer.doc, state_insc: producer.stateInsc,
        email: producer.email, region: producer.region,
        funrural_type: producer.funruralType, bank_details: producer.bankDetails
    };
    let producerId = producer.id;
    let result = null;
    const isNew = producer.id.length < 15;
    if (isNew) {
        const { data, error } = await supabase.from('producers').insert(dbProducer).select().single();
        if (error) throw error;
        result = data; producerId = data.id;
    } else {
        const { data, error } = await supabase.from('producers').update(dbProducer).eq('id', producerId).select().single();
        if (error) throw error;
        result = data;
    }
    if (producer.farms && producer.farms.length > 0) {
        const farmsToUpsert = producer.farms.map(f => ({
            id: f.id.length < 15 ? undefined : f.id,
            producer_id: producerId, name: f.name, address: f.address
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
        name: buyer.name, doc: buyer.doc, state_insc: buyer.stateInsc,
        address: buyer.address, type: buyer.type,
        partners: buyer.partners ?? []
    };
    const isNew = buyer.id.length < 15;
    if (isNew) { await supabase.from('buyers').insert(dbBuyer); }
    else { await supabase.from('buyers').update(dbBuyer).eq('id', buyer.id); }
};

export const deleteBuyer = async (id: string) => {
    await supabase.from('buyers').delete().eq('id', id);
};

export const saveContract = async (contract: Contract) => {
    const dbContract = {
        number: contract.number, product: contract.product, crop: contract.crop,
        seller_name: contract.sellerName, seller_doc: contract.sellerDoc,
        buyer_name: contract.buyerName, buyer_doc: contract.buyerDoc,
        total_bags: contract.totalBags, total_tons: contract.totalTons,
        delivered_bags: contract.deliveredBags, freight_type: contract.freightType,
        pickup_location: contract.pickupLocation,
        shipment_start_date: contract.shipmentStartDate, shipment_end_date: contract.shipmentEndDate,
        observation: contract.observation, currency: contract.currency,
        exchange_rate: contract.exchangeRate, pricing_mode: contract.pricingMode,
        is_fixed: contract.isFixed, base_price: contract.basePrice,
        cbot_component: contract.cbotComponent, basis_component: contract.basisComponent,
        cost_component: contract.costComponent, final_price: contract.finalPrice,
        commission_per_bag: contract.commissionPerBag, payment_date: contract.paymentDate,
        commission_due_date: contract.commissionDueDate, closing_date: contract.closingDate,
        seller_bank_details: contract.sellerBankDetails,
        payment_type: contract.paymentType ?? null,
        payment_days: contract.paymentDays ?? null,
        status: contract.status, signature_data: contract.signatureData
    };
    const isNew = contract.id.length < 15;
    const { error } = isNew
        ? await supabase.from('contracts').insert(dbContract)
        : await supabase.from('contracts').update(dbContract).eq('id', contract.id);
    if (error) {
        console.error("Erro Supabase:", error);
        throw new Error(`Erro ao salvar no banco: ${error.message}`);
    }
};

export const addShipment = async (shipment: Shipment, contract: Contract) => {
    const paymentDueDate = calcPaymentDueDate(
        shipment.deliveryDate,
        contract.paymentType,
        contract.paymentDays,
        contract.paymentDate
    );
    const dbShipment = {
        contract_id: shipment.contractId, plate: shipment.plate,
        ticket_number: shipment.ticketNumber, weight_kg: shipment.weightKg,
        bags_count: shipment.bagsCount, date: shipment.date,
        delivery_date: shipment.deliveryDate,
        payment_due_date: paymentDueDate ?? null
    };
    const { error } = await supabase.from('shipments').insert(dbShipment);
    if (error) throw error;
    const { data: contractData } = await supabase.from('contracts').select('delivered_bags').eq('id', shipment.contractId).single();
    if (contractData) {
        const newTotal = (Number(contractData.delivered_bags) || 0) + shipment.bagsCount;
        await supabase.from('contracts').update({ delivered_bags: newTotal }).eq('id', shipment.contractId);
    }
};

export const generateContractNumber = async (product: string, crop: string): Promise<string> => {
    const letter = product === 'SOJA' ? 'S' : product === 'MILHO' ? 'M' : product === 'SORGO' ? 'G' : 'T';
    const cleanCrop = crop.trim();
    let yearSuffix = '00';
    if (cleanCrop.includes('/')) yearSuffix = cleanCrop.split('/')[1];
    else if (cleanCrop.length >= 2) yearSuffix = cleanCrop.slice(-2);
    const { data, error } = await supabase.from('contracts').select('number').eq('product', product).eq('crop', crop);
    if (error) console.error('Erro ao gerar número de contrato:', error);
    let maxSeq = 2000;
    if (data && data.length > 0) {
        data.forEach(row => {
            if (row.number) {
                const match = row.number.match(/^(\d+)/);
                if (match) {
                    const seq = parseInt(match[1], 10);
                    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
                }
            }
        });
    }
    return `${maxSeq + 1}${letter}${yearSuffix}`;
};

export const markPromissoryNoteIssued = async (shipmentIds: string[], noteNumber: string): Promise<void> => {
    const { error } = await supabase
        .from('shipments')
        .update({
            promissory_note_issued: true,
            promissory_note_issued_at: new Date().toISOString(),
            promissory_note_number: noteNumber
        })
        .in('id', shipmentIds);
    if (error) throw error;
};

export const markShipmentPaid = async (shipmentId: string, paid: boolean): Promise<void> => {
    const { error } = await supabase
        .from('shipments')
        .update({
            paid,
            paid_at: paid ? new Date().toISOString() : null
        })
        .eq('id', shipmentId);
    if (error) throw error;
};

export const generatePromissoryNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const yearShort = String(year).slice(-2);

    // Tenta incrementar o sequencial do ano atual
    const { data, error } = await supabase.rpc('increment_promissory_sequence', { p_year: year });

    if (error || !data) {
        // Fallback: busca o último número e incrementa manualmente
        const { data: existing } = await supabase
            .from('promissory_note_sequence')
            .select('last_number')
            .eq('year', year)
            .single();

        const next = (existing?.last_number ?? 0) + 1;

        await supabase
            .from('promissory_note_sequence')
            .upsert({ year, last_number: next });

        return `${String(next).padStart(3, '0')}/${yearShort}`;
    }

    return `${String(data).padStart(3, '0')}/${yearShort}`;
};

export const updateShipment = async (shipment: Shipment, originalBags: number): Promise<void> => {
    const newBags = shipment.weightKg / 60;
    const bagsDiff = newBags - originalBags;

    const dbShipment = {
        plate: shipment.plate,
        ticket_number: shipment.ticketNumber,
        weight_kg: shipment.weightKg,
        bags_count: newBags,
        delivery_date: shipment.deliveryDate,
    };

    const { error } = await supabase.from('shipments').update(dbShipment).eq('id', shipment.id);
    if (error) throw error;

    // Atualiza delivered_bags no contrato se houve diferença
    if (bagsDiff !== 0) {
        const { data: contract } = await supabase
            .from('contracts')
            .select('delivered_bags')
            .eq('id', shipment.contractId)
            .single();
        if (contract) {
            const newTotal = Math.max(0, (Number(contract.delivered_bags) || 0) + bagsDiff);
            await supabase.from('contracts').update({ delivered_bags: newTotal }).eq('id', shipment.contractId);
        }
    }
};

export const deleteShipment = async (shipmentId: string, bagsCount: number, contractId: string): Promise<void> => {
    const { error } = await supabase.from('shipments').delete().eq('id', shipmentId);
    if (error) throw error;

    // Subtrai as sacas do contrato
    const { data: contract } = await supabase
        .from('contracts')
        .select('delivered_bags')
        .eq('id', contractId)
        .single();
    if (contract) {
        const newTotal = Math.max(0, (Number(contract.delivered_bags) || 0) - bagsCount);
        await supabase.from('contracts').update({ delivered_bags: newTotal }).eq('id', contractId);
    }
};

export const bulkInsert = async (table: string, data: any[]) => {
    let conflictKey = '';
    if (table === 'contracts') conflictKey = 'number';
    if (table === 'buyers') conflictKey = 'doc';
    let dataToInsert = data;
    if (table === 'contracts') {
        dataToInsert = dataToInsert.map(item => {
            const { closing_date, ...rest } = item;
            if (closing_date && !rest.created_at) rest.created_at = closing_date;
            let totalBags = parseFloat(item.total_bags);
            if (!isNaN(totalBags)) totalBags = parseFloat(totalBags.toFixed(2));
            let totalTons = parseFloat(item.total_tons);
            if (!isNaN(totalTons)) totalTons = parseFloat(totalTons.toFixed(2));
            let finalPrice = parseFloat(item.final_price);
            const isFixed = !isNaN(finalPrice) && finalPrice > 0;
            if (isFixed) finalPrice = parseFloat(finalPrice.toFixed(2));
            return { ...rest, total_bags: totalBags, total_tons: totalTons, final_price: finalPrice, closing_date, is_fixed: isFixed };
        });
    }
    if (conflictKey) {
        const uniqueMap = new Map();
        dataToInsert.forEach(item => { if (item[conflictKey]) uniqueMap.set(item[conflictKey], item); });
        dataToInsert = Array.from(uniqueMap.values());
    }
    const options = conflictKey ? { onConflict: conflictKey } : {};
    const { error } = await supabase.from(table).upsert(dataToInsert, options);
    if (error) throw error;
};

export const bulkInsertProducers = async (data: any[]) => {
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const formattedData = data.map(row => {
        const fTypeRaw = row.funrural_type ? normalize(row.funrural_type.toString()) : '';
        let fType = null;
        if (fTypeRaw.includes('FOLHA')) fType = 'FOLHA';
        else if (fTypeRaw.includes('PJ') || fTypeRaw.includes('ISENTO')) fType = 'PJ_ISENTO';
        else if (fTypeRaw.includes('COMERCIALIZA')) fType = 'COMERCIALIZACAO';
        return {
            name: row.name, doc: row.doc, state_insc: row.state_insc,
            email: row.email, region: row.region, funrural_type: fType,
            bank_details: [{ bankName: row.bank_name || '', agency: row.agency || '', account: row.account || '', holder: row.holder || row.name, holderDoc: row.holder_doc || row.doc }]
        };
    });
    const uniqueMap = new Map();
    formattedData.forEach(item => { if (item.doc) uniqueMap.set(item.doc, item); });
    const { error } = await supabase.from('producers').upsert(Array.from(uniqueMap.values()), { onConflict: 'doc' });
    if (error) throw error;
};

export const bulkInsertFarms = async (csvData: any[]) => {
    if (csvData.length === 0) return;
    const documents = [...new Set(csvData.map(row => row.producer_doc).filter(Boolean))];
    const { data: producers, error } = await supabase.from('producers').select('id, doc').in('doc', documents);
    if (error) throw new Error('Erro ao buscar produtores: ' + error.message);
    if (!producers) return;
    const docMap = new Map();
    producers.forEach(p => docMap.set(p.doc, p.id));
    const farmsToInsert: any[] = [];
    const errors: string[] = [];
    const uniqueFarmCheck = new Set();
    csvData.forEach(row => {
        const producerId = docMap.get(row.producer_doc);
        if (producerId) {
            const key = `${producerId}-${row.name}`;
            if (!uniqueFarmCheck.has(key)) {
                uniqueFarmCheck.add(key);
                farmsToInsert.push({ producer_id: producerId, name: row.name, address: row.address });
            }
        } else {
            errors.push(`Produtor com CPF/CNPJ ${row.producer_doc} não encontrado.`);
        }
    });
    if (farmsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('farms').upsert(farmsToInsert, { ignoreDuplicates: true });
        if (insertError) throw insertError;
    }
    if (errors.length > 0) {
        console.warn("Algumas fazendas não foram importadas:", errors);
        throw new Error(`Importação parcial. ${farmsToInsert.length} salvas. ${errors.length} falharam (Produtor não encontrado).`);
    }
};
