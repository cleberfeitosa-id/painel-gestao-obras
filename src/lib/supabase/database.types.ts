export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      compras: {
        Row: { id: string; obra_id: string; fornecedor: string | null; documento: string | null; data_compra: string; observacao: string | null; criado_por: string | null; criado_em: string; atualizado_em: string }
        Insert: { id?: string; obra_id: string; fornecedor?: string | null; documento?: string | null; data_compra?: string; observacao?: string | null; criado_por?: string | null; criado_em?: string; atualizado_em?: string }
        Update: { id?: string; obra_id?: string; fornecedor?: string | null; documento?: string | null; data_compra?: string; observacao?: string | null; criado_por?: string | null; criado_em?: string; atualizado_em?: string }
        Relationships: []
      }
      compra_itens: {
        Row: { id: string; compra_id: string; orcamento_item_id: string | null; composicao_id: string | null; codigo_insumo: string | null; descricao: string; unidade: string; quantidade: number; valor_unitario: number; composicao_componente_id: string | null; categoria: string | null; coeficiente: number | null; criado_em: string }
        Insert: { id?: string; compra_id: string; orcamento_item_id?: string | null; composicao_id?: string | null; codigo_insumo?: string | null; descricao: string; unidade?: string; quantidade: number; valor_unitario: number; composicao_componente_id?: string | null; categoria?: string | null; coeficiente?: number | null; criado_em?: string }
        Update: { id?: string; compra_id?: string; orcamento_item_id?: string | null; composicao_id?: string | null; codigo_insumo?: string | null; descricao?: string; unidade?: string; quantidade?: number; valor_unitario?: number; composicao_componente_id?: string | null; categoria?: string | null; coeficiente?: number | null; criado_em?: string }
        Relationships: []
      }
      orcamento_auditoria: {
        Row: {
          id: string
          orcamento_id: string | null
          entidade: string
          entidade_id: string | null
          operacao: string
          antes: Json | null
          depois: Json | null
          autor_id: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          orcamento_id?: string | null
          entidade: string
          entidade_id?: string | null
          operacao: string
          antes?: Json | null
          depois?: Json | null
          autor_id?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          orcamento_id?: string | null
          entidade?: string
          entidade_id?: string | null
          operacao?: string
          antes?: Json | null
          depois?: Json | null
          autor_id?: string | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_auditoria_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_auditoria_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          id: string
          orcamento_id: string
          chave_estavel: string
          ordem: number
          codigo: string | null
          descricao: string | null
          unidade: string | null
          quantidade: number
          valor_unitario: number
          valor_total: number
          valor_bdi: number | null
          custo_real: number | null
          grupo: string | null
          dados: Json
          tipo: string
          ativo: boolean
          atualizado_em: string
          composicao_id: string | null
          composicao_versao: string | null
        }
        Insert: {
          id?: string
          orcamento_id: string
          chave_estavel: string
          ordem?: number
          codigo?: string | null
          descricao?: string | null
          unidade?: string | null
          quantidade?: number
          valor_unitario?: number
          valor_total?: number
          valor_bdi?: number | null
          custo_real?: number | null
          grupo?: string | null
          dados?: Json
          tipo?: string
          ativo?: boolean
          atualizado_em?: string
          composicao_id?: string | null
          composicao_versao?: string | null
        }
        Update: {
          id?: string
          orcamento_id?: string
          chave_estavel?: string
          ordem?: number
          codigo?: string | null
          descricao?: string | null
          unidade?: string | null
          quantidade?: number
          valor_unitario?: number
          valor_total?: number
          valor_bdi?: number | null
          custo_real?: number | null
          grupo?: string | null
          dados?: Json
          tipo?: string
          ativo?: boolean
          atualizado_em?: string
          composicao_id?: string | null
          composicao_versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_versoes: {
        Row: {
          id: string
          orcamento_id: string
          versao: number
          colunas: Json
          linhas: Json
          arquivo_caminho: string | null
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          orcamento_id: string
          versao: number
          colunas: Json
          linhas: Json
          arquivo_caminho?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          orcamento_id?: string
          versao?: number
          colunas?: Json
          linhas?: Json
          arquivo_caminho?: string | null
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_versoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          id: string
          obra_id: string
          nome: string
          descricao: string | null
          arquivo_nome: string | null
          arquivo_caminho: string | null
          colunas: Json
          linhas: Json
          criado_por: string | null
          criado_em: string
          atualizado_em: string
          versao: number
        }
        Insert: {
          id?: string
          obra_id: string
          nome: string
          descricao?: string | null
          arquivo_nome?: string | null
          arquivo_caminho?: string | null
          colunas?: Json
          linhas?: Json
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
          versao?: number
        }
        Update: {
          id?: string
          obra_id?: string
          nome?: string
          descricao?: string | null
          arquivo_nome?: string | null
          arquivo_caminho?: string | null
          colunas?: Json
          linhas?: Json
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
          versao?: number
        }
        Relationships: []
      }
      composicoes: {
        Row: {
          id: string
          obra_id: string
          codigo: string | null
          nome: string
          unidade: string
          custo_unitario: number
          criado_por: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          obra_id: string
          codigo?: string | null
          nome: string
          unidade?: string
          custo_unitario?: number
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          obra_id?: string
          codigo?: string | null
          nome?: string
          unidade?: string
          custo_unitario?: number
          criado_por?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      composicao_componentes: {
        Row: {
          id: string
          composicao_id: string
          nome: string
          categoria: string
          unidade: string
          quantidade: number
          custo_unitario: number
          codigo: string | null
          composicao_referencia_id: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          composicao_id: string
          nome: string
          categoria?: string
          unidade?: string
          quantidade?: number
          custo_unitario?: number
          codigo?: string | null
          composicao_referencia_id?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          composicao_id?: string
          nome?: string
          categoria?: string
          unidade?: string
          quantidade?: number
          custo_unitario?: number
          codigo?: string | null
          composicao_referencia_id?: string | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "composicao_componentes_composicao_id_fkey"
            columns: ["composicao_id"]
            isOneToOne: false
            referencedRelation: "composicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composicao_componentes_composicao_referencia_id_fkey"
            columns: ["composicao_referencia_id"]
            isOneToOne: false
            referencedRelation: "composicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      compatibilizacoes: {
        Row: {
          id: string
          obra_id: string
          nome: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          obra_id: string
          nome: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          obra_id?: string
          nome?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibilizacoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          }
        ]
      }
      compatibilizacao_plantas: {
        Row: {
          id: string
          compatibilizacao_id: string
          planta_id: string
          pagina: number
          e_base: boolean
          ref1_x: number
          ref1_y: number
          ref2_x: number
          ref2_y: number
          cor_identificacao: string
          opacidade: number
          visivel: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          compatibilizacao_id: string
          planta_id: string
          pagina?: number
          e_base?: boolean
          ref1_x: number
          ref1_y: number
          ref2_x: number
          ref2_y: number
          cor_identificacao?: string
          opacidade?: number
          visivel?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          compatibilizacao_id?: string
          planta_id?: string
          pagina?: number
          e_base?: boolean
          ref1_x?: number
          ref1_y?: number
          ref2_x?: number
          ref2_y?: number
          cor_identificacao?: string
          opacidade?: number
          visivel?: boolean
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibilizacao_plantas_compatibilizacao_id_fkey"
            columns: ["compatibilizacao_id"]
            isOneToOne: false
            referencedRelation: "compatibilizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibilizacao_plantas_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          }
        ]
      }
      compatibilizacao_choques: {
        Row: {
          id: string
          compatibilizacao_id: string
          ponto_x: number
          ponto_y: number
          descricao: string
          status: string
          criado_por: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          compatibilizacao_id: string
          ponto_x: number
          ponto_y: number
          descricao: string
          status?: string
          criado_por?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          compatibilizacao_id?: string
          ponto_x?: number
          ponto_y?: number
          descricao?: string
          status?: string
          criado_por?: string | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "compatibilizacao_choques_compatibilizacao_id_fkey"
            columns: ["compatibilizacao_id"]
            isOneToOne: false
            referencedRelation: "compatibilizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compatibilizacao_choques_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          }
        ]
      }
      levantamentos: {
        Row: {
          atualizado_em: string
          categorias: Json
          config_legenda: Json
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          itens: Json
          niveis: Json
          nome: string
          obra_id: string
          pagina: number
          planta_id: string
        }
        Insert: {
          atualizado_em?: string
          categorias?: Json
          config_legenda?: Json
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          niveis?: Json
          nome?: string
          obra_id: string
          pagina?: number
          planta_id: string
        }
        Update: {
          atualizado_em?: string
          categorias?: Json
          config_legenda?: Json
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          itens?: Json
          niveis?: Json
          nome?: string
          obra_id?: string
          pagina?: number
          planta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "levantamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levantamentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levantamentos_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      executores: {
        Row: {
          ativo: boolean
          atualizado_em: string
          contato: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          obra_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          contato?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          obra_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          contato?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executores_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executores_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_precos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          medicao_id: string
          orcamento_item_id: string | null
          nome: string
          unidade: string
          valor_unitario: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          medicao_id: string
          orcamento_item_id?: string | null
          nome: string
          unidade?: string
          valor_unitario: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          medicao_id?: string
          orcamento_item_id?: string | null
          nome?: string
          unidade?: string
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_precos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_precos_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_precos_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_precos_orcamento_itens: {
        Row: {
          catalogo_id: string
          orcamento_item_id: string
          created_at: string
        }
        Insert: {
          catalogo_id: string
          orcamento_item_id: string
          created_at?: string
        }
        Update: {
          catalogo_id?: string
          orcamento_item_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_precos_orcamento_itens_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_precos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalogo_precos_orcamento_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_aprovacoes: {
        Row: {
          criado_em: string
          decisao: Database["public"]["Enums"]["aprovacao_tarefa"]
          id: string
          motivo: string | null
          supervisor_id: string
          tarefa_id: string
        }
        Insert: {
          criado_em?: string
          decisao: Database["public"]["Enums"]["aprovacao_tarefa"]
          id?: string
          motivo?: string | null
          supervisor_id: string
          tarefa_id: string
        }
        Update: {
          criado_em?: string
          decisao?: Database["public"]["Enums"]["aprovacao_tarefa"]
          id?: string
          motivo?: string | null
          supervisor_id?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_aprovacoes_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_aprovacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_rascunhos: {
        Row: {
          criado_em: string
          criado_por: string
          id: string
          localizacoes: Json
          obra_id: string
          pagina: number
          planta_id: string
        }
        Insert: {
          criado_em?: string
          criado_por: string
          id?: string
          localizacoes: Json
          obra_id: string
          pagina: number
          planta_id: string
        }
        Update: {
          criado_em?: string
          criado_por?: string
          id?: string
          localizacoes?: Json
          obra_id?: string
          pagina?: number
          planta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lote_rascunhos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_rascunhos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_rascunhos_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          id: string
          obra_id: string
          titulo: string
          valor_contrato: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          obra_id: string
          titulo: string
          valor_contrato?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          obra_id?: string
          titulo?: string
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      medicao_pagamentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_pagamento: string
          descricao: string
          id: string
          medicao_id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_pagamento: string
          descricao: string
          id?: string
          medicao_id: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string
          descricao?: string
          id?: string
          medicao_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicao_pagamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicao_pagamentos_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          assunto: string
          criado_em: string
          destinatario: string
          erro: string | null
          id: string
          status: string
          tarefa_id: string | null
        }
        Insert: {
          assunto: string
          criado_em?: string
          destinatario: string
          erro?: string | null
          id?: string
          status?: string
          tarefa_id?: string | null
        }
        Update: {
          assunto?: string
          criado_em?: string
          destinatario?: string
          erro?: string | null
          id?: string
          status?: string
          tarefa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          atualizado_em: string
          cidade: string | null
          cliente: string | null
          codigo: string | null
          criado_em: string
          criado_por: string | null
          data_inicio: string | null
          data_prevista_fim: string | null
          descricao: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_obra"]
        }
        Insert: {
          atualizado_em?: string
          cidade?: string | null
          cliente?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          data_prevista_fim?: string | null
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
        }
        Update: {
          atualizado_em?: string
          cidade?: string | null
          cliente?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          data_prevista_fim?: string | null
          descricao?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
        }
        Relationships: [
          {
            foreignKeyName: "obras_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          aceito_em: string | null
          ativo: boolean
          atualizado_em: string
          cargo: string | null
          convidado_por: string | null
          criado_em: string
          email: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          pode_editar_financeiro: boolean
          telefone: string | null
        }
        Insert: {
          aceito_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          cargo?: string | null
          convidado_por?: string | null
          criado_em?: string
          email: string
          id: string
          nome: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          pode_editar_financeiro?: boolean
          telefone?: string | null
        }
        Update: {
          aceito_em?: string | null
          ativo?: boolean
          atualizado_em?: string
          cargo?: string | null
          convidado_por?: string | null
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          pode_editar_financeiro?: boolean
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      planta_calibracoes: {
        Row: {
          calibrado_por: string | null
          criado_em: string
          distancia_real: number
          pagina: number
          planta_id: string
          ref_p1: Json
          ref_p2: Json
          unidade: string
          unidades_por_ponto: number
        }
        Insert: {
          calibrado_por?: string | null
          criado_em?: string
          distancia_real: number
          pagina: number
          planta_id: string
          ref_p1: Json
          ref_p2: Json
          unidade?: string
          unidades_por_ponto: number
        }
        Update: {
          calibrado_por?: string | null
          criado_em?: string
          distancia_real?: number
          pagina?: number
          planta_id?: string
          ref_p1?: Json
          ref_p2?: Json
          unidade?: string
          unidades_por_ponto?: number
        }
        Relationships: [
          {
            foreignKeyName: "planta_calibracoes_calibrado_por_fkey"
            columns: ["calibrado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planta_calibracoes_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantas: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          obra_id: string
          tamanho_bytes: number | null
          total_paginas: number
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          obra_id: string
          tamanho_bytes?: number | null
          total_paginas?: number
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          obra_id?: string
          tamanho_bytes?: number | null
          total_paginas?: number
        }
        Relationships: [
          {
            foreignKeyName: "plantas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      tags_tarefa: {
        Row: {
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_tarefa_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_anexos: {
        Row: {
          caminho: string
          criado_em: string
          enviado_por: string | null
          id: string
          mime: string | null
          momento: Database["public"]["Enums"]["momento_anexo"]
          nome_arquivo: string
          tamanho_bytes: number | null
          tarefa_id: string
          tipo: Database["public"]["Enums"]["tipo_anexo"]
        }
        Insert: {
          caminho: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          momento?: Database["public"]["Enums"]["momento_anexo"]
          nome_arquivo: string
          tamanho_bytes?: number | null
          tarefa_id: string
          tipo: Database["public"]["Enums"]["tipo_anexo"]
        }
        Update: {
          caminho?: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          mime?: string | null
          momento?: Database["public"]["Enums"]["momento_anexo"]
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tarefa_id?: string
          tipo?: Database["public"]["Enums"]["tipo_anexo"]
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_anexos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_anexos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_comentarios: {
        Row: {
          autor_id: string | null
          criado_em: string
          id: string
          tarefa_id: string
          texto: string
        }
        Insert: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          tarefa_id: string
          texto: string
        }
        Update: {
          autor_id?: string | null
          criado_em?: string
          id?: string
          tarefa_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_medicoes: {
        Row: {
          catalogo_id: string
          criado_em: string
          criado_por: string | null
          id: string
          quantidade: number
          tarefa_id: string
        }
        Insert: {
          catalogo_id: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          quantidade: number
          tarefa_id: string
        }
        Update: {
          catalogo_id?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          quantidade?: number
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_medicoes_catalogo_id_fkey"
            columns: ["catalogo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_precos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_medicoes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_medicoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          aprovacao: Database["public"]["Enums"]["aprovacao_tarefa"]
          atualizado_em: string
          avaliado_em: string | null
          avaliado_por: string | null
          concluida_em: string | null
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          data_planejada: string | null
          descricao: string | null
          executor_id: string | null
          exige_arquivo: boolean
          exige_foto: boolean
          exige_video: boolean
          id: string
          levantamento_id: string | null
          localizacao_detalhe: Json | null
          localizacao_tipo: Database["public"]["Enums"]["tipo_localizacao"]
          motivo_reprovacao: string | null
          obra_id: string
          pagina: number | null
          planta_id: string | null
          ponto_x: number | null
          ponto_y: number | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["prioridade_tarefa"]
          regiao: Json | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_tarefa"]
          supervisor_id: string | null
          tag_id: string | null
          titulo: string
        }
        Insert: {
          aprovacao?: Database["public"]["Enums"]["aprovacao_tarefa"]
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_planejada?: string | null
          descricao?: string | null
          executor_id?: string | null
          exige_arquivo?: boolean
          exige_foto?: boolean
          exige_video?: boolean
          id?: string
          levantamento_id?: string | null
          localizacao_detalhe?: Json | null
          localizacao_tipo?: Database["public"]["Enums"]["tipo_localizacao"]
          motivo_reprovacao?: string | null
          obra_id: string
          pagina?: number | null
          planta_id?: string | null
          ponto_x?: number | null
          ponto_y?: number | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          regiao?: Json | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          supervisor_id?: string | null
          tag_id?: string | null
          titulo: string
        }
        Update: {
          aprovacao?: Database["public"]["Enums"]["aprovacao_tarefa"]
          atualizado_em?: string
          avaliado_em?: string | null
          avaliado_por?: string | null
          concluida_em?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          data_planejada?: string | null
          descricao?: string | null
          executor_id?: string | null
          exige_arquivo?: boolean
          exige_foto?: boolean
          exige_video?: boolean
          id?: string
          levantamento_id?: string | null
          localizacao_detalhe?: Json | null
          localizacao_tipo?: Database["public"]["Enums"]["tipo_localizacao"]
          motivo_reprovacao?: string | null
          obra_id?: string
          pagina?: number | null
          planta_id?: string | null
          ponto_x?: number | null
          ponto_y?: number | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_tarefa"]
          regiao?: Json | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_tarefa"]
          supervisor_id?: string | null
          tag_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "executores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_tarefa"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_dependencias: {
        Row: {
          criado_em: string
          depende_de: string
          tarefa_id: string
        }
        Insert: {
          criado_em?: string
          depende_de: string
          tarefa_id: string
        }
        Update: {
          criado_em?: string
          depende_de?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_dependencias_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_dependencias_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      quadro_templates: {
        Row: {
          altura_mm: number
          altura_util_mm: number
          corrente_nominal: number | null
          criado_em: string
          criado_por: string | null
          descricao: string | null
          grau_protecao: string | null
          id: string
          largura_mm: number
          largura_util_mm: number
          layout: Json
          margem_lateral_mm: number
          margem_topo_mm: number
          material_caixa: string | null
          nome: string
          profundidade_mm: number
          publico: boolean
          tensao_nominal: string | null
          tipo_quadro: string
          atualizado_em: string
        }
        Insert: {
          altura_mm?: number
          altura_util_mm?: number
          corrente_nominal?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          grau_protecao?: string | null
          id?: string
          largura_mm?: number
          largura_util_mm?: number
          layout?: Json
          margem_lateral_mm?: number
          margem_topo_mm?: number
          material_caixa?: string | null
          nome: string
          profundidade_mm?: number
          publico?: boolean
          tensao_nominal?: string | null
          tipo_quadro?: string
          atualizado_em?: string
        }
        Update: {
          altura_mm?: number
          altura_util_mm?: number
          corrente_nominal?: number | null
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          grau_protecao?: string | null
          id?: string
          largura_mm?: number
          largura_util_mm?: number
          layout?: Json
          margem_lateral_mm?: number
          margem_topo_mm?: number
          material_caixa?: string | null
          nome?: string
          profundidade_mm?: number
          publico?: boolean
          tensao_nominal?: string | null
          tipo_quadro?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadro_templates_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      quadros_eletricos: {
        Row: {
          altura_mm: number
          altura_util_mm: number
          circuitos_vinculados: Json
          corrente_curto_ka: number | null
          corrente_nominal: number | null
          criado_em: string
          criado_por: string | null
          grau_protecao: string | null
          id: string
          largura_mm: number
          largura_util_mm: number
          layout: Json
          levantamento_id: string | null
          margem_lateral_mm: number
          margem_topo_mm: number
          material_caixa: string | null
          nome: string | null
          obra_id: string
          planta_id: string | null
          profundidade_mm: number
          tag: string
          template_id: string | null
          tensao_nominal: string | null
          tipo_quadro: string
          atualizado_em: string
        }
        Insert: {
          altura_mm?: number
          altura_util_mm?: number
          circuitos_vinculados?: Json
          corrente_curto_ka?: number | null
          corrente_nominal?: number | null
          criado_em?: string
          criado_por?: string | null
          grau_protecao?: string | null
          id?: string
          largura_mm?: number
          largura_util_mm?: number
          layout?: Json
          levantamento_id?: string | null
          margem_lateral_mm?: number
          margem_topo_mm?: number
          material_caixa?: string | null
          nome?: string | null
          obra_id: string
          planta_id?: string | null
          profundidade_mm?: number
          tag: string
          template_id?: string | null
          tensao_nominal?: string | null
          tipo_quadro?: string
          atualizado_em?: string
        }
        Update: {
          altura_mm?: number
          altura_util_mm?: number
          circuitos_vinculados?: Json
          corrente_curto_ka?: number | null
          corrente_nominal?: number | null
          criado_em?: string
          criado_por?: string | null
          grau_protecao?: string | null
          id?: string
          largura_mm?: number
          largura_util_mm?: number
          layout?: Json
          levantamento_id?: string | null
          margem_lateral_mm?: number
          margem_topo_mm?: number
          material_caixa?: string | null
          nome?: string | null
          obra_id?: string
          planta_id?: string | null
          profundidade_mm?: number
          tag?: string
          template_id?: string | null
          tensao_nominal?: string | null
          tipo_quadro?: string
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadros_eletricos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_eletricos_planta_id_fkey"
            columns: ["planta_id"]
            isOneToOne: false
            referencedRelation: "plantas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_eletricos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quadro_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quadros_eletricos_levantamento_id_fkey"
            columns: ["levantamento_id"]
            isOneToOne: false
            referencedRelation: "levantamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
      Functions: {
      compras_por_item_orcamento: {
        Args: { p_obra_id: string }
        Returns: { orcamento_item_id: string; comprado: number }[]
      }
      componentes_composicao_para_compra: {
        Args: { p_composicao_id: string }
        Returns: { componente_id: string; codigo: string | null; nome: string; categoria: string; unidade: string; quantidade: number; custo_unitario: number; custo_total: number }[]
      }
      painel_compras_orcamento: {
        Args: { p_obra_id: string }
        Returns: {
          orcamento_item_id: string; codigo: string | null; descricao: string | null; unidade: string | null
          quantidade_prevista: number; previsto: number
          quantidade_medida: number; medido: number
          quantidade_executada: number; executado: number
          comprado_total: number; comprado_material: number
          saldo_disponivel_material: number; economia_material: number
          composicao_id: string | null
        }[]
      }
      buscar_insumos_compra: {
        Args: { p_obra_id: string; p_termo: string }
        Returns: {
          componente_id: string; codigo: string | null; nome: string; unidade: string
          coeficiente: number; custo_unitario: number; composicao_id: string
          composicao_codigo: string | null; composicao_nome: string
        }[]
      }
      buscar_insumos_compra_hierarquicos: {
        Args: { p_obra_id: string; p_termo: string }
        Returns: {
          componente_id: string; orcamento_item_id: string; orcamento_codigo: string | null
          orcamento_descricao: string | null; quantidade_composicao: number
          quantidade_prevista: number; valor_previsto: number; codigo: string | null
           nome: string; unidade: string; coeficiente: number; custo_unitario: number
           composicao_id: string; composicao_codigo: string | null; composicao_nome: string
           categoria: string
           quantidade_comprada: number
           valor_comprado: number
           compras_anteriores: Json
         }[]
      }
      limpar_dados_importados_obra: {
        Args: { p_obra_id: string }
        Returns: undefined
      }
      buscar_itens_orcamento_composicao: {
        Args: { p_obra_id: string; p_termo: string }
        Returns: { id: string; codigo: string | null; descricao: string | null; unidade: string | null; quantidade: number; valor_unitario: number; valor_total: number; composicao_id: string | null }[]
      }
      aplicar_custo_composicao: {
        Args: { p_autor?: string; p_chave_estavel: string; p_orcamento_id: string }
        Returns: number
      }
      custo_composicoes: {
        Args: { p_composicao_id?: string; p_obra_id: string }
        Returns: { composicao_id: string; categoria: string; total: number }[]
      }
      atualizar_catalogo_com_vinculos: {
        Args: {
          p_catalogo_id: string
          p_medicao_id: string
          p_nome: string
          p_valor_unitario: number
          p_unidade: string
          p_orcamento_item_ids: string[]
        }
        Returns: undefined
      }
      criar_catalogo_com_vinculos: {
        Args: {
          p_medicao_id: string
          p_nome: string
          p_valor_unitario: number
          p_unidade: string
          p_criado_por?: string | null
          p_orcamento_item_ids: string[]
        }
        Returns: string
      }
      preco_efetivo_catalogo: {
        Args: { p_catalogo_id: string }
        Returns: number
      }
      custo_composicao_por_categoria: {
        Args: { p_obra_id: string; p_orcamento_item_id: string }
        Returns: { categoria: string; total: number }[]
      }
      e_admin: { Args: never; Returns: boolean }
      e_financeiro: { Args: never; Returns: boolean }
      e_gestor: { Args: never; Returns: boolean }
      painel_orcamento_hierarquico: {
        Args: { p_obra_id: string }
        Returns: {
          orcamento_item_id: string; codigo: string | null; descricao: string | null
          unidade: string | null; tipo: string | null; nivel: number
          quantidade_prevista: number; previsto: number
          quantidade_medida: number; medido: number
          quantidade_executada: number; executado: number
          comprado_material: number; composicao_id: string | null
        }[]
      }
      painel_financeiro_obra: {
        Args: { p_obra_id: string }
        Returns: {
          codigo: string | null
          composicao_id: string | null
          descricao: string | null
          executado: number
          medido: number
          orcamento_item_id: string
          quantidade_executada: number
          quantidade_medida: number
          quantidade_prevista: number
          previsto: number
          unidade: string | null
        }[]
      }
      private_papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      registrar_versao_orcamento: {
        Args: { p_autor?: string; p_orcamento_id: string }
        Returns: number
      }
      resolver_composicao_por_codigo: {
        Args: { p_codigo: string; p_obra_id: string }
        Returns: string
      }
      reverter_custo_composicao: {
        Args: { p_autor?: string; p_chave_estavel: string; p_orcamento_id: string }
        Returns: number
      }
      salvar_orcamento_atomico: {
        Args: {
          p_autor?: string
          p_colunas: Json
          p_linhas: Json
          p_nome: string
          p_orcamento_id: string
          p_obra_id: string
          p_versao_esperada?: number | null
        }
        Returns: number
      }
      substituir_componentes_composicao: {
        Args: { p_composicao_id: string; p_componentes: Json }
        Returns: undefined
      }
      valor_executado_medicao: {
        Args: { p_medicao_id: string }
        Returns: number
      }
      valor_pago_medicao: {
        Args: { p_medicao_id: string }
        Returns: number
      }
      valor_pendente_medicao: {
        Args: { p_medicao_id: string }
        Returns: number
      }
      resumo_financeiro_medicao: {
        Args: { p_medicao_id: string }
        Returns: {
          quantidade_executada: number
          quantidade_medida: number
          quantidade_pendente: number
          valor_executado: number
          valor_medido_total: number
          valor_pago: number
          valor_pendente: number
        }[]
      }
      vincular_composicao_item: {
        Args: { p_autor?: string; p_chave_estavel: string; p_composicao_id: string; p_orcamento_id: string }
        Returns: number
      }
    }
    Enums: {
      aprovacao_tarefa: "pendente" | "aprovado" | "reprovado"
      momento_anexo: "criacao" | "andamento" | "conclusao"
      papel_usuario: "admin" | "gestor" | "colaborador"
      prioridade_tarefa: "baixa" | "media" | "alta" | "urgente"
      status_obra: "planejamento" | "em_andamento" | "pausada" | "concluida"
      status_tarefa: "pendente" | "em_execucao" | "concluido"
      tipo_anexo: "imagem" | "video" | "arquivo"
      tipo_localizacao: "nenhuma" | "ponto" | "regiao" | "distancia" | "circuito" | "area" | "descida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      aprovacao_tarefa: ["pendente", "aprovado", "reprovado"],
      momento_anexo: ["criacao", "andamento", "conclusao"],
      papel_usuario: ["admin", "gestor", "colaborador"],
      prioridade_tarefa: ["baixa", "media", "alta", "urgente"],
      status_obra: ["planejamento", "em_andamento", "pausada", "concluida"],
      status_tarefa: ["pendente", "em_execucao", "concluido"],
      tipo_anexo: ["imagem", "video", "arquivo"],
      tipo_localizacao: ["nenhuma", "ponto", "regiao", "distancia", "circuito", "area"],
    },
  },
} as const

export type Tabelas<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insercao<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Atualizacao<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

type EnumsPublicos = Database["public"]["Enums"];

export type PapelUsuario = EnumsPublicos["papel_usuario"];
export type AprovacaoTarefa = EnumsPublicos["aprovacao_tarefa"];
export type StatusObra = EnumsPublicos["status_obra"];
export type StatusTarefa = EnumsPublicos["status_tarefa"];
export type PrioridadeTarefa = EnumsPublicos["prioridade_tarefa"];
export type TipoLocalizacao = EnumsPublicos["tipo_localizacao"];
export type TipoAnexo = EnumsPublicos["tipo_anexo"];
export type MomentoAnexo = EnumsPublicos["momento_anexo"];

export type PontoPdf = { x: number; y: number };
export type RegiaoPdf = { vertices: PontoPdf[] };

export type PerfilRow = Tabelas<"perfis">;
export type ObraRow = Tabelas<"obras">;
export type MedicaoRow = Tabelas<"medicoes">;
export type PlantaRow = Tabelas<"plantas">;
export type CatalogoPrecoRow = Tabelas<"catalogo_precos">;
export type ExecutorRow = Tabelas<"executores">;
export type LoteRascunhoRow = Tabelas<"lote_rascunhos">;
export type TarefaAprovacaoRow = Tabelas<"tarefa_aprovacoes">;
export type TarefaMedicaoRow = Tabelas<"tarefa_medicoes">;
export type TarefaComentarioRow = Tabelas<"tarefa_comentarios">;
export type TarefaAnexoRow = Tabelas<"tarefa_anexos">;
export type NotificacaoRow = Tabelas<"notificacoes">;
export type TagsTarefaRow = Tabelas<"tags_tarefa">;
export type TarefaDependenciaRow = Tabelas<"tarefa_dependencias">;
export type MedicaoPagamentoRow = Tabelas<"medicao_pagamentos">;
export type LevantamentoRow = Tabelas<"levantamentos">;
export type OrcamentoRow = Tabelas<"orcamentos">;
export type OrcamentoItemRow = Tabelas<"orcamento_itens">;
export type OrcamentoVersaoRow = Tabelas<"orcamento_versoes">;
export type OrcamentoAuditoriaRow = Tabelas<"orcamento_auditoria">;
export type ComposicaoRow = Tabelas<"composicoes">;
export type ComposicaoComponenteRow = Tabelas<"composicao_componentes">;
export type QuadroTemplateRow = Tabelas<"quadro_templates">;
export type QuadroEletricoRow = Tabelas<"quadros_eletricos">;

// As colunas jsonb chegam como `Json`. Reafirmamos a forma concreta na camada
// de dominio para que a matematica de coordenadas continue tipada.
export type TarefaRow = Omit<Tabelas<"tarefas">, "regiao"> & {
  regiao: RegiaoPdf | null;
};

export type PlantaCalibracaoRow = Omit<
  Tabelas<"planta_calibracoes">,
  "ref_p1" | "ref_p2"
> & { ref_p1: PontoPdf; ref_p2: PontoPdf };
