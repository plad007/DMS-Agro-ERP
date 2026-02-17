import React, { useState } from 'react';
import { Download, Upload, Database, AlertCircle, CheckCircle, FileSpreadsheet, MapPin, Settings2 } from 'lucide-react';
import { bulkInsert, bulkInsertFarms, bulkInsertProducers } from '../services/mockService';

const CSV_TEMPLATES = {
    producers: `name,doc,state_insc,region,email,funrural_type,bank_name,agency,account\nJoão Silva,111.222.333-44,12345678,"Lot. São Silvestre, N 45",joao@email.com,COMERCIALIZACAO,Banco do Brasil,1234-5,99999-X`,
    farms: `producer_doc,name,address\n111.222.333-44,Fazenda Colorado,Rodovia TO-050 km 10`,
    buyers: `name,doc,state_insc,address,type\nCargill Agricola,12.345.678/0001-90,99988877,Av Industrial 1000,TRADING`,
    contracts: `number,product,crop,seller_name,buyer_name,total_bags,total_tons,final_price,pickup_location,status,freight_type,closing_date\n1001S24,SOJA,23/24,João Silva,Cargill Agricola,5000,300,120.50,Fazenda Esperança,Assinado,FOB,2024-03-15`,
};

export const Settings: React.FC = () => {
    const [importStatus, setImportStatus] = useState<{msg: string, type: 'success' | 'error' | ''}>({msg: '', type: ''});
    const [loading, setLoading] = useState(false);
    
    // Novo Estado para Codificação
    const [fileEncoding, setFileEncoding] = useState<'UTF-8' | 'ISO-8859-1'>('ISO-8859-1');

    const handleDownloadTemplate = (type: keyof typeof CSV_TEMPLATES) => {
        const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(CSV_TEMPLATES[type]);
        const link = document.createElement("a");
        link.setAttribute("href", csvContent);
        link.setAttribute("download", `modelo_importacao_${type}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Parser CSV Robusto que suporta aspas (RFC 4180 básico)
    const parseCSVLine = (line: string): string[] => {
        const values: string[] = [];
        let current = '';
        let inQuote = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuote && line[i + 1] === '"') {
                    // Aspas duplas escapadas ("")
                    current += '"';
                    i++;
                } else {
                    // Alterna estado de citação
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                // Fim do campo
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    };

    const parseCSV = (text: string): any[] => {
        const rows = text.trim().split('\n');
        if (rows.length < 2) return [];

        // Parse headers using the robust parser
        const headers = parseCSVLine(rows[0]).map(h => h.trim());
        const data = [];

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            
            const values = parseCSVLine(row);
            
            // Skip rows that look completely broken/empty
            if (values.length < 2) continue;

            const obj: any = {};
            
            headers.forEach((header, index) => {
                let val: string | number | boolean = values[index];
                
                // Simple type conversion
                if (val && !isNaN(Number(val)) && 
                    header !== 'doc' && 
                    header !== 'producer_doc' && 
                    header !== 'number' &&
                    header !== 'account' &&
                    header !== 'agency' &&
                    header !== 'state_insc' &&
                    header !== 'ticket_number' &&
                    header !== 'closing_date'
                ) {
                     val = Number(val);
                }
                
                // Remove potential quotes remaining if format was weird
                if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
                    val = val.slice(1, -1);
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

                if (table === 'farms') {
                    // Logic specific for farms (lookup producer ID)
                    await bulkInsertFarms(data);
                } else if (table === 'producers') {
                    // Logic specific for producers (convert flat bank columns to JSON)
                    await bulkInsertProducers(data);
                } else {
                    // Generic Logic
                    await bulkInsert(table, data);
                }
                
                setImportStatus({msg: `Sucesso! ${data.length} registros importados.`, type: 'success'});
                // Reset input
                event.target.value = '';
            } catch (error: any) {
                console.error(error);
                let errorMsg = error.message || 'Erro desconhecido';
                
                if (errorMsg.includes('violates check constraint')) {
                     errorMsg = "Erro de validação: Um dos campos (provavelmente Funrural ou Tipo) contém um valor inválido.";
                } else if (errorMsg.includes('violates unique constraint')) {
                     errorMsg = "Erro de duplicidade: CPF/CNPJ ou Contrato já cadastrado.";
                }

                setImportStatus({msg: `Falha: ${errorMsg}`, type: 'error'});
            } finally {
                setLoading(false);
            }
        };

        // CRITICAL FIX: Read with specific encoding to handle accents
        reader.readAsText(file, fileEncoding);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                            <Database className="w-6 h-6 text-slate-700" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Gerenciamento de Dados</h2>
                            <p className="text-slate-500 text-sm">Importação e Exportação em lote via CSV</p>
                        </div>
                    </div>

                    {/* Encoding Selector */}
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <Settings2 className="w-4 h-4 text-slate-500" />
                        <label className="text-xs font-bold text-slate-600">Codificação:</label>
                        <select 
                            value={fileEncoding}
                            onChange={(e) => setFileEncoding(e.target.value as any)}
                            className="bg-white border border-slate-300 rounded text-xs py-1 px-2 outline-none focus:border-emerald-500"
                        >
                            <option value="ISO-8859-1">Excel / Windows (ISO-8859-1)</option>
                            <option value="UTF-8">Padrão Web (UTF-8)</option>
                        </select>
                    </div>
                </div>

                {importStatus.msg && (
                    <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${importStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {importStatus.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {importStatus.msg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* PRODUCERS CARD */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">1. Produtores</h3>
                        <p className="text-xs text-slate-500 mb-4 h-12">
                            Importe cadastros principais. Inclui colunas para dados bancários básicos.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('producers')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo
                            </button>
                            <label className={`flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-emerald-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? '...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('producers', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                    {/* FARMS CARD */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-emerald-200 transition-colors bg-emerald-50/30">
                        <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            2. Fazendas <MapPin className="w-4 h-4 text-emerald-600" />
                        </h3>
                        <p className="text-xs text-slate-500 mb-4 h-12">
                            Vincula fazendas aos produtores pelo CPF/CNPJ. Importe os produtores antes.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('farms')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo
                            </button>
                            <label className={`flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-emerald-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? '...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('farms', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                    {/* BUYERS CARD */}
                     <div className="border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">3. Compradores</h3>
                        <p className="text-xs text-slate-500 mb-4 h-12">
                            Importe tradings e fábricas. Campos: razão social, cnpj, inscrição.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('buyers')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo
                            </button>
                             <label className={`flex items-center justify-center gap-2 w-full py-2 bg-blue-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-blue-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? '...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('buyers', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                    {/* CONTRACTS CARD */}
                    <div className="border border-slate-200 rounded-xl p-5 hover:border-amber-200 transition-colors">
                        <h3 className="font-bold text-slate-800 mb-2">4. Contratos</h3>
                        <p className="text-xs text-slate-500 mb-4 h-12">
                            Importe seu legado de contratos. Certifique-se que Vendedor/Comprador existam.
                        </p>
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => handleDownloadTemplate('contracts')}
                                className="flex items-center justify-center gap-2 w-full py-2 bg-slate-50 text-slate-600 text-xs font-bold uppercase rounded border border-slate-200 hover:bg-slate-100"
                             >
                                <Download className="w-4 h-4" /> Baixar Modelo
                            </button>
                             <label className={`flex items-center justify-center gap-2 w-full py-2 bg-amber-600 text-white text-xs font-bold uppercase rounded cursor-pointer hover:bg-amber-700 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload className="w-4 h-4" /> 
                                {loading ? '...' : 'Importar CSV'}
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleImport('contracts', e)} disabled={loading} />
                            </label>
                        </div>
                    </div>

                </div>

                <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800">
                    <h4 className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4"/> Dicas para evitar erros</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Se os acentos aparecerem errados, mude a opção <strong>Codificação</strong> lá em cima para <strong>Excel / Windows</strong>.</li>
                        <li>Se o endereço contiver vírgulas (ex: "Rua A, 123"), o Excel geralmente coloca aspas automaticamente. Se der erro, verifique isso.</li>
                        <li>Não use pontos de milhar em números, apenas ponto para decimais (Ex: 1200.50).</li>
                    </ul>
                </div>

            </div>
        </div>
    );
};