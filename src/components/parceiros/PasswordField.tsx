import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/common/CopyButton";
import { generatePassword } from "@/lib/credentials";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  id?: string;
}

/** Campo de senha já preenchido com senha gerada, visível, com "gerar outra" e "copiar". */
export function PasswordField({ value, onChange, label = "Senha de acesso", id = "generated-password" }: Props) {
  const tooShort = value.length > 0 && value.length < 8;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono tracking-wide"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={tooShort}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => onChange(generatePassword())} title="Gerar outra senha" aria-label="Gerar outra senha">
          <RefreshCw />
        </Button>
        <CopyButton text={value} size="icon" disabled={!value} successMessage="Senha copiada" />
      </div>
      <p className={tooShort ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
        {tooShort ? "A senha precisa ter pelo menos 8 caracteres." : "Gerada automaticamente. Você pode editar ou gerar outra."}
      </p>
    </div>
  );
}
