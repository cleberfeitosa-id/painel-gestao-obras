import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CampoComumProps {
  rotulo: string;
  erro?: string;
  dica?: string;
  obrigatorio?: boolean;
}

function usarIds(rotulo: string, erro?: string, dica?: string) {
  const id = useId();
  return {
    inputId: id,
    labelId: `${id}-label`,
    erroId: erro ? `${id}-erro` : undefined,
    dicaId: dica ? `${id}-dica` : undefined,
    describedBy: [
      erro ? `${id}-erro` : null,
      dica ? `${id}-dica` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined,
  };
}

function rotuloClasses(obrigatorio?: boolean) {
  return cn(
    "block text-sm font-medium text-superficie-700 mb-1.5",
  );
}

const campoBase =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-superficie-900 placeholder:text-superficie-400 transition-colors focus:outline-none focus:ring-2 focus:ring-azul-500 focus:border-azul-500";

const campoErro =
  "border-perigo focus:ring-perigo focus:border-perigo";

const campoNormal =
  "border-borda hover:border-superficie-300";

interface CampoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">,
    CampoComumProps {}

export const Campo = forwardRef<HTMLInputElement, CampoProps>(
  function Campo(
    { rotulo, erro, dica, obrigatorio, className, type = "text", ...resto },
    ref,
  ) {
    const ids = usarIds(rotulo, erro, dica);

    return (
      <div>
        <label htmlFor={ids.inputId} className={rotuloClasses(obrigatorio)}>
          {rotulo}
          {obrigatorio && (
            <span className="text-perigo ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
        <input
          ref={ref}
          id={ids.inputId}
          type={type}
          aria-invalid={!!erro || undefined}
          aria-describedby={ids.describedBy}
          aria-required={obrigatorio}
          className={cn(campoBase, erro ? campoErro : campoNormal, className)}
          {...resto}
        />
        {dica && !erro && (
          <p id={ids.dicaId} className="mt-1 text-xs text-superficie-500">
            {dica}
          </p>
        )}
        {erro && (
          <p id={ids.erroId} className="mt-1 text-xs text-perigo" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  },
);

interface AreaTextoProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">,
    CampoComumProps {}

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(
  function AreaTexto(
    { rotulo, erro, dica, obrigatorio, className, ...resto },
    ref,
  ) {
    const ids = usarIds(rotulo, erro, dica);

    return (
      <div>
        <label htmlFor={ids.inputId} className={rotuloClasses(obrigatorio)}>
          {rotulo}
          {obrigatorio && (
            <span className="text-perigo ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
        <textarea
          ref={ref}
          id={ids.inputId}
          aria-invalid={!!erro || undefined}
          aria-describedby={ids.describedBy}
          aria-required={obrigatorio}
          className={cn(
            campoBase,
            "min-h-[80px] resize-y",
            erro ? campoErro : campoNormal,
            className,
          )}
          {...resto}
        />
        {dica && !erro && (
          <p id={ids.dicaId} className="mt-1 text-xs text-superficie-500">
            {dica}
          </p>
        )}
        {erro && (
          <p id={ids.erroId} className="mt-1 text-xs text-perigo" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  },
);

interface SelecaoProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">,
    CampoComumProps {
  children: React.ReactNode;
}

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(
  function Selecao(
    { rotulo, erro, dica, obrigatorio, className, children, ...resto },
    ref,
  ) {
    const ids = usarIds(rotulo, erro, dica);

    return (
      <div>
        <label htmlFor={ids.inputId} className={rotuloClasses(obrigatorio)}>
          {rotulo}
          {obrigatorio && (
            <span className="text-perigo ml-0.5" aria-hidden="true">*</span>
          )}
        </label>
        <select
          ref={ref}
          id={ids.inputId}
          aria-invalid={!!erro || undefined}
          aria-describedby={ids.describedBy}
          aria-required={obrigatorio}
          className={cn(
            campoBase,
            "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat pr-10",
            erro ? campoErro : campoNormal,
            className,
          )}
          {...resto}
        >
          {children}
        </select>
        {dica && !erro && (
          <p id={ids.dicaId} className="mt-1 text-xs text-superficie-500">
            {dica}
          </p>
        )}
        {erro && (
          <p id={ids.erroId} className="mt-1 text-xs text-perigo" role="alert">
            {erro}
          </p>
        )}
      </div>
    );
  },
);
