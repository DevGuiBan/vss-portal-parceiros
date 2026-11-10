import { CheckCircle2, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/common/CopyButton";
import { whatsappShareUrl } from "@/lib/credentials";

interface Props {
  title: string;
  message: string;
  password: string;
}

/** Tela de sucesso com o texto de acesso pronto para enviar ao cliente. */
export function AccessMessageCard({ title, message, password }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium">{title}</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Mensagem para enviar ao cliente</p>
        <pre className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 text-[13px] leading-relaxed font-sans max-h-64 overflow-y-auto">
          {message}
        </pre>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <CopyButton text={message} label="Copiar mensagem" variant="default" successMessage="Mensagem copiada" className="sm:col-span-1" />
        <Button asChild variant="outline" size="sm">
          <a href={whatsappShareUrl(message)} target="_blank" rel="noreferrer">
            <MessageCircle /> Enviar no WhatsApp
          </a>
        </Button>
        <CopyButton text={password} label="Copiar só a senha" successMessage="Senha copiada" />
      </div>

      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-px" />
        <span>Por segurança, a senha não fica salva para consulta. Copie ou envie agora. Se precisar depois, basta redefinir na aba Acessos do cliente.</span>
      </div>
    </div>
  );
}
