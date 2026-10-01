import type { PostgrestError } from "@supabase/supabase-js";

/**
 * O PostgREST corta qualquer resposta em 1000 linhas. Consultas sem
 * `range()` devolvem apenas esse primeiro bloco e truncam o resto em
 * silencio, entao listas grandes precisam ser percorridas bloco a bloco.
 */
export const TAMANHO_PAGINA_SUPABASE = 1000;

interface ConsultaPaginavel<T> {
  range(
    inicio: number,
    fim: number,
  ): PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;
}

/**
 * Executa a mesma consulta em blocos consecutivos ate o resultado acabar,
 * preservando a ordem e os filtros ja aplicados na consulta original.
 *
 * `consulta` precisa ser o builder do Supabase ainda sem `range()`: o
 * `range()` do postgrest-js reaproveita e muta a propria URL, entao o mesmo
 * builder pode ser reaproveitado a cada bloco.
 */
export async function buscarTodasLinhas<T>(
  consulta: ConsultaPaginavel<T>,
  tamanhoPagina: number = TAMANHO_PAGINA_SUPABASE,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const linhas: T[] = [];
  let inicio = 0;

  for (;;) {
    const { data, error } = await consulta.range(
      inicio,
      inicio + tamanhoPagina - 1,
    );

    if (error) {
      return { data: linhas, error };
    }

    if (data && data.length > 0) {
      linhas.push(...data);
    }

    if (!data || data.length < tamanhoPagina) {
      break;
    }

    inicio += tamanhoPagina;
  }

  return { data: linhas, error: null };
}
