export interface SqlProposalBlock {
  id: string;
  title: string;
  purpose: string;
  dependencies: string;
  securityNotes: string;
  sql: string;
}

export const REPORTS_SQL_PROPOSALS: SqlProposalBlock[] = [
  {
    id: 'economic_groups',
    title: '1. Estrutura Permanente de Grupos Econômicos (Produtores)',
    purpose:
      'Permite agrupar múltiplos cadastros de produtores (CPFs, CNPJs ou empresas familiares distintas) sob um único Grupo Econômico para visão consolidada nos relatórios, mantendo cada produtor e suas fazendas totalmente independentes.',
    dependencies: 'Tabela existente: public.producers(id). Não altera nem exclui cadastros existentes.',
    securityNotes:
      'Mantém RLS habilitado em todas as tabelas novas. Como o ERP ainda não possui Supabase Auth ativo, recomenda-se habilitar políticas restritas a authenticated após ativação de login.',
    sql: `-- 1) Tabela de Grupos Econômicos
CREATE TABLE IF NOT EXISTS public.economic_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT economic_groups_name_unique UNIQUE (name)
);

-- 2) Tabela de vínculo Produtor <-> Grupo Econômico
-- Mantém os cadastros individuais de public.producers intactos
CREATE TABLE IF NOT EXISTS public.economic_group_producers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.economic_groups(id) ON DELETE CASCADE,
  producer_id uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  role_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT economic_group_producers_unique_member UNIQUE (group_id, producer_id)
);

CREATE INDEX IF NOT EXISTS idx_egp_group_id ON public.economic_group_producers(group_id);
CREATE INDEX IF NOT EXISTS idx_egp_producer_id ON public.economic_group_producers(producer_id);

-- 3) Habilitar Row Level Security (RLS)
ALTER TABLE public.economic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_group_producers ENABLE ROW LEVEL SECURITY;

-- Nota de segurança:
-- Defina políticas para o papel authenticated após configurar o Supabase Auth.
-- Exemplo (quando houver autenticação):
-- CREATE POLICY "authenticated_read_economic_groups"
--   ON public.economic_groups FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "authenticated_write_economic_groups"
--   ON public.economic_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);`
  },
  {
    id: 'commission_receipts',
    title: '2. Controle Efetivo de Recebimentos de Comissões (Contas a Receber)',
    purpose:
      'Permite registrar recebimentos totais, parciais e múltiplos lançamentos vinculados a um contrato (sempre devidos pelo vendedor/produtor e sempre expressos em BRL, sem conversão cambial), além de estornos rastreáveis sem apagar histórico. Não cria comissão sobre compradores e não utiliza shipments.paid.',
    dependencies: 'Tabela existente: public.contracts(id). Não gera débitos automáticos para contratos históricos.',
    securityNotes:
      'Operações financeiras de escrita exigem controle de acesso adequado (Supabase Auth + RLS por perfil autorizado antes de liberar gravação em produção).',
    sql: `-- 1) Configuração opcional de marco inicial do controle financeiro
CREATE TABLE IF NOT EXISTS public.financial_control_settings (
  id text PRIMARY KEY DEFAULT 'commission_control',
  control_start_date date,
  require_historical_validation boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Tabela de Recebimentos de Comissões (sempre em BRL; suporta baixas parciais e estornos rastreáveis)
CREATE TABLE IF NOT EXISTS public.commission_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  receipt_date date NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  payment_method text,
  notes text,
  is_reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  reversed_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_receipts_contract_id ON public.commission_receipts(contract_id);
CREATE INDEX IF NOT EXISTS idx_commission_receipts_receipt_date ON public.commission_receipts(receipt_date);

-- 3) Habilitar Row Level Security (RLS)
ALTER TABLE public.commission_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_control_settings ENABLE ROW LEVEL SECURITY;

-- Nota de segurança:
-- Não liberar escrita pública anônima em tabelas financeiras.
-- Configurar políticas restritas ao papel authenticated após implantação da autenticação.`
  },
  {
    id: 'contracts_reporting_indexes',
    title: '3. Índices e Campos Opcionais de Saneamento em Contratos (Não Destrutivo)',
    purpose:
      'Acelera consultas por data de fechamento, safra e produtor, e adiciona coluna opcional buyer_id sem modificar nenhum registro existente.',
    dependencies: 'Tabelas existentes: public.contracts, public.buyers, public.shipments.',
    securityNotes: 'Script puramente aditivo (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).',
    sql: `-- Coluna opcional para vínculo futuro estável do comprador (sem apagar buyer_name / buyer_doc)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.buyers(id);

-- Índices para acelerar paginação, filtros e relatórios gerenciais
CREATE INDEX IF NOT EXISTS idx_contracts_closing_date ON public.contracts(closing_date);
CREATE INDEX IF NOT EXISTS idx_contracts_crop_product ON public.contracts(crop, product);
CREATE INDEX IF NOT EXISTS idx_contracts_seller_id ON public.contracts(seller_id);
CREATE INDEX IF NOT EXISTS idx_contracts_farm_id ON public.contracts(farm_id);
CREATE INDEX IF NOT EXISTS idx_shipments_contract_delivery ON public.shipments(contract_id, delivery_date);`
  }
];
