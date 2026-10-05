"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUrlFilters } from "@/hooks/use-url-filters";

/**
 * Valor sentinela do item "todos".
 *
 * O Base UI precisa de um valor para o item marcado, e `""` não serve: string
 * vazia é o estado "sem valor" do `Select`. A sentinela nunca colide com um valor
 * real do backend, e ela NUNCA sai para a URL — escolher "todos" remove o
 * param em vez de mandar `status=__all__` para o Go.
 */
const ALL = "__all__";

/**
 * Select de filtro sincronizado com a URL.
 *
 * Mesmo contrato do `FilterBar`: o valor vive em `?status=paid`, e a tela
 * (Server Component) lê de lá. Passa pelo mesmo `useUrlFilters`, então herda de
 * graça a regra de zerar a página ao mudar de filtro.
 */
export function FilterSelect({
  param,
  options,
  placeholder,
  allLabel = "Todos",
  widthClassName = "w-full sm:w-44",
}: {
  param: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  allLabel?: string;
  widthClassName?: string;
}) {
  const { params, write, pending } = useUrlFilters();

  const value = params.get(param) ?? ALL;

  // O Base UI emite `null` quando o item marcado é desmarcado; nesse caso a
  // intenção é voltar para "todos", que é remover o param da URL.
  function change(next: string | null) {
    write((search) => {
      if (next && next !== ALL) search.set(param, next);
      else search.delete(param);
    });
  }

  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className={widthClassName} aria-label={placeholder} disabled={pending}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}