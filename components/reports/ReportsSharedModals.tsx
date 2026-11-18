import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  AlertTriangle,
  CheckCircle2,
  Database,
  Copy,
  Check,
  Users,
  Plus,
  Trash2,
  Printer,
  FileSpreadsheet,
  FileText,
  ShieldCheck
} from 'lucide-react';
import {
  EconomicGroup,
  Producer,
  SystemDataIntegrity
} from '../../types';
import {
  DataQualityIssue,
  EnrichedContract,
  VolumeUnit,
  bagsToUnit,
  formatDateBR
} from '../../services/reportsAnalytics';
import { REPORTS_SQL_PROPOSALS } from '../../services/reportsSqlProposals';
import { ExternalProducerSections } from '../../services/reportsExport';

// 1) CONTRACT DRILL-DOWN MODAL
interface ContractDrillDownModalProps {
  title: string;
  subtitle?: string;
  contracts: EnrichedContract[];
  unit: VolumeUnit;
  showCommissionColumn?: boolean;
  onClose: () => void;
}

export const ContractDrillDownModal: React.FC<ContractDrillDownModalProps> = ({
  title,
  subtitle,
  contracts,
  unit,
  showCommissionColumn = true,
  onClose
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contracts;
    return contracts.filter((item) => {
      const c = item.contract;
      return (
        c.number.toLowerCase().includes(term) ||
        item.producer.displayName.toLowerCase().includes(term) ||
        item.farm.farmName.toLowerCase().includes(term) ||
        c.buyerName.toLowerCase().includes(term) ||
        c.product.toLowerCase().includes(term) ||
        c.crop.toLowerCase().includes(term)
      );
    });
  }, [contracts, search]);

  const totals = useMemo(() => {
    let bags = 0;
    let totalCommissionBRL = 0;
    for (const item of filtered) {
      const b = Number(item.contract.totalBags) || 0;
      const comm = b * (Number(item.contract.commissionPerBag) || 0);
      bags += b;
      totalCommissionBRL += comm;
    }
    return {
      volume: bagsToUnit(bags, unit),
      totalCommissionBRL
    };
  }, [filtered, unit]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-6xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contrato, produtor, fazenda, comprador..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
            <span>
              <strong className="text-slate-900">{filtered.length}</strong> contrato(s)
            </span>
            <span>·</span>
            <span>
              Volume:{' '}
              <strong className="text-slate-900">
                {totals.volume.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}{' '}
                {unit === 'TON' ? 'ton' : 'scs'}
              </strong>
            </span>
            {showCommissionColumn && (
              <>
                <span>·</span>
                <span>
                  Comissão Total (R$):{' '}
                  <strong className="text-emerald-700">
                    R$ {totals.totalCommissionBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Contrato</th>
                <th className="py-2.5 px-3 font-semibold">Fechamento</th>
                <th className="py-2.5 px-3 font-semibold">Produtor</th>
                <th className="py-2.5 px-3 font-semibold">Fazenda</th>
                <th className="py-2.5 px-3 font-semibold">Produto / Safra</th>
                <th className="py-2.5 px-3 font-semibold">Comprador</th>
                <th className="py-2.5 px-3 font-semibold text-right">Volume</th>
                <th className="py-2.5 px-3 font-semibold text-right">Preço (/sc)</th>
                {showCommissionColumn && (
                  <th className="py-2.5 px-3 font-semibold text-right">Comissão Total (R$)</th>
                )}
                <th className="py-2.5 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filtered.map((item) => {
                const c = item.contract;
                const vol = bagsToUnit(Number(c.totalBags) || 0, unit);
                const priceSym = c.currency === 'USD' ? 'US$' : 'R$';
                const totalComm = (Number(c.totalBags) || 0) * (Number(c.commissionPerBag) || 0);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">{c.number}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {formatDateBR(c.closingDate || c.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-[200px] truncate" title={item.producer.displayName}>
                      {item.producer.displayName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate" title={item.farm.farmName}>
                      {item.farm.farmName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {c.product} · {c.crop}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[170px] truncate" title={c.buyerName}>
                      {c.buyerName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                      {vol.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'TON' ? 2 : 0 })}{' '}
                      {unit === 'TON' ? 'ton' : 'scs'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 whitespace-nowrap">
                      {c.isFixed && Number(c.finalPrice) > 0
                        ? `${priceSym} ${Number(c.finalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : Number(c.finalPrice) > 0
                        ? `${priceSym} ${Number(c.finalPrice).toFixed(2)} (Ind.)`
                        : 'A Fixar'}
                    </td>
                    {showCommissionColumn && (
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                        R$ {totalComm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{item.normalizedStatus}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showCommissionColumn ? 10 : 9} className="py-8 text-center text-slate-400">
                    Nenhum contrato encontrado para o filtro informado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// 2) DATA INTEGRITY & QUALITY MODAL
interface DataIntegrityModalProps {
  dataIntegrity?: SystemDataIntegrity;
  issues: DataQualityIssue[];
  onClose: () => void;
}

const CATEGORY_LABELS: Record<DataQualityIssue['category'], string> = {
  PRODUCER_UNMATCHED: 'Produtor sem cadastro',
  PRODUCER_CONFLICT: 'Conflito de identificação',
  STATUS_FORMAT: 'Status legado',
  USD_ZERO_RATE: 'USD com câmbio zero',
  VOLUME_MISMATCH: 'Divergência sacas × ton',
  PRICE_OUTLIER: 'Preço atípico',
  ARTIFICIAL_PAYMENT_DATE: 'Data pagamento ignorada (Sob Rodas / Pós Retirada)',
  MISSING_COMMISSION_DUE: 'Sem vencimento de comissão'
};

export const DataIntegrityModal: React.FC<DataIntegrityModalProps> = ({
  dataIntegrity,
  issues,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of issues) {
      map.set(i.category, (map.get(i.category) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [issues]);

  const filteredIssues = useMemo(() => {
    if (selectedCategory === 'ALL') return issues;
    return issues.filter((i) => i.category === selectedCategory);
  }, [issues, selectedCategory]);

  const tableRows = dataIntegrity
    ? [
        dataIntegrity.contracts,
        dataIntegrity.shipments,
        dataIntegrity.producers,
        dataIntegrity.buyers
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-700" />
              Integridade de Carregamento e Qualidade dos Dados
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verificação automática de paginação Supabase e sinalização de inconsistências sem alterar registros originais.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tableRows.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                1. Cobertura de Paginação (Supabase vs Memória)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {tableRows.map((row) => (
                  <div
                    key={row.table}
                    className="border border-slate-200 rounded-lg p-3 bg-white flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 uppercase">{row.table}</span>
                      {row.isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <div className="mt-2 tabular-nums">
                      <span className="text-lg font-bold text-slate-900">{row.loadedCount}</span>
                      <span className="text-xs text-slate-500">
                        {' '}
                        / {row.expectedCount !== null ? row.expectedCount : '?'} registros
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {row.error
                        ? `Erro: ${row.error}`
                        : row.isComplete
                        ? 'Carga completa validada'
                        : 'Carga parcial — verificar conexão'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Apontamentos de Saneamento nos Contratos ({issues.length})
              </h4>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="ALL">Todas as categorias ({issues.length})</option>
                {categoryCounts.map(([cat, count]) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat as DataQualityIssue['category']] || cat} ({count})
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Contrato</th>
                    <th className="py-2 px-3 font-semibold">Categoria</th>
                    <th className="py-2 px-3 font-semibold">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIssues.slice(0, 250).map((issue) => (
                    <tr key={issue.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {issue.contractNumber}
                      </td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {CATEGORY_LABELS[issue.category] || issue.category}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{issue.message}</td>
                    </tr>
                  ))}
                  {filteredIssues.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400">
                        Nenhuma inconsistência encontrada nesta categoria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredIssues.length > 250 && (
                <div className="px-3 py-2 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200">
                  Exibindo os primeiros 250 de {filteredIssues.length} apontamentos.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 3) SQL & ECONOMIC GROUPS MODAL (ETAPA 7)
interface SqlAndGroupsModalProps {
  producers: Producer[];
  economicGroups: EconomicGroup[];
  onSaveGroup: (group: EconomicGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onClose: () => void;
}

export const SqlAndGroupsModal: React.FC<SqlAndGroupsModalProps> = ({
  producers,
  economicGroups,
  onSaveGroup,
  onDeleteGroup,
  onClose
}) => {
  const [section, setSection] = useState<'GROUPS' | 'SQL'>('GROUPS');
  const [groupName, setGroupName] = useState('');
  const [groupNotes, setGroupNotes] = useState('');
  const [selectedProducerIds, setSelectedProducerIds] = useState<string[]>([]);
  const [producerSearch, setProducerSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredProducers = useMemo(() => {
    const term = producerSearch.trim().toLowerCase();
    const sorted = [...producers].sort((a, b) => a.name.localeCompare(b.name));
    if (!term) return sorted;
    return sorted.filter(
      (p) => p.name.toLowerCase().includes(term) || (p.doc && p.doc.toLowerCase().includes(term))
    );
  }, [producers, producerSearch]);

  const toggleProducer = (id: string) => {
    setSelectedProducerIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedProducerIds.length === 0) return;
    onSaveGroup({
      id: `session-group-${Date.now()}`,
      name: groupName.trim(),
      notes: groupNotes.trim() || undefined,
      producerIds: selectedProducerIds,
      createdAt: new Date().toISOString()
    });
    setGroupName('');
    setGroupNotes('');
    setSelectedProducerIds([]);
  };

  const copySql = async (id: string, sql: string) => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Grupos Econômicos e Estruturas Permanentes (Etapa 7)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidação de produtores em sessão atual e scripts SQL prontos para aprovação antes de execução no Supabase.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-3 border-b border-slate-200 flex gap-2 bg-white">
          <button
            type="button"
            onClick={() => setSection('GROUPS')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              section === 'GROUPS'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Agrupamentos em Sessão ({economicGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('SQL')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              section === 'SQL'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Modelagem & SQL Proposto ({REPORTS_SQL_PROPOSALS.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {section === 'GROUPS' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={handleCreateGroup} className="border border-slate-200 rounded-xl p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700" />
                    Criar Grupo Econômico (Sessão Local)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Permite consolidar vários produtores (ex.: membros da mesma família ou empresas relacionadas) nos filtros e matrizes durante esta sessão, sem alterar o banco de dados.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Grupo Econômico *
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex.: Grupo Família Silva"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Observação (opcional)
                  </label>
                  <input
                    type="text"
                    value={groupNotes}
                    onChange={(e) => setGroupNotes(e.target.value)}
                    placeholder="Ex.: CPFs e CNPJs vinculados na região sul"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Produtores Integrantes ({selectedProducerIds.length} selecionados)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={producerSearch}
                    onChange={(e) => setProducerSearch(e.target.value)}
                    placeholder="Filtrar produtores por nome ou CPF/CNPJ..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducers.map((p) => {
                      const checked = selectedProducerIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 ${
                            checked ? 'bg-emerald-50/70' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProducer(p.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block font-medium text-slate-800 truncate">{p.name}</span>
                            <span className="block text-[10px] text-slate-400">{p.doc}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!groupName.trim() || selectedProducerIds.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2 px-4 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Adicionar Grupo na Sessão
                </button>
              </form>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900">Grupos Disponíveis nesta Sessão</h4>
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-xs text-amber-900">
                  <strong>Persistência permanente desativada por segurança:</strong> Para salvar grupos econômicos permanentemente no Supabase e liberar registro de baixas em <code>commission_receipts</code>, revise os scripts na aba <strong>Modelagem &amp; SQL Proposto</strong> e autorize a criação das tabelas com políticas RLS adequadas.
                </div>
                {economicGroups.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center text-xs text-slate-400">
                    Nenhum grupo criado nesta sessão. Você também pode consolidar produtores diretamente selecionando múltiplos produtores nos filtros.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {economicGroups.map((grp) => (
                      <div
                        key={grp.id}
                        className="border border-slate-200 rounded-lg p-3.5 bg-white flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">{grp.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {grp.producerIds.length} produtor(es) vinculado(s)
                            {grp.notes ? ` · ${grp.notes}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-1.5 truncate">
                            {grp.producerIds
                              .map((pid) => producers.find((p) => p.id === pid)?.name || pid)
                              .join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteGroup(grp.id)}
                          title="Remover grupo da sessão"
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="border border-slate-200 bg-slate-50 rounded-lg p-3.5 text-xs text-slate-700">
                Os scripts abaixo são <strong>100% não destrutivos</strong> e preservam todas as tabelas e contratos existentes. Nenhuma alteração foi executada no banco de dados Supabase.
              </div>
              {REPORTS_SQL_PROPOSALS.map((block) => (
                <div key={block.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{block.title}</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">{block.purpose}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copySql(block.id, block.sql)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 shrink-0 whitespace-nowrap"
                    >
                      {copiedId === block.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar SQL
                        </>
                      )}
                    </button>
                  </div>
                  <div className="px-4 py-2 bg-white border-b border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <p>
                      <strong>Dependências:</strong> {block.dependencies}
                    </p>
                    <p>
                      <strong>Segurança / RLS:</strong> {block.securityNotes}
                    </p>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 text-[11px] overflow-x-auto leading-relaxed">
                    <code>{block.sql}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 4) EXTERNAL PRODUCER REPORT CONFIG MODAL (SECTION 9)
interface ExternalProducerConfigModalProps {
  producerOrGroupTitle: string;
  producerDocsLabel: string;
  periodLabel: string;
  dealsCount: number;
  sections: ExternalProducerSections;
  onChangeSections: (next: ExternalProducerSections) => void;
  onPrintPdf: () => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onClose: () => void;
}

export const ExternalProducerConfigModal: React.FC<ExternalProducerConfigModalProps> = ({
  producerOrGroupTitle,
  producerDocsLabel,
  periodLabel,
  dealsCount,
  sections,
  onChangeSections,
  onPrintPdf,
  onExportCsv,
  onExportXlsx,
  onClose
}) => {
  const toggleSection = (key: keyof ExternalProducerSections) => {
    onChangeSections({ ...sections, [key]: !sections[key] });
  };

  const sectionItems: Array<{ key: keyof ExternalProducerSections; label: string; desc: string }> = [
    { key: 'executiveSummary', label: 'Resumo Executivo', desc: 'Volume negociado, preço médio ponderado, fixado × a fixar e valor bruto.' },
    { key: 'charts', label: 'Gráficos Visuais (PDF)', desc: 'Comparativo visual de volume negociado entre safras.' },
    { key: 'cropComparison', label: 'Comparativo entre Safras', desc: 'Tabela anual com evolução de volume, preço médio, máximo e mínimo.' },
    { key: 'monthlyStrategy', label: 'Distribuição Mensal de Vendas', desc: 'Volume, negócios, preço médio mensal, participação e acumulado.' },
    { key: 'byProduct', label: 'Desempenho por Cultura / Moeda', desc: 'Separação por produto e moeda (BRL/USD).' },
    { key: 'byFarm', label: 'Desempenho por Fazenda', desc: 'Totais por propriedade rural vinculada ao contrato.' },
    { key: 'analyticalContracts', label: 'Relação Analítica de Contratos', desc: 'Lista de negócios do produtor sem comissões internas.' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Relatório Externo para Produtor
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Documento isolado: contém exclusivamente dados comerciais dos contratos selecionados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-lg p-3.5 text-xs space-y-1">
            <p className="font-bold text-emerald-950">{producerOrGroupTitle}</p>
            {producerDocsLabel && <p className="text-emerald-800">Documento(s): {producerDocsLabel}</p>}
            <p className="text-emerald-800">
              Período: {periodLabel} · {dealsCount} contrato(s) incluído(s)
            </p>
            <p className="text-[11px] text-emerald-700 pt-1">
              Isolamento garantido: sem comissões de corretagem, sem rankings internos e sem dados de terceiros.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Seções incluídas no documento
            </p>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {sectionItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sections[item.key]}
                    onChange={() => toggleSection(item.key)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-slate-800">{item.label}</span>
                    <span className="block text-[11px] text-slate-500">{item.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={onExportXlsx}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-lg whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={onPrintPdf}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>
    </div>
  );
};
