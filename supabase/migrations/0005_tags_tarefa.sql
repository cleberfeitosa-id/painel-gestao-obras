-- Tabela de vocabulario de tags de tarefas
CREATE TABLE public.tags_tarefa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  criado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas
  ADD COLUMN tag_id uuid REFERENCES public.tags_tarefa(id) ON DELETE SET NULL;

CREATE INDEX idx_tarefas_tag ON public.tarefas (tag_id);

-- RLS
ALTER TABLE public.tags_tarefa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_tarefa_select_all"
  ON public.tags_tarefa FOR SELECT TO authenticated USING (true);

-- Permite que gestor/admin OU colaborador crie a tag (o server action garantira a regra do colaborador)
CREATE POLICY "tags_tarefa_insert"
  ON public.tags_tarefa FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "tags_tarefa_update"
  ON public.tags_tarefa FOR UPDATE TO authenticated
  USING (public.e_gestor() OR public.e_admin())
  WITH CHECK (public.e_gestor() OR public.e_admin());

CREATE POLICY "tags_tarefa_delete"
  ON public.tags_tarefa FOR DELETE TO authenticated
  USING (public.e_gestor() OR public.e_admin());
