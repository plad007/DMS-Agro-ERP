
import React, { useState, useMemo } from 'react';
import { 
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, LabelList
} from 'recharts';
import { Calendar, TrendingUp, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Filter, X } from 'lucide-react';
import { Contract } from '../types';

interface ReportsProps {
    contracts: Contract[];
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const Reports: React.FC<ReportsProps> = ({ contracts }) => {
    const [activeTab, setActiveTab] = useState<'VOLUME' | 'FINANCIAL'>('VOLUME');
    
    // Volume Tab State
    const [selectedProduct, setSelectedProduct] = useState<string>('SOJA');
    const [comparisonDate, setComparisonDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Financial Tab State (Filters)
    const [financialStartDate, setFinancialStartDate] = useState<string>('');
    const [financialEndDate, setFinancialEndDate] = useState<string>('');

    // --- HELPER: Extrair Ano da Safra ---
    // Ex: "2026 (S)" -> 2026, "23/24" -> 2024
    const getCropYear = (crop: string): number => {
        if (crop.includes('/')) {
            const parts = crop.split('/');
            const lastPart = parts[parts.length - 1];
            return lastPart.length === 2 ? 2000 + parseInt(lastPart) : parseInt(lastPart);
        }
        const match = crop.match(/\d{4}/);
        return match ? parseInt(match[0]) : new Date().getFullYear();
    };

    // --- LOGIC 1: SAFRA PACING (EVOLUÇÃO COMPARATIVA RELATIVA) ---
    const pacingData = useMemo(() => {
        const crops: string[] = Array.from(new Set(contracts.map(c => c.crop))).sort();
        
        const relevantContracts = contracts
            .filter(c => c.product === selectedProduct)
            .map(c => ({
                ...c,
                parsedDate: new Date(c.closingDate || c.createdAt),
                cropYear: getCropYear(c.crop)
            }))
            .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

        // Normalização Temporal: Mapear tudo para um "Ano Virtual" (ex: 2000)
        // Se a venda foi no Ano da Safra (ex: 2026 p/ Safra 2026) -> Mapeia para 2000
        // Se a venda foi no Ano Anterior (ex: 2025 p/ Safra 2026) -> Mapeia para 1999
        // Isso permite alinhar safras diferentes em uma linha do tempo de ~24 meses
        
        const timelineData: Record<string, any> = {};
        const REFERENCE_YEAR = 2000; // Ano bissexto para garantir 29/fev

        relevantContracts.forEach(c => {
            const contractYear = c.parsedDate.getUTCFullYear();
            const yearDiff = c.cropYear - contractYear; // 0 se mesmo ano, 1 se ano anterior
            
            // Inverter lógica para mapear no gráfico:
            // Ano Safra (Diff 0) -> 2000
            // Ano Anterior (Diff 1) -> 1999
            const virtualYear = REFERENCE_YEAR - yearDiff;
            
            const month = String(c.parsedDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(c.parsedDate.getUTCDate()).padStart(2, '0');
            
            // Key para ordenação cronológica: YYYY-MM-DD (Virtual)
            const key = `${virtualYear}-${month}-${day}`;
            
            if (!timelineData[key]) {
                timelineData[key] = { 
                    name: `${day}/${month}`, 
                    virtualDate: key,
                    isPreviousYear: yearDiff > 0 
                };
                crops.forEach(crop => timelineData[key][crop] = 0);
            }
            
            timelineData[key][c.crop] = (timelineData[key][c.crop] || 0) + c.totalBags;
        });

        // Ordenar cronologicamente pelo eixo virtual
        const sortedData: any[] = Object.values(timelineData).sort((a: any, b: any) => a.virtualDate.localeCompare(b.virtualDate));

        // Acumular valores
        const finalData = [];
        const runningTotals: Record<string, number> = {};
        crops.forEach(c => runningTotals[c] = 0);

        for (const dayData of sortedData) {
            const newRow: any = { 
                name: dayData.name, 
                virtualDate: dayData.virtualDate,
                // Label extra para eixo X
                periodLabel: dayData.isPreviousYear ? 'Ano Ant.' : 'Ano Safra'
            };
            
            crops.forEach(crop => {
                runningTotals[crop] += (dayData[crop] || 0);
                newRow[crop] = runningTotals[crop];
            });
            finalData.push(newRow);
        }

        return { chartData: finalData, crops };
    }, [contracts, selectedProduct]);

    // --- KPI CALCULATION (EXACT SUM) ---
    // Calcula o volume acumulado até a "Data Equivalente" em cada safra
    const pacingMetrics = useMemo(() => {
        const compDate = new Date(comparisonDate);
        const compDay = compDate.getUTCDate();
        const compMonth = compDate.getUTCMonth();
        
        // Ano da data de corte (ex: selecionou 17/02/2026 -> 2026)
        const refYear = compDate.getUTCFullYear();

        const metrics: Record<string, number> = {};

        pacingData.crops.forEach(crop => {
            const cropYear = getCropYear(crop);
            
            // Diferença entre o ano da safra e o ano da data de corte
            // Ex: Safra 2026, Corte 2026 -> diff = 0
            // Ex: Safra 2025, Corte 2026 -> Precisamos simular Corte em 2025
            
            // Lógica: Queremos saber quanto tinha na Safra X na mesma época relativa.
            // Se o corte é Fev/2026 (Ano da Safra 2026).
            // Para Safra 2025, queremos o volume até Fev/2025.
            
            // Calculamos o "Offset" da data de corte em relação à sua própria safra de referência?
            // Não, assumimos que a data de corte define o "Hoje" para a safra mais recente ou futura.
            // Vamos assumir que a Data de Corte (comparisonDate) é a data absoluta limite para a safra correspondente ao ano do corte.
            // Para as outras, ajustamos o ano.
            
            const targetLimitDate = new Date(Date.UTC(cropYear - (refYear - compDate.getUTCFullYear()), compMonth, compDay));
            // Correção: Se a data de corte é 17/02/2026.
            // Para Safra 2026 -> Limite 17/02/2026.
            // Para Safra 2025 -> Limite 17/02/2025.
            // Para Safra 2027 -> Limite 17/02/2027.
            // Mas espera, se a venda foi feita em Out/2025 para a Safra 2026. 
            // 17/02/2026 é maior que Out/2025. Então entra.
            
            // A lógica genérica é: Data Limite = (Ano da Safra - (Diferença Ano Corte vs Ano Safra Base???))
            // Simplificando: Assumimos que a Data de Corte é "Dia/Mês do Ano da Safra".
            
            // Se selecionei 17/02/2026. Estou olhando para o ponto "Fevereiro do Ano de Colheita".
            // Para a Safra 2025, o ponto equivalente é "Fevereiro do Ano de Colheita (2025)".
            
            // MAS CUIDADO: Se eu selecionar "Outubro/2025". Isso é "Outubro do Ano Anterior à Colheita 2026".
            // Para Safra 2025, o equivalente seria "Outubro do Ano Anterior (2024)".
            
            // Como saber se a data de corte é "Ano Safra" ou "Ano Anterior"?
            // Comparando comparisonDateYear com getCropYear da safra MAIS FUTURA presente nos dados? 
            // Ou mais simples: Usar a data selecionada como verdade absoluta para a safra do mesmo ano.
            
            // Vamos calcular o "Delta Anual" entre a Data de Corte e o Ano da Safra dessa data.
            // Ex: Corte 17/02/2026. AnoCorte = 2026. Delta = 0.
            // Ex: Corte 15/10/2025. Se considerarmos isso contexto de Safra 2026, Delta = -1.
            
            // ESTRATÉGIA SEGURA:
            // Calcular volume somando contratos onde:
            // (AnoContrato - AnoSafraContrato) < (AnoCorte - AnoSafraCorte) OR
            // ((AnoContrato - AnoSafraContrato) == (AnoCorte - AnoSafraCorte) AND Data <= Corte)
            
            // Simplificação Visual para o Usuário:
            // Data limite para Safra X = Dia/Mês do Corte + Ano X (ajustado pelo offset do corte original)
            
            // Vamos assumir que o usuário selecionou uma data que faz sentido para a Safra de interesse (ex: 2026).
            // Se cropYear == 2026 e DateCorte == 2026 -> Offset 0.
            // Data Limite para Safra 2025 = 2025.
            
            // Se cropYear == 2026 e DateCorte == 2025 -> Offset -1.
            // Data Limite para Safra 2025 = 2024.
            
            // Descobrir qual "Safra" a data de corte representa.
            // Geralmente é o próprio ano da data.
            const cutYear = parseInt(comparisonDate.split('-')[0]);
            const cutMonth = parseInt(comparisonDate.split('-')[1]); // 1-12
            
            // Se mês > 9 (Out/Nov/Dez), geralmente estamos olhando para a safra do ano seguinte (Safra Nova).
            // Se mês < 5 (Jan-Mai), estamos olhando para a safra do ano corrente (Colheita).
            // Mas vamos usar aritmética simples:
            
            const yearShift = cropYear - cutYear; 
            // Ex: Safra 2026, Corte 2026 -> Shift 0. 
            // Safra 2025, Corte 2026 -> Shift -1. Data deve ser 2025.
            
            // CUIDADO: Se Corte é 17/02/2026.
            // Para Safra 2026 -> Data Limite 17/02/2026.
            // Para Safra 2025 -> Data Limite 17/02/2025.
            // Para Safra 2027 -> Data Limite 17/02/2027.
            
            const limitDate = new Date(comparisonDate);
            limitDate.setFullYear(limitDate.getFullYear() + yearShift);
            
            // Soma
            const vol = contracts
                .filter(c => c.crop === crop && c.product === selectedProduct)
                .reduce((acc, c) => {
                    const cDate = new Date(c.closingDate || c.createdAt);
                    // Comparação simples de data
                    if (cDate <= limitDate) {
                        return acc + c.totalBags;
                    }
                    return acc;
                }, 0);
                
            metrics[crop] = vol;
        });

        return metrics;

    }, [contracts, comparisonDate, selectedProduct, pacingData.crops]);


    // --- LOGIC 2: FINANCIAL FORECAST (COMISSÕES) ---
    const financialData = useMemo(() => {
        const dataByMonth: Record<string, { month: string, revenue: number, volume: number, rawDate: string }> = {};

        contracts.forEach(c => {
            // Usar data de pagamento
            const payDate = new Date(c.paymentDate);
            // Key format: YYYY-MM
            const key = `${payDate.getUTCFullYear()}-${String(payDate.getUTCMonth() + 1).padStart(2, '0')}`;
            const label = `${MONTH_NAMES[payDate.getUTCMonth()]}/${payDate.getUTCFullYear().toString().substr(2)}`;

            if (!dataByMonth[key]) {
                dataByMonth[key] = { month: label, revenue: 0, volume: 0, rawDate: key };
            }

            const commissionVal = c.totalBags * c.commissionPerBag;
            
            dataByMonth[key].revenue += commissionVal;
            dataByMonth[key].volume += c.totalBags;
        });

        let result = Object.values(dataByMonth).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

        // APPLY FILTERS
        if (financialStartDate) {
            result = result.filter(item => item.rawDate >= financialStartDate);
        }
        if (financialEndDate) {
            result = result.filter(item => item.rawDate <= financialEndDate);
        }

        return result;
    }, [contracts, financialStartDate, financialEndDate]);

    const totalRevenueForecast = financialData.reduce((acc, curr) => acc + curr.revenue, 0);

    const clearFinancialFilters = () => {
        setFinancialStartDate('');
        setFinancialEndDate('');
    };

    // Helper para formatar valores no gráfico financeiro
    const formatCurrencyLabel = (value: number) => {
        if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
        return `R$ ${value}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Relatórios Gerenciais</h2>
                    <p className="text-slate-500 text-sm">Visão consolidada para Diretoria (CO)</p>
                </div>
                
                {/* TABS SWITCHER */}
                <div className="bg-slate-200 p-1 rounded-lg flex">
                    <button 
                        onClick={() => setActiveTab('VOLUME')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'VOLUME' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-emerald-700'}`}
                    >
                        <TrendingUp className="w-4 h-4" /> Evolução de Safra
                    </button>
                    <button 
                        onClick={() => setActiveTab('FINANCIAL')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'FINANCIAL' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-blue-700'}`}
                    >
                        <Wallet className="w-4 h-4" /> Fluxo Financeiro
                    </button>
                </div>
            </div>

            {/* --- ABA 1: VOLUME PACING --- */}
            {activeTab === 'VOLUME' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Controls */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center mb-6">
                         <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Produto:</span>
                            <select 
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-slate-50 font-medium"
                            >
                                <option value="SOJA">Soja</option>
                                <option value="MILHO">Milho</option>
                                <option value="TRIGO">Trigo</option>
                            </select>
                        </div>
                        <div className="w-px h-6 bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Data de Corte (Comparativo):</span>
                            <input 
                                type="date" 
                                value={comparisonDate}
                                onChange={(e) => setComparisonDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-slate-50"
                            />
                        </div>
                        <span className="text-xs text-slate-400 ml-2 italic">
                            *Comparação baseada no ciclo da safra (inclui vendas antecipadas do ano anterior).
                        </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* CHART */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px]">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Curva de Evolução (Pacing)</h3>
                            <p className="text-xs text-slate-500 mb-6">Volume acumulado considerando ciclo de originação (~18 meses).</p>
                            
                            <ResponsiveContainer width="100%" height="85%">
                                <LineChart data={pacingData.chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="name" 
                                        tick={{fontSize: 10, fill: '#64748b'}} 
                                        minTickGap={30}
                                        interval={15} // Show fewer ticks
                                        tickFormatter={(val, index) => {
                                            // Show month name only occasionally
                                            return val;
                                        }}
                                    />
                                    <YAxis 
                                        tick={{fontSize: 12, fill: '#64748b'}} 
                                        tickFormatter={(val) => `${(val/1000).toFixed(0)}k`}
                                    />
                                    <Tooltip 
                                        formatter={(value: number) => value.toLocaleString() + ' scs'}
                                        labelFormatter={(label, payload) => {
                                            if(payload && payload[0]) {
                                                return `${label} (${payload[0].payload.periodLabel})`;
                                            }
                                            return label;
                                        }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                    />
                                    <Legend />
                                    {pacingData.crops.map((crop, index) => (
                                        <Line 
                                            key={crop}
                                            type="monotone" 
                                            dataKey={crop} 
                                            name={`Safra ${crop}`}
                                            stroke={index === 0 ? '#94a3b8' : index === 1 ? '#10b981' : '#3b82f6'} 
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                            connectNulls={true}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* KPI CARDS */}
                        <div className="space-y-4">
                            <div className="bg-emerald-900 text-white p-6 rounded-xl shadow-lg">
                                <h4 className="text-emerald-200 text-xs font-bold uppercase mb-2">
                                    Volume Acumulado até {new Date(comparisonDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'})}
                                </h4>
                                <p className="text-[10px] text-emerald-300 mb-4 opacity-80">
                                    Soma total de contratos fechados até a data equivalente no ano da safra.
                                </p>
                                
                                {pacingData.crops.map((crop, idx) => {
                                    const vol = pacingMetrics[crop] || 0;
                                    const prevCrop = pacingData.crops[idx-1];
                                    const prevVol = prevCrop ? (pacingMetrics[prevCrop] || 0) : 0;
                                    let percent = 0;
                                    
                                    if(prevVol > 0) {
                                        percent = ((vol - prevVol) / prevVol) * 100;
                                    }

                                    return (
                                        <div key={crop} className="mb-6 last:mb-0 border-b border-emerald-800 last:border-0 pb-4 last:pb-0">
                                            <p className="text-sm font-medium text-emerald-100 mb-1">Safra {crop}</p>
                                            <div className="flex items-end justify-between">
                                                <span className="text-2xl font-bold">{vol.toLocaleString()} scs</span>
                                                {idx > 0 && prevVol > 0 && (
                                                    <span className={`text-xs font-bold flex items-center ${percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {percent >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1"/> : <ArrowDownRight className="w-3 h-3 mr-1"/>}
                                                        {percent.toFixed(1)}% vs Safra {prevCrop}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4">Análise de Performance</h4>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex gap-2 items-start">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5"></div>
                                        <span>Utilize a data de corte para simular "onde estávamos" nesta mesma época em anos anteriores.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ABA 2: FINANCIAL FORECAST --- */}
            {activeTab === 'FINANCIAL' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     
                     {/* FINANCIAL FILTERS */}
                     <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center mb-6">
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-bold text-slate-700">Filtrar Período:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase font-bold">De:</span>
                            <input 
                                type="month" 
                                value={financialStartDate}
                                onChange={(e) => setFinancialStartDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-slate-50"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 uppercase font-bold">Até:</span>
                            <input 
                                type="month" 
                                value={financialEndDate}
                                onChange={(e) => setFinancialEndDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm bg-slate-50"
                            />
                        </div>
                        {(financialStartDate || financialEndDate) && (
                            <button 
                                onClick={clearFinancialFilters}
                                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-bold ml-2"
                            >
                                <X className="w-3 h-3" /> Limpar Filtro
                            </button>
                        )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                <DollarSign className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Previsão Total (Período)</p>
                                <h3 className="text-2xl font-bold text-slate-800">R$ {totalRevenueForecast.toLocaleString()}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                                <CheckCircleIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Realizado (Pago)</p>
                                <h3 className="text-2xl font-bold text-slate-800">R$ 0,00</h3>
                                <p className="text-[10px] text-slate-400">Integração Bancária Pendente</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Melhor Mês</p>
                                <h3 className="text-xl font-bold text-slate-800">
                                    {financialData.sort((a,b) => b.revenue - a.revenue)[0]?.month || '-'}
                                </h3>
                            </div>
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[500px]">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Previsão de Receita por Mês</h3>
                                <p className="text-sm text-slate-500">Baseado na data de pagamento dos contratos ativos.</p>
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height="85%">
                            <ComposedChart data={financialData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="month" tick={{fontSize: 12}} />
                                <YAxis yAxisId="left" tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} />
                                <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${(val/1000).toFixed(0)}k scs`} />
                                <Tooltip 
                                    formatter={(value: any, name: string) => {
                                        if (name === 'Receita (R$)') return `R$ ${value.toLocaleString()}`;
                                        return `${value.toLocaleString()} scs`;
                                    }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="revenue" name="Receita (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                                    <LabelList 
                                        dataKey="revenue" 
                                        position="top" 
                                        formatter={formatCurrencyLabel}
                                        style={{ fill: '#1e293b', fontSize: '11px', fontWeight: 'bold' }} 
                                    />
                                </Bar>
                                <Line yAxisId="right" type="monotone" dataKey="volume" name="Volume (scs)" stroke="#10b981" strokeWidth={2} />
                            </ComposedChart>
                        </ResponsiveContainer>
                     </div>
                </div>
            )}
        </div>
    );
};

// Ícone auxiliar
const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
