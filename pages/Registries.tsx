
import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Tractor, Building2, MapPin, X, Save, Eye, Wallet, FileText, Banknote, Check, AlertTriangle, CheckCircle } from 'lucide-react';
import { Producer, Buyer, Farm, BankAccount, BuyerPartner } from '../types';
import { getProducers, getBuyers, saveProducer, saveBuyer, deleteProducer, deleteBuyer, checkFarmDependencies, deleteFarm, isValidUuid, ProducerPartialSaveError } from '../services/mockService';

// Helper to display friendly names
const getFunruralLabel = (type: string) => {
    switch (type) {
        case 'FOLHA': return 'Em Folha';
        case 'COMERCIALIZACAO': return 'Comercialização';
        case 'PJ_ISENTO': return 'PJ (Isento)';
        default: return type;
    }
};

export const Registries: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'producers' | 'buyers'>('producers');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data State
  const [producers, setProducers] = useState<Producer[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isProducerModalOpen, setIsProducerModalOpen] = useState(false);
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  
  // View Modal State
  const [viewingProducer, setViewingProducer] = useState<Producer | null>(null);
  const [viewingBuyer, setViewingBuyer] = useState<Buyer | null>(null);

  // Form State
  const [producerForm, setProducerForm] = useState<Partial<Producer>>({
      farms: [],
      bankDetails: [],
      funruralType: 'COMERCIALIZACAO'
  });
  
  const [buyerForm, setBuyerForm] = useState<Partial<Buyer>>({
      type: 'TRADING',
      partners: []
  });

  const [tempPartner, setTempPartner] = useState<Partial<BuyerPartner>>({ name: '', cpf: '', rg: '', address: '' });

  // Temporary Inputs
  const [tempFarm, setTempFarm] = useState<Partial<Farm>>({ name: '', address: '' });
  const [tempBank, setTempBank] = useState<Partial<BankAccount>>({ bankName: '', agency: '', account: '', holder: '', holderDoc: '' });

  // Farm Editing & Error/Success States
  const [editingFarmId, setEditingFarmId] = useState<string | null>(null);
  const [editingFarmDraft, setEditingFarmDraft] = useState<{ name: string; address: string }>({ name: '', address: '' });
  const [isSavingProducer, setIsSavingProducer] = useState(false);
  const [producerModalError, setProducerModalError] = useState<string | null>(null);
  const [pageSuccessMessage, setPageSuccessMessage] = useState<string | null>(null);

  // Farm Delete Modal State
  const [farmDeleteTarget, setFarmDeleteTarget] = useState<Farm | null>(null);
  const [isCheckingFarmDelete, setIsCheckingFarmDelete] = useState(false);
  const [farmDeleteBlockReason, setFarmDeleteBlockReason] = useState<string | null>(null);
  const [farmDeleteCheckFailed, setFarmDeleteCheckFailed] = useState(false);
  const [farmDeleteError, setFarmDeleteError] = useState<string | null>(null);
  const [isDeletingFarm, setIsDeletingFarm] = useState(false);

  const refreshData = async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([getProducers(), getBuyers()]);
      setProducers(p);
      setBuyers(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // --- Handlers for PRODUCER ---

  const resetProducerModalAuxState = () => {
    setTempFarm({ name: '', address: '' });
    setTempBank({ bankName: '', agency: '', account: '', holder: '', holderDoc: '' });
    setEditingFarmId(null);
    setEditingFarmDraft({ name: '', address: '' });
    setProducerModalError(null);
    setFarmDeleteTarget(null);
    setFarmDeleteBlockReason(null);
    setFarmDeleteCheckFailed(false);
    setFarmDeleteError(null);
  };

  const handleEditProducer = (p: Producer) => {
    resetProducerModalAuxState();
    setProducerForm(JSON.parse(JSON.stringify(p))); // Deep copy
    setIsProducerModalOpen(true);
  };

  const handleNewProducer = () => {
    resetProducerModalAuxState();
    setProducerForm({
        id: `temp-${Date.now().toString(36)}`, // Temp ID for new
        farms: [],
        bankDetails: [],
        funruralType: 'COMERCIALIZACAO'
    });
    setIsProducerModalOpen(true);
  };

  const normalizeFarmName = (name?: string) => (name || '').trim().toLowerCase();

  const hasDuplicateFarmName = (farms: Farm[], candidateName: string, ignoreFarmId?: string) => {
    const normalized = normalizeFarmName(candidateName);
    if (!normalized) return false;
    return farms.some(f => f.id !== ignoreFarmId && normalizeFarmName(f.name) === normalized);
  };

  const handleSaveProducer = async () => {
    if (isSavingProducer) return;
    setProducerModalError(null);

    if (!producerForm.name?.trim() || !producerForm.doc?.trim()) {
        setProducerModalError('Preencha Nome do Produtor e CPF/CNPJ antes de salvar.');
        return;
    }

    let nextFarms = [...(producerForm.farms || [])];

    // Se houver edição inline de fazenda em aberto, aplica e valida antes de salvar
    if (editingFarmId) {
        const trimmedDraftName = editingFarmDraft.name.trim();
        if (!trimmedDraftName) {
            setProducerModalError('O nome da fazenda em edição não pode ficar vazio.');
            return;
        }
        if (hasDuplicateFarmName(nextFarms, trimmedDraftName, editingFarmId)) {
            setProducerModalError(`Já existe outra fazenda chamada "${trimmedDraftName}" para este produtor.`);
            return;
        }
        nextFarms = nextFarms.map(f =>
            f.id === editingFarmId
                ? { ...f, name: trimmedDraftName, address: editingFarmDraft.address.trim() }
                : f
        );
    }

    // Se o usuário digitou nos campos temporários de fazenda sem clicar no "+", inclui automaticamente
    const pendingFarmName = (tempFarm.name || '').trim();
    const pendingFarmAddress = (tempFarm.address || '').trim();
    let includedPendingFarm = false;

    if (pendingFarmAddress && !pendingFarmName) {
        setProducerModalError('Você preencheu o endereço da fazenda, mas não informou o Nome da Fazenda.');
        return;
    }

    if (pendingFarmName) {
        if (hasDuplicateFarmName(nextFarms, pendingFarmName)) {
            setProducerModalError(`Já existe uma fazenda chamada "${pendingFarmName}" para este produtor.`);
            return;
        }
        nextFarms.push({
            id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: pendingFarmName,
            address: pendingFarmAddress
        });
        includedPendingFarm = true;
    }

    const payload: Producer = {
        ...(producerForm as Producer),
        name: producerForm.name.trim(),
        doc: producerForm.doc.trim(),
        farms: nextFarms
    };

    // Atualiza o formulário com a fazenda pendente já incorporada para não se perder caso ocorra falha no banco
    if (includedPendingFarm || editingFarmId) {
        setProducerForm(payload);
        if (includedPendingFarm) setTempFarm({ name: '', address: '' });
        if (editingFarmId) {
            setEditingFarmId(null);
            setEditingFarmDraft({ name: '', address: '' });
        }
    }

    setIsSavingProducer(true);
    try {
        const savedProducer = await saveProducer(payload);
        await refreshData();
        setIsProducerModalOpen(false);
        setPageSuccessMessage(
            `Produtor "${savedProducer?.name || payload.name}" salvo com sucesso no Supabase (${savedProducer?.farms?.length ?? nextFarms.length} fazenda(s)).`
        );
    } catch (error: any) {
        console.error('Erro ao salvar produtor e fazendas:', error);
        if (error instanceof ProducerPartialSaveError) {
            // Preserva o ID real do produtor salvo e os UUIDs das fazendas já persistidas para evitar duplicação na nova tentativa
            const savedFarmsByName = new Map(
                error.savedFarms.map(sf => [normalizeFarmName(sf.name), sf])
            );
            setProducerForm(prev => ({
                ...prev,
                id: error.savedProducerId,
                farms: (prev.farms || []).map(f => {
                    if (isValidUuid(f.id)) return f;
                    const persisted = savedFarmsByName.get(normalizeFarmName(f.name));
                    return persisted ? persisted : f;
                })
            }));
            await refreshData();
        }
        setProducerModalError(error?.message || 'Não foi possível salvar os dados no Supabase.');
    } finally {
        setIsSavingProducer(false);
    }
  };

  const handleDeleteProducer = async (id: string) => {
    if(confirm('Excluir este produtor?')) {
        setLoading(true);
        await deleteProducer(id);
        await refreshData();
    }
  };

  const addFarm = () => {
      setProducerModalError(null);
      const trimmedName = (tempFarm.name || '').trim();
      const trimmedAddress = (tempFarm.address || '').trim();

      if (!trimmedName) {
          setProducerModalError('Informe o nome da fazenda antes de adicionar.');
          return;
      }

      const currentFarms = producerForm.farms || [];
      if (hasDuplicateFarmName(currentFarms, trimmedName)) {
          setProducerModalError(`Já existe uma fazenda chamada "${trimmedName}" cadastrada para este produtor.`);
          return;
      }

      const newFarm: Farm = {
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: trimmedName,
          address: trimmedAddress
      };
      setProducerForm(prev => ({
          ...prev,
          farms: [...(prev.farms || []), newFarm]
      }));
      setTempFarm({ name: '', address: '' });
  };

  const startEditFarm = (farm: Farm) => {
      setProducerModalError(null);
      setEditingFarmId(farm.id);
      setEditingFarmDraft({ name: farm.name || '', address: farm.address || '' });
  };

  const cancelEditFarm = () => {
      setEditingFarmId(null);
      setEditingFarmDraft({ name: '', address: '' });
  };

  const saveFarmEdit = () => {
      if (!editingFarmId) return;
      setProducerModalError(null);
      const trimmedName = editingFarmDraft.name.trim();
      const trimmedAddress = editingFarmDraft.address.trim();

      if (!trimmedName) {
          setProducerModalError('O nome da fazenda não pode ficar vazio.');
          return;
      }

      const currentFarms = producerForm.farms || [];
      if (hasDuplicateFarmName(currentFarms, trimmedName, editingFarmId)) {
          setProducerModalError(`Já existe outra fazenda chamada "${trimmedName}" para este produtor.`);
          return;
      }

      setProducerForm(prev => ({
          ...prev,
          farms: (prev.farms || []).map(f =>
              f.id === editingFarmId ? { ...f, name: trimmedName, address: trimmedAddress } : f
          )
      }));
      setEditingFarmId(null);
      setEditingFarmDraft({ name: '', address: '' });
  };

  const handleRequestDeleteFarm = async (farm: Farm) => {
      setProducerModalError(null);
      setFarmDeleteTarget(farm);
      setFarmDeleteBlockReason(null);
      setFarmDeleteCheckFailed(false);
      setFarmDeleteError(null);

      if (!isValidUuid(farm.id)) {
          setIsCheckingFarmDelete(false);
          return;
      }

      setIsCheckingFarmDelete(true);
      try {
          const deps = await checkFarmDependencies(farm.id, producerForm.id);
          if (!deps.canDelete) {
              setFarmDeleteBlockReason(deps.reason || 'Esta fazenda possui contratos vinculados e não pode ser excluída.');
          }
      } catch (error: any) {
          console.error('Erro ao verificar vínculos da fazenda:', error);
          setFarmDeleteCheckFailed(true);
          setFarmDeleteError(error?.message || 'Não foi possível verificar vínculos da fazenda no banco de dados.');
      } finally {
          setIsCheckingFarmDelete(false);
      }
  };

  const handleConfirmDeleteFarm = async () => {
      if (!farmDeleteTarget || isDeletingFarm || isCheckingFarmDelete || farmDeleteBlockReason || farmDeleteCheckFailed) {
          return;
      }

      // Fazenda ainda não persistida no Supabase: remove apenas do formulário
      if (!isValidUuid(farmDeleteTarget.id)) {
          setProducerForm(prev => ({
              ...prev,
              farms: (prev.farms || []).filter(f => f.id !== farmDeleteTarget.id)
          }));
          if (editingFarmId === farmDeleteTarget.id) cancelEditFarm();
          setFarmDeleteTarget(null);
          return;
      }

      if (!isValidUuid(producerForm.id)) {
          setFarmDeleteError('ID do produtor inválido para excluir a fazenda.');
          return;
      }

      setIsDeletingFarm(true);
      setFarmDeleteError(null);
      try {
          await deleteFarm(farmDeleteTarget.id, producerForm.id!);
          setProducerForm(prev => ({
              ...prev,
              farms: (prev.farms || []).filter(f => f.id !== farmDeleteTarget.id)
          }));
          if (editingFarmId === farmDeleteTarget.id) cancelEditFarm();
          setFarmDeleteTarget(null);
          await refreshData();
          setPageSuccessMessage(`Fazenda "${farmDeleteTarget.name || 'sem nome'}" excluída com sucesso do Supabase.`);
      } catch (error: any) {
          console.error('Erro ao excluir fazenda:', error);
          setFarmDeleteError(error?.message || 'Não foi possível excluir a fazenda no Supabase.');
      } finally {
          setIsDeletingFarm(false);
      }
  };

  const handleCloseFarmDeleteModal = () => {
      if (isDeletingFarm) return;
      setFarmDeleteTarget(null);
      setFarmDeleteBlockReason(null);
      setFarmDeleteCheckFailed(false);
      setFarmDeleteError(null);
  };

  const addBank = () => {
      if (!tempBank.bankName || !tempBank.account) {
          alert("Informe ao menos o Banco e a Conta.");
          return;
      }
      const newBank: BankAccount = {
          bankName: tempBank.bankName!,
          agency: tempBank.agency || '',
          account: tempBank.account!,
          holder: tempBank.holder || producerForm.name,
          holderDoc: tempBank.holderDoc || producerForm.doc
      };
      setProducerForm(prev => ({
          ...prev,
          bankDetails: [...(prev.bankDetails || []), newBank]
      }));
      setTempBank({ bankName: '', agency: '', account: '', holder: '', holderDoc: '' });
  };

  const removeBank = (index: number) => {
      setProducerForm(prev => ({
          ...prev,
          bankDetails: prev.bankDetails?.filter((_, i) => i !== index)
      }));
  };

  // --- Handlers for BUYER ---

  const handleEditBuyer = (b: Buyer) => {
    setBuyerForm(JSON.parse(JSON.stringify(b)));
    setTempPartner({ name: '', cpf: '', rg: '', address: '' });
    setIsBuyerModalOpen(true);
  };

  const handleNewBuyer = () => {
    setBuyerForm({
        id: Math.random().toString(36).substr(2, 9),
        type: 'TRADING'
    });
    setIsBuyerModalOpen(true);
  };

  const handleSaveBuyer = async () => {
     if (!buyerForm.name || !buyerForm.doc) {
        alert("Preencha Nome e CNPJ");
        return;
    }
    setLoading(true);
    await saveBuyer(buyerForm as Buyer);
    await refreshData();
    setIsBuyerModalOpen(false);
  };

  const handleDeleteBuyer = async (id: string) => {
    if(confirm('Excluir este comprador?')) {
        setLoading(true);
        await deleteBuyer(id);
        await refreshData();
    }
  };

  const addPartner = () => {
      if (!tempPartner.name || !tempPartner.cpf) {
          alert("Informe ao menos o Nome e o CPF do sócio.");
          return;
      }
      const newPartner: BuyerPartner = {
          name: tempPartner.name!,
          cpf: tempPartner.cpf!,
          rg: tempPartner.rg || '',
          address: tempPartner.address || ''
      };
      setBuyerForm(prev => ({
          ...prev,
          partners: [...(prev.partners || []), newPartner]
      }));
      setTempPartner({ name: '', cpf: '', rg: '', address: '' });
  };

  const removePartner = (index: number) => {
      setBuyerForm(prev => ({
          ...prev,
          partners: prev.partners?.filter((_, i) => i !== index)
      }));
  };

  // --- Filter Logic ---
  const filteredProducers = producers.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredBuyers = buyers.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-200 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('producers')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'producers' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-emerald-600'}`}
            >
                <Tractor className="w-4 h-4 mr-2" />
                Produtores
            </button>
            <button 
                 onClick={() => setActiveTab('buyers')}
                 className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'buyers' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-blue-600'}`}
            >
                <Building2 className="w-4 h-4 mr-2" />
                Compradores
            </button>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar..." 
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={activeTab === 'producers' ? handleNewProducer : handleNewBuyer}
                disabled={loading}
                className={`flex items-center px-4 py-2 text-white rounded-lg shadow-sm transition-colors text-sm font-medium disabled:opacity-50 ${activeTab === 'producers' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
                <Plus className="w-4 h-4 mr-2" />
                Novo
            </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Sincronizando com banco de dados...</div>}

      {pageSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pageSuccessMessage}</span>
          </div>
          <button onClick={() => setPageSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CONTENT: PRODUCERS */}
      {activeTab === 'producers' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
                        <tr>
                            <th className="px-6 py-4">Produtor</th>
                            <th className="px-6 py-4">Documento / I.E.</th>
                            <th className="px-6 py-4">Região</th>
                            <th className="px-6 py-4">Fazendas</th>
                            <th className="px-6 py-4">Funrural</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducers.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                                <td className="px-6 py-4">
                                    <div>{p.doc}</div>
                                    <div className="text-xs text-slate-400">IE: {p.stateInsc}</div>
                                </td>
                                <td className="px-6 py-4">{p.region}</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                        {p.farms?.length || 0} locais
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono font-bold text-slate-600">
                                    {getFunruralLabel(p.funruralType)}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => setViewingProducer(p)} className="text-slate-400 hover:text-blue-600" title="Ver Detalhes"><Eye className="w-4 h-4" /></button>
                                    <button onClick={() => handleEditProducer(p)} className="text-slate-400 hover:text-emerald-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteProducer(p.id)} className="text-slate-400 hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* CONTENT: BUYERS */}
      {activeTab === 'buyers' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 font-semibold">
                        <tr>
                            <th className="px-6 py-4">Comprador</th>
                            <th className="px-6 py-4">Documento / I.E.</th>
                            <th className="px-6 py-4">Endereço</th>
                            <th className="px-6 py-4">Tipo</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredBuyers.map(b => (
                            <tr key={b.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-900">{b.name}</td>
                                <td className="px-6 py-4">
                                    <div>{b.doc}</div>
                                    <div className="text-xs text-slate-400">IE: {b.stateInsc}</div>
                                </td>
                                <td className="px-6 py-4 max-w-xs truncate" title={b.address}>{b.address}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                        b.type === 'TRADING' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                        {b.type === 'TRADING' ? 'TRADING / EXP' : 'MERCADO INT'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    <button onClick={() => setViewingBuyer(b)} className="text-slate-400 hover:text-blue-600" title="Ver Detalhes"><Eye className="w-4 h-4" /></button>
                                    <button onClick={() => handleEditBuyer(b)} className="text-slate-400 hover:text-blue-600" title="Editar"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteBuyer(b.id)} className="text-slate-400 hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>
      )}

      {/* --- MODAIS DE VISUALIZAÇÃO (READ-ONLY) --- */}

      {/* VIEW PRODUCER MODAL */}
      {viewingProducer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                            <Tractor className="w-6 h-6 text-emerald-700" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">{viewingProducer.name}</h3>
                            <p className="text-sm text-slate-500">Cadastro de Produtor Rural</p>
                        </div>
                    </div>
                    <button onClick={() => setViewingProducer(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Coluna 1: Dados Gerais */}
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Dados Cadastrais</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-500 text-sm">CPF/CNPJ</span>
                                    <span className="font-medium text-slate-800">{viewingProducer.doc}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-500 text-sm">Insc. Estadual</span>
                                    <span className="font-medium text-slate-800">{viewingProducer.stateInsc}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-500 text-sm">Região</span>
                                    <span className="font-medium text-slate-800">{viewingProducer.region}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-500 text-sm">Email</span>
                                    <span className="font-medium text-slate-800">{viewingProducer.email || '-'}</span>
                                </div>
                                <div className="flex justify-between pt-1">
                                    <span className="text-slate-500 text-sm">Funrural</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                                        {getFunruralLabel(viewingProducer.funruralType)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Wallet className="w-4 h-4" /> Dados Bancários
                            </h4>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                {viewingProducer.bankDetails && viewingProducer.bankDetails.length > 0 ? (
                                    viewingProducer.bankDetails.map((bank, i) => (
                                        <div key={i} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-bold text-slate-800">{bank.bankName}</span>
                                                <span className="text-slate-500">Ag: {bank.agency} / CC: {bank.account}</span>
                                            </div>
                                            <div className="text-slate-500 truncate">{bank.holder} ({bank.holderDoc})</div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-400 italic">Nenhuma conta cadastrada.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Coluna 2: Fazendas */}
                    <div>
                         <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Fazendas / Locais de Retirada
                        </h4>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {viewingProducer.farms.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Nenhuma fazenda cadastrada.</p>
                            ) : (
                                viewingProducer.farms.map((farm, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                        <p className="font-bold text-emerald-800 text-sm mb-1">{farm.name}</p>
                                        <div className="flex items-start gap-2 text-xs text-slate-500">
                                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                            {farm.address}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end">
                    <button onClick={() => setViewingProducer(null)} className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-medium transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* PRODUCER EDIT MODAL */}
      {isProducerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Tractor className="w-5 h-5 text-emerald-600" />
                        {isValidUuid(producerForm.id) ? 'Editar Produtor' : 'Novo Produtor'}
                    </h3>
                    <button onClick={() => !isSavingProducer && setIsProducerModalOpen(false)} disabled={isSavingProducer}><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                {producerModalError && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{producerModalError}</div>
                    <button onClick={() => setProducerModalError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                  </div>
                )}
                
                <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Produtor</label>
                            <input type="text" className="w-full border rounded p-2" value={producerForm.name || ''} onChange={e => setProducerForm({...producerForm, name: e.target.value})} />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                            <input type="email" className="w-full border rounded p-2" value={producerForm.email || ''} onChange={e => setProducerForm({...producerForm, email: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF / CNPJ</label>
                            <input type="text" className="w-full border rounded p-2" value={producerForm.doc || ''} onChange={e => setProducerForm({...producerForm, doc: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inscrição Estadual (Vendedor)</label>
                            <input type="text" className="w-full border rounded p-2" value={producerForm.stateInsc || ''} onChange={e => setProducerForm({...producerForm, stateInsc: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Região</label>
                            <input type="text" className="w-full border rounded p-2" value={producerForm.region || ''} onChange={e => setProducerForm({...producerForm, region: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Funrural</label>
                            <select 
                                className="w-full border rounded p-2 bg-white" 
                                value={producerForm.funruralType} 
                                onChange={e => setProducerForm({...producerForm, funruralType: e.target.value as any})}
                            >
                                <option value="COMERCIALIZACAO">Comercialização</option>
                                <option value="FOLHA">Em Folha</option>
                                <option value="PJ_ISENTO">PJ (Isento)</option>
                            </select>
                        </div>
                    </div>
                    
                    <hr />

                    {/* Farms */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4"/> Fazendas (Locais de Retirada)</h4>
                        
                        {/* List */}
                        <div className="space-y-2 mb-3">
                            {producerForm.farms?.map((f, i) => (
                                <div key={f.id || i} className="bg-slate-50 p-2.5 rounded border border-slate-200">
                                    {editingFarmId === f.id ? (
                                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                                            <div className="flex-1">
                                                <label className="text-[11px] text-slate-500 font-bold">Nome da Fazenda</label>
                                                <input
                                                    type="text"
                                                    className="w-full border rounded p-1.5 text-sm bg-white"
                                                    value={editingFarmDraft.name}
                                                    onChange={e => setEditingFarmDraft(prev => ({ ...prev, name: e.target.value }))}
                                                    placeholder="Nome da fazenda"
                                                />
                                            </div>
                                            <div className="flex-[2]">
                                                <label className="text-[11px] text-slate-500 font-bold">Endereço</label>
                                                <input
                                                    type="text"
                                                    className="w-full border rounded p-1.5 text-sm bg-white"
                                                    value={editingFarmDraft.address}
                                                    onChange={e => setEditingFarmDraft(prev => ({ ...prev, address: e.target.value }))}
                                                    placeholder="Rodovia, Km, Município"
                                                />
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={saveFarmEdit}
                                                    className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700"
                                                    title="Confirmar edição da fazenda"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEditFarm}
                                                    className="bg-slate-200 text-slate-600 p-2 rounded hover:bg-slate-300"
                                                    title="Cancelar edição"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm min-w-0">
                                                <span className="font-bold text-emerald-800 block">
                                                    {f.name || <span className="italic text-amber-600">(Fazenda sem nome — clique em editar para corrigir)</span>}
                                                </span>
                                                <span className="text-slate-500">{f.address || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => startEditFarm(f)}
                                                    className="text-slate-400 hover:text-emerald-600 p-1"
                                                    title="Editar fazenda"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestDeleteFarm(f)}
                                                    className="text-slate-400 hover:text-red-600 p-1"
                                                    title="Excluir fazenda"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {(!producerForm.farms || producerForm.farms.length === 0) && <p className="text-sm text-slate-400 italic">Nenhuma fazenda cadastrada.</p>}
                        </div>

                        {/* Add Farm */}
                        <div className="bg-slate-100 p-3 rounded-lg">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-bold">Nome da Fazenda</label>
                                    <input type="text" className="w-full border rounded p-1.5 text-sm bg-white" value={tempFarm.name || ''} onChange={e => setTempFarm({...tempFarm, name: e.target.value})} placeholder="Ex: Fazenda Colorado" />
                                </div>
                                <div className="flex-[2]">
                                    <label className="text-xs text-slate-500 font-bold">Endereço</label>
                                    <input type="text" className="w-full border rounded p-1.5 text-sm bg-white" value={tempFarm.address || ''} onChange={e => setTempFarm({...tempFarm, address: e.target.value})} placeholder="Rodovia, Km, Município" />
                                </div>
                                <button type="button" onClick={addFarm} className="bg-emerald-600 text-white p-2 rounded hover:bg-emerald-700" title="Adicionar fazenda à lista">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1.5">
                                Clique em <strong>+</strong> para adicionar várias fazendas, ou preencha e clique em <strong>Salvar</strong> diretamente.
                            </p>
                        </div>
                    </div>

                    <hr />

                    {/* Bank Details */}
                     <div>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Banknote className="w-4 h-4" /> Dados Bancários (Múltiplas Contas)</h4>
                        
                        {/* List Banks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                             {producerForm.bankDetails?.map((bank, i) => (
                                <div key={i} className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm relative group">
                                    <button onClick={() => removeBank(i)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                                    <p className="font-bold text-slate-800 text-sm">{bank.bankName}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        AG: <span className="font-mono text-slate-700">{bank.agency}</span> • 
                                        CC: <span className="font-mono text-slate-700">{bank.account}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1 truncate">
                                        {bank.holder || producerForm.name}
                                    </p>
                                </div>
                             ))}
                        </div>

                        {/* Add Bank Form */}
                        <div className="bg-slate-100 p-4 rounded-lg">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Adicionar Nova Conta</p>
                            <div className="grid grid-cols-6 gap-2 mb-2">
                                <div className="col-span-2">
                                    <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Nome do Banco" value={tempBank.bankName} onChange={e => setTempBank({...tempBank, bankName: e.target.value})} />
                                </div>
                                <div>
                                    <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Agência" value={tempBank.agency} onChange={e => setTempBank({...tempBank, agency: e.target.value})} />
                                </div>
                                <div className="col-span-2">
                                    <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Conta Corrente" value={tempBank.account} onChange={e => setTempBank({...tempBank, account: e.target.value})} />
                                </div>
                                <div className="col-span-1">
                                     <button onClick={addBank} className="w-full bg-emerald-600 text-white p-1.5 rounded hover:bg-emerald-700 flex items-center justify-center h-full">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Titular (se diferente)" value={tempBank.holder} onChange={e => setTempBank({...tempBank, holder: e.target.value})} />
                                <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="CPF/CNPJ Titular" value={tempBank.holderDoc} onChange={e => setTempBank({...tempBank, holderDoc: e.target.value})} />
                            </div>
                        </div>
                     </div>

                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <button onClick={() => setIsProducerModalOpen(false)} disabled={isSavingProducer} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded disabled:opacity-50">Cancelar</button>
                    <button onClick={handleSaveProducer} disabled={isSavingProducer} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50">
                        {isSavingProducer ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-4 h-4"/>}
                        {isSavingProducer ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* BUYER EDIT MODAL */}
      {isBuyerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                 <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        {/* TypeScript fix: Ensure ID exists before checking length, default to 0 */}
                        {(buyerForm.id?.length || 0) > 15 ? 'Editar Comprador' : 'Novo Comprador'}
                    </h3>
                    <button onClick={() => setIsBuyerModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                 <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Comprador (Razão Social)</label>
                        <input type="text" className="w-full border rounded p-2" value={buyerForm.name || ''} onChange={e => setBuyerForm({...buyerForm, name: e.target.value})} />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CNPJ</label>
                            <input type="text" className="w-full border rounded p-2" value={buyerForm.doc || ''} onChange={e => setBuyerForm({...buyerForm, doc: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Inscrição Estadual</label>
                            <input type="text" className="w-full border rounded p-2" value={buyerForm.stateInsc || ''} onChange={e => setBuyerForm({...buyerForm, stateInsc: e.target.value})} />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço Completo</label>
                        <input type="text" className="w-full border rounded p-2" value={buyerForm.address || ''} onChange={e => setBuyerForm({...buyerForm, address: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Mercado</label>
                        <div className="flex gap-4 mt-2">
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="buyerType" checked={buyerForm.type === 'TRADING'} onChange={() => setBuyerForm({...buyerForm, type: 'TRADING'})} className="text-blue-600" />
                                <span className="text-sm">Trading / Exportação</span>
                            </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="buyerType" checked={buyerForm.type === 'MERCADO_INTERNO'} onChange={() => setBuyerForm({...buyerForm, type: 'MERCADO_INTERNO'})} className="text-blue-600" />
                                <span className="text-sm">Mercado Interno / Fábrica</span>
                            </label>
                        </div>
                    </div>
                 </div>

                 <hr className="my-2" />

                 {/* Sócios / Representantes */}
                 <div>
                    <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" /> Sócios / Representantes (Devedores Solidários)
                    </h4>

                    {/* Lista de sócios */}
                    <div className="space-y-2 mb-3">
                        {buyerForm.partners?.map((p, i) => (
                            <div key={i} className="flex items-start justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="text-sm">
                                    <p className="font-bold text-slate-800">{p.name}</p>
                                    <p className="text-slate-500 text-xs">CPF: {p.cpf}{p.rg ? ` • RG: ${p.rg}` : ''}</p>
                                    {p.address && <p className="text-slate-400 text-xs mt-0.5">{p.address}</p>}
                                </div>
                                <button onClick={() => removePartner(i)} className="text-red-400 hover:text-red-600 p-1 ml-2 shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {(!buyerForm.partners || buyerForm.partners.length === 0) && (
                            <p className="text-sm text-slate-400 italic">Nenhum sócio cadastrado.</p>
                        )}
                    </div>

                    {/* Formulário para adicionar sócio */}
                    <div className="bg-slate-100 p-4 rounded-lg space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Adicionar Sócio / Representante</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                                <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Nome completo *" value={tempPartner.name} onChange={e => setTempPartner({...tempPartner, name: e.target.value})} />
                            </div>
                            <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="CPF *" value={tempPartner.cpf} onChange={e => setTempPartner({...tempPartner, cpf: e.target.value})} />
                            <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="RG (opcional)" value={tempPartner.rg} onChange={e => setTempPartner({...tempPartner, rg: e.target.value})} />
                            <div className="col-span-2 flex gap-2">
                                <input type="text" className="w-full border rounded p-1.5 text-sm" placeholder="Endereço (opcional)" value={tempPartner.address} onChange={e => setTempPartner({...tempPartner, address: e.target.value})} />
                                <button onClick={addPartner} className="bg-blue-600 text-white px-3 rounded hover:bg-blue-700 flex items-center gap-1 shrink-0">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                 </div>

                  <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-xl">
                    <button onClick={() => setIsBuyerModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">Cancelar</button>
                    <button onClick={handleSaveBuyer} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                        {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        <Save className="w-4 h-4"/> Salvar
                    </button>
                </div>
            </div>
          </div>
      )}

      {/* FARM DELETE CONFIRMATION MODAL */}
      {farmDeleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className={`p-2.5 rounded-lg shrink-0 ${farmDeleteBlockReason || farmDeleteCheckFailed ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                {farmDeleteBlockReason || farmDeleteCheckFailed ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                {isCheckingFarmDelete ? (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Verificando vínculos da fazenda</h3>
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="inline-block w-3.5 h-3.5 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
                      Verificando contratos vinculados a {farmDeleteTarget.name || 'esta fazenda'}...
                    </p>
                  </>
                ) : farmDeleteBlockReason ? (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Exclusão bloqueada</h3>
                    <p className="text-sm text-slate-600">{farmDeleteBlockReason}</p>
                  </>
                ) : farmDeleteCheckFailed ? (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Não foi possível verificar vínculos</h3>
                    <p className="text-sm text-red-600">{farmDeleteError}</p>
                  </>
                ) : (
                  <>
                    <h3 className="font-bold text-slate-800 mb-1">Confirmar exclusão de fazenda</h3>
                    <p className="text-sm text-slate-600">
                      Deseja excluir a fazenda <strong>{farmDeleteTarget.name || '(sem nome)'}</strong>
                      {isValidUuid(farmDeleteTarget.id) ? ' definitivamente do banco de dados?' : ' da lista deste formulário?'}
                    </p>
                    {isValidUuid(farmDeleteTarget.id) && (
                      <p className="text-xs text-red-600 mt-2 font-medium">
                        Atenção: esta ação removerá o registro da fazenda permanentemente no Supabase.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {!isCheckingFarmDelete && !farmDeleteBlockReason && !farmDeleteCheckFailed && farmDeleteError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {farmDeleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {isCheckingFarmDelete || farmDeleteBlockReason || farmDeleteCheckFailed ? (
                <button
                  type="button"
                  onClick={handleCloseFarmDeleteModal}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                >
                  {isCheckingFarmDelete ? 'Cancelar' : 'Fechar'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleCloseFarmDeleteModal}
                    disabled={isDeletingFarm}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteFarm}
                    disabled={isDeletingFarm}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
                  >
                    {isDeletingFarm ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Confirmar exclusão
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
