# SRC/COMPONENTS/PLANTAS — VISUALIZADOR PDF E CALIBRAGEM

## OVERVIEW
Subsistema de plantas (~2,2k linhas em 11 arquivos): renderiza PDF, calibra escala por página, gerencia pinos/regiões de tarefas e exporta pranchas técnicas A0/A1 com links.

## ARQUIVOS
| Arquivo | Linhas | Papel |
|---------|--------|-------|
| `visualizador-planta.tsx` | 894 | Viewer completo: ferramentas (navegar, medir, pino, regiao, calibra), pan/zoom, pinos e overlays |
| `modal-exportar-planta.tsx` | 280 | Exportação para PDF (A0 a A4) com pinos numerados e hiperlinks para fichas técnicas |
| `formulario-upload-planta.tsx` | 233 | Upload de PDF (≤100 MB) via URL assinada com progresso e contagem de páginas |
| `calibragem.tsx` | 169 | Status de calibragem + modal para informar distância real |
| `lista-tarefas-planta.tsx` | 131 | Painel lateral de tarefas da página atual |
| `menu-tarefas-sobrepostas.tsx` | 95 | Menu dropdown quando múltiplos pinos/regiões ocupam a mesma coordenada |
| `editar-planta-modal.tsx` | 90 | Edição de título/metadados da planta |
| `botao-excluir-planta.tsx` | 86 | Exclusão com confirmação |
| `tipos.ts` | 31 | `TarefaPlanta`, `PropsAreaPlanta` (server-compatible) |
| `area-planta.tsx` | 25 | Wrapper `dynamic(..., { ssr: false })` do viewer |
| `pdfjs.ts` | 20 | Configuração do worker do pdfjs + `contarPaginasPdf` |

## ESPAÇO DE COORDENADAS (invariante central)
Persistência **sempre** em pontos de PDF (origem inferior esquerda, Y para cima); renderização **sempre** em % do quadro. Toda a matemática mora em `@/lib/pdf/coordenadas.ts`.

```
clique  → telaParaPdf(clientX, clientY, canvasRect, larguraPagina, alturaPagina)   [inverte Y]
persiste→ ponto_x/ponto_y  ou  regiao.vertices                                     [espaço PDF]
render  → pdfParaPercentual(ponto, largura, altura) → { esquerda, topo } em %       [inverte Y de volta]
```

`dimensoes = {largura, altura}` capturado do **viewport em `scale: 1`** no `onLoadSuccess` da `<Page>`. Nunca derivar dimensão do canvas já escalado.

## FERRAMENTAS DO VIEWER
`navegar` (pan) · `medir` · `pino` · `regiao` · `calibrar` — estado em `ferramenta`.
- **calibrar**: 2 cliques → modal → `salvarCalibracao` → upsert `planta_calibracoes` (PK `planta_id,pagina`).
- **pino**: 1 clique → `/tarefas/nova?...&tipo=ponto&x=&y=`.
- **regiao**: arraste → `retanguloParaRegiao` → `regiao` na querystring.
- **medir**: usa calibragem da página; área escala com o quadrado do fator linear.

## CONVENTIONS
- Cores de pino/região vêm de `CORES_PINO`/`CORES_REGIAO`, indexadas por prioridade/aprovação.
- A calibragem é **por página**: `calibracoesPorPagina` é um `Map`.
- PDF carregado por URL assinada que expira; `renovarUrl()` chama `renovarUrlPlanta`.

## ANTI-PATTERNS
- NÃO importar `pdfjs.ts` nem o viewer de Server Component — entrada via `area-planta.tsx` (`ssr: false`).
- NÃO posicionar pino em pixels de tela nem usar dimensões do canvas escalado — só % via `pdfParaPercentual`.
- NÃO recalcular matemática aqui: estender `@/lib/pdf/coordenadas.ts`.
- NÃO enviar PDF pela função serverless — URL assinada + envio direto do navegador.
