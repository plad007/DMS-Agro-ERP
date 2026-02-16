import React, { useState } from 'react';
import { Download, Upload, Database, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { bulkInsert } from '../services/mockService';

const CSV_TEMPLATES = {
    producers: `name,doc,state_insc,region,email,funrural_type\nJoão Silva,111.222.333-44,12345678,Pedro Afonso,joao@email.com,COMERCIALIZACAO`,
    buyers: `name,doc,state_insc,address,type\nCargill Agricola,12.345.678/0001-90,99988877,Av Industrial 1000,TRADING`,
    contracts: `number,product,crop,seller_name,buyer_name,total_bags,total_tons,final_price,pickup_location,status,freight_type\n1001S24,SOJA,23/24,João Silva,Cargill Agricola,5000,300,120.50,Fazenda Esperança,Assinado,FOB`,
};

export const Settings: React.FC = () => {
    const [importStatus, setImportStatus] = useState<{msg: string, type: 'success' | 'error' | ''}>({msg: '', type: ''});
    const [loading, setLoading] = useState(false);

    const handleDownloadTemplate = (type: keyof typeof CSV_TEMPLATES) => {
        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(CSV_TEMPLATES[type]);
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", `modelo_importacao_${type}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const parseCSV = (text: string): any[] => {
        const rows = text.trim().split('\n');
        const headers = rows[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            // Basic CSV split (Note: doesn't handle commas inside quotes properly, simpler for now)
            const values = row.split(',').map(v => v.trim());
            const obj: any = {};
            
            headers.forEach((header, index) => {
                let val: string | number | boolean = values[index];
                
                // Simple type conversion
                if (val && !isNaN(Number(val)) && header !== 'doc' && header !== 'number') {
                     val = Number(val);
                }
                obj[header] = val;
            });
            data.push(obj);
        }
        return data;
    };

    const handleImport = async (table: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setImportStatus({msg: 'Lendo arquivo...', type: ''});

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const data = parseCSV(text);
                
                if (data.length === 0) throw new Error("Arquivo vazio ou formato inválido");

                await bulkInsert(table, data);
                
                setImportStatus({msg: `Sucesso! ${data.length} registros importados para ${table}.`, type: 'success'});
                // Reset input
                event.target.value = '';
            } catch (error: any) {
                console.error(error);
                setImportStatus({msg: `Erro na importação: ${error.message || 'Verifique o formato do CSV'}`, type: 'error'});
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <Database className="w-6 h-6 text-slate-700" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Dados</h2>
                        <p className="text-slate-500 text-sm">Importação e Exportação em lote via CSV</p>
                    </div>
                </div>

                {importStatus.msg && (
                    <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${importStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {importStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {importStatus.msg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* PRODUCERS CARD */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">Produtores</h3>
                        <p className="text-xs text-slate-500 mb-4 h-10">
                            Importe cadastros de produtores. Campos: nome, documento, região, email.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('producers')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo CSV
                            </button>
                            <label className={`flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-emerald-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? 'Importando...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('producers', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                    {/* BUYERS CARD */}
                     <div className="border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">Compradores</h3>
                        <p className="text-xs text-slate-500 mb-4 h-10">
                            Importe tradings e fábricas. Campos: razão social, cnpj, inscrição, endereço.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('buyers')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo CSV
                            </button>
                             <label className={`flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-blue-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? 'Importando...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('buyers', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                    {/* CONTRACTS CARD */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-amber-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">Contratos (Histórico)</h3>
                        <p className="text-xs text-slate-500 mb-4 h-10">
                            Importe seu legado de contratos. Certifique-se que Vendedor/Comprador existam.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('contracts')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo CSV
                            </button>
                             <label className={`flex items-center justify-center gap-2 w-full py-2 bg-amber-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-amber-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? 'Importando...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('contracts', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                </div>

                <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4"/> Atenção ao formato CSV</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Utilize a separação por vírgulas (<code>,</code>).</li>
                        <li>Não use pontos de milhar em números, apenas ponto para decimais (Ex: <code>1200.50</code>).</li>
                        <li>As datas devem estar no formato <code>YYYY-MM-DD</code> se houver (o sistema gerará data atual se não informado).</li>
                        <li>Para Produtores: <code>funrural_type</code> deve ser exatamente <code>FOLHA</code> ou <code>COMERCIALIZACAO</code>.</li>
                    </ul>
                </div>

            </div>
        </div>
    );
};