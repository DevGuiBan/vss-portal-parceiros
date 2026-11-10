import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/credentials";

interface Props extends Omit<ButtonProps, "onClick"> {
  text: string;
  label?: string;
  successMessage?: string;
}

export function CopyButton({ text, label, successMessage = "Copiado!", variant = "outline", size = "sm", ...rest }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
      return;
    }
    toast.success(successMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button type="button" variant={variant} size={size} onClick={onCopy} aria-label={label || "Copiar"} {...rest}>
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {label && <span>{copied ? "Copiado" : label}</span>}
    </Button>
  );
}
