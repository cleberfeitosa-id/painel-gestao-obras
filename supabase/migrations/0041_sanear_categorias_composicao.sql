-- Reclassifica componentes importados cuja categoria textual veio como
-- "outro", mas cuja descricao identifica mao de obra ou equipamento.
-- Nao altera custos: apenas corrige a dimensao usada pelos agregadores.

create or replace function public.classificar_categoria_componente(p_nome text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_nome text := upper(translate(coalesce(p_nome, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
begin
  if v_nome ~ '(^|[^A-Z])(CARPINTEIRO|PEDREIRO|SERVENTE|ELETRICISTA|ENCANADOR|AJUDANTE|ARMADOR|PINTOR|AZULEJISTA|GESSEIRO|TELHADISTA|OPERADOR|MOTORISTA|ENGENHEIRO|TECNICO|MESTRE|ENCARREGADO|APONTADOR|VIGIA|BOMBEIRO|SOLDADOR|LUBRIFICADOR|SERRALHEIRO|MONTADOR|CALHEIRO|FUNILEIRO|VIDRACEIRO|LADRILHADOR|ALMOXARIFE|TOMBADOR|COZINHEIRO|CAIXEIRO|OFICIAL|MEIO OFICIAL)([^A-Z]|$)'
     or v_nome ~ '(^|[^A-Z])AUXILIAR[[:space:]]+DE[[:space:]]+(ELETRICISTA|ENCANADOR|PEDREIRO|SERVICOS?|OBRA|MANUTENCAO)([^A-Z]|$)' then
    return 'mao_de_obra';
  end if;
  return null;
end;
$$;

update public.composicao_componentes cc
set categoria = public.classificar_categoria_componente(cc.nome)
where cc.categoria in ('outro', 'material')
  and public.classificar_categoria_componente(cc.nome) is not null
  and cc.categoria is distinct from public.classificar_categoria_componente(cc.nome);

update public.compra_itens ci
set categoria = cc.categoria
from public.composicao_componentes cc
where ci.composicao_componente_id = cc.id
  and ci.categoria is distinct from cc.categoria;

revoke execute on function public.classificar_categoria_componente(text) from public, authenticated;
