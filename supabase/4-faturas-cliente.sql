-- Faturas na área do cliente
-- Rode uma vez no SQL Editor do Supabase (depois do 1-estrutura.sql).
-- O cliente passa a ler SÓ as entradas (faturas) da empresa dele no Financeiro.
-- Despesas, anúncios e contas a pagar continuam visíveis só para a administradora.

drop policy if exists docs_client_read on public.docs;
create policy docs_client_read on public.docs for select to authenticated
  using (client_id is not null and client_id = my_client_id()
         and (col in ('clients','posts','tasks','approvals','taskdone','actions')
              or (col = 'fin' and data->>'kind' = 'receita' and client_can('faturas','fin',id))));

-- lançamentos que já existem: entrada com cliente fica ligada à empresa; o resto fica sem dono (só admin)
update public.docs set client_id = data->>'clientId'
  where col = 'fin' and data->>'kind' = 'receita' and coalesce(data->>'clientId','') <> '';
update public.docs set client_id = null
  where col = 'fin' and (coalesce(data->>'kind','') <> 'receita' or coalesce(data->>'clientId','') = '');
