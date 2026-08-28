# SRC/COMPONENTS/PLANTAS — VISUALIZADOR PDF E CALIBRAGEM

## OVERVIEW
Subsistema mais complexo do projeto (~1,6k linhas em 8 arquivos): renderiza o PDF da planta, calibra a escala por página e transforma cliques em tarefas georreferenciadas.

## ARQUIVOS
| Arquivo | Linhas | Papel |
|---------|--------|-------|
| `visualizador-planta.tsx` | 894 | Viewer completo: 5 ferramentas, pan/zoom, overlays SVG, pinos e regiões |
| `formulario-upload-planta.tsx` | 233 | Escolhe PDF (≤100 MB), envia por URL assinada com barra de progresso, conta páginas, chama `registrarPlanta` |
| `calibragem.tsx` | 169 | Banner de status + modal para informar a distância real |
| `lista-tarefas-planta.tsx` | 131 | Lista lateral das tarefas da página atual |
| `botao-excluir-planta.tsx` | 86 | Exclusão com modal de confirmação |
| `tipos.ts` | 31 | `TarefaPlanta`, `PropsAreaPlanta` (sem JSX — server-compatible) |
| `area-planta.tsx` | 25 | Wrapper `dynamic(..., { ssr: false })` do viewer |
| `pdfjs.ts` | 20 | `GlobalWorkerOptions.workerSrc` + `contarPaginasPdf` |

## ESPAÇO DE COORDENADAS (invariante central)
Persistência **sempre** em pontos de PDF (origem inferior esquerda, Y para cima); renderização **sempre** em % do quadro. Toda a matemática mora em `@/lib/pdf/coordenadas.ts` — este diretório só a consome.

```
clique  → telaParaPdf(clientX, clientY, canvasRect, larguraPagina, alturaPagina)   [inverte Y]
persiste→ ponto_x/ponto_y  ou  regiao.vertices                                     [espaço PDF]
render  → pdfParaPercentual(ponto, largura, altura) → { esquerda, topo } em %       [inverte Y de volta]
```

`dimensoes = {largura, altura}` é capturado do **viewport em `scale: 1`** no `onLoadSuccess` da `<Page>` — é a referência de todas as transformações. Nunca derivar dimensão do canvas já escalado.

## FERRAMENTAS DO VIEWER
`navegar` (pan) · `medir` · `pino` · `regiao` · `calibrar` — estado em `ferramenta`.
- **calibrar**: 2 cliques → `pontosCalibracao` → modal → `calcularCalibracao` → action `salvarCalibracao` → upsert em `planta_calibracoes` (PK `planta_id,pagina`).
- **pino**: 1 clique → `router.push('/tarefas/nova?...&tipo=ponto&x=&y=')`.
- **regiao**: arraste → `retanguloParaRegiao` → `regiao` serializada na querystring (ignora arraste < 2px).
- **medir**: usa a calibragem da página; área escala com o **quadrado** do fator linear.

## CONVENTIONS
- Cores de pino/região vêm de `CORES_PINO`/`CORES_REGIAO`, indexadas por **prioridade**.
- A calibragem é **por página**: `calibracoesPorPagina` é um `Map`; página sem calibragem desabilita medição.
- O PDF é carregado por **URL assinada** que expira; `renovarUrl()` chama a action `renovarUrlPlanta` e re-renderiza.

## ANTI-PATTERNS
- NÃO importar `pdfjs.ts` nem o viewer de Server Component — o worker exige DOM/Web Worker. A porta de entrada é `area-planta.tsx` (`ssr: false`).
- NÃO posicionar pino em pixels de tela nem usar as dimensões do canvas escalado — só % via `pdfParaPercentual`.
- NÃO recalcular a matemática aqui: estender `@/lib/pdf/coordenadas.ts` e importar.
- NÃO enviar o PDF pela função serverless — `assinarUploadPlanta` + `PUT` direto do navegador (limite 4,5 MB da Vercel).
- NÃO assumir que a página tem calibragem: `unidades_por_ponto` só existe após o upsert.
