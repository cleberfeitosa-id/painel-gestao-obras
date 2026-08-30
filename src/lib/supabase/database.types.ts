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
      tarefas: {
        Row: {
          aprovacao: Database["public"]["Enums"]["aprovacao_tarefa"]
          atualizado_em: string
          avaliado_em: string | null
          avaliado_por: string | null
          concluida_em: string | null
          criado_em: string
          criado_por: string | null
          data_planejada: string | null
          descricao: string | null
          executor_id: string | null
          exige_arquivo: boolean
          exige_foto: boolean
          exige_video: boolean
          id: string
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
          data_planejada?: string | null
          descricao?: string | null
          executor_id?: string | null
          exige_arquivo?: boolean
          exige_foto?: boolean
          exige_video?: boolean
          id?: string
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
          data_planejada?: string | null
          descricao?: string | null
          executor_id?: string | null
          exige_arquivo?: boolean
          exige_foto?: boolean
          exige_video?: boolean
          id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      e_admin: { Args: never; Returns: boolean }
      e_gestor: { Args: never; Returns: boolean }
      private_papel_atual: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
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
      tipo_localizacao: "nenhuma" | "ponto" | "regiao"
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
      tipo_localizacao: ["nenhuma", "ponto", "regiao"],
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
export type PlantaRow = Tabelas<"plantas">;
export type ExecutorRow = Tabelas<"executores">;
export type LoteRascunhoRow = Tabelas<"lote_rascunhos">;
export type TarefaAprovacaoRow = Tabelas<"tarefa_aprovacoes">;
export type TarefaComentarioRow = Tabelas<"tarefa_comentarios">;
export type TarefaAnexoRow = Tabelas<"tarefa_anexos">;
export type NotificacaoRow = Tabelas<"notificacoes">;

// As colunas jsonb chegam como `Json`. Reafirmamos a forma concreta na camada
// de dominio para que a matematica de coordenadas continue tipada.
export type TarefaRow = Omit<Tabelas<"tarefas">, "regiao"> & {
  regiao: RegiaoPdf | null;
};

export type PlantaCalibracaoRow = Omit<
  Tabelas<"planta_calibracoes">,
  "ref_p1" | "ref_p2"
> & { ref_p1: PontoPdf; ref_p2: PontoPdf };
