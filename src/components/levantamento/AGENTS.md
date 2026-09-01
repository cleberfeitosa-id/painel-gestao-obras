# SRC/COMPONENTS/LEVANTAMENTO — LEVANTAMENTO QUANTITATIVO

## OVERVIEW
Módulo de levantamento quantitativo sobre plantas PDF calibradas (~2,5k linhas): desenho de pontos, polilinhas de distância, circuitos/cabos, polígonos de área, descidas/subidas 3D e visualizador 3D.

## ARQUIVOS
| Arquivo | Papel |
|---------|-------|
| `visualizador-levantamento.tsx` | Editor principal: ferramentas (ponto, distancia, tubulacao_cabo, area, descida_subida, navegar), seleção e tabela de itens |
| `area-levantamento.tsx` | Wrapper `dynamic(..., { ssr: false })` para carregar o visualizador no client |
| `visualizador-3d.tsx` | Visualização tridimensional dos níveis e descidas entre pavimentos |
| `legenda-dinamica.tsx` | Painel de legenda com contagens e metragens por categoria/circuito |
| `gerenciador-niveis-modal.tsx` | CRUD de níveis (cota Z, altura do piso, cor) |
| `gerenciador-categorias-modal.tsx` | Configuração de categorias (cor, unidade, ícone) |
| `modal-config-cabo.tsx` | Diálogo para configurar tipo, bitola e condutores do circuito/eletroduto |
| `modal-descida-subida.tsx` | Diálogo para vincular descida/subida de prumada entre níveis Z |
| `modal-upload-nova-planta.tsx` | Upload de prancha vinculado ao levantamento |
| `lista-levantamentos.tsx` | Lista de levantamentos filtrada por obra |
| `modal-novo-levantamento.tsx` | Criação de novo levantamento |

## MODELO DE DADOS & CÁLCULOS
- **Persistência**: tabela `levantamentos` armazena `niveis`, `categorias`, `itens` e `config_legenda` em colunas jsonb.
- **Tipos de Item**: `ponto` (contagem), `distancia` (polilinha linear), `tubulacao_cabo` (polilinha com condutores/circuitos), `area` (polígono fechado), `descida_subida` (prumada vertical com altura $\Delta Z$).
- **Cálculos**: centralizados em `@/lib/levantamento/calculos.ts` (`calcularResumoLevantamento`).
- **Exportação**: CSV via `@/lib/levantamento/exportacao.ts` ou PDF via engine de impressão (`exportarParaPdfViaImpressao`).
- **Conversão em Tarefas**: action `criarTarefasEmLoteLevantamento` converte itens selecionados em `tarefas` com `tipo_localizacao` correspondente e metadados em `localizacao_detalhe`.

## CONVENTIONS
- Coordenadas de vértices e pontos sempre em **espaço do PDF**; renderização em SVG overlay sobre o canvas do PDF.
- Distâncias e áreas exigem que a prancha tenha registro em `planta_calibracoes` (obtido via `obterCalibracoesPlanta`).
- Todas as mutações passam pelas actions em `@/app/(protegido)/levantamento/acoes.ts`.

## ANTI-PATTERNS
- NÃO gerar PDF de relatório no servidor — usar impressão do navegador.
- NÃO recalcular comprimentos/áreas no componente UI: usar funções puras de `@/lib/levantamento/calculos.ts`.
- NÃO persistir coordenadas em pixels de tela.