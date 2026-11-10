import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PasswordField } from "@/components/parceiros/PasswordField";
import { AccessMessageCard } from "@/components/parceiros/AccessMessageCard";
import { callPartnerApi } from "@/lib/partnerApi";
import { buildAccessMessage, generatePassword, portalLoginUrl } from "@/lib/credentials";
import { parseMoney } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  slug: string;
  partnerName: string;
  onCreated: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateClientDialog({ open, onOpenChange, slug, partnerName, onCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState("");

  const reset = () => {
    setName(""); setEmail(""); setUnitPrice(""); setTouched(false);
    setPassword(generatePassword());
    setMessage(null); setCreatedPassword("");
  };

  useEffect(() => { if (open) reset(); }, [open]);

  const priceN = parseMoney(unitPrice);
  const errors = {
    name: !name.trim() ? "Informe o nome do cliente." : "",
    email: !email.trim() ? "Informe o e-mail de acesso." : !EMAIL_RE.test(email.trim()) ? "E-mail inválido." : "",
    password: password.length < 8 ? "Mínimo de 8 caracteres." : "",
    price: !Number.isFinite(priceN) || priceN < 0 ? "Valor inválido. Use, por exemplo, 0,05." : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    setSaving(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await callPartnerApi("create-client", { name: name.trim(), email: cleanEmail, password, unit_price: priceN });
      setCreatedPassword(password);
      setMessage(buildAccessMessage({ partnerName, recipientName: name, url: portalLoginUrl(slug), email: cleanEmail, password }));
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (msg: string) => (touched && msg ? <p className="text-[11px] text-destructive">{msg}</p> : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        {message ? (
          <>
            <DialogHeader>
              <DialogTitle>Acesso do cliente</DialogTitle>
              <DialogDescription>Envie os dados abaixo para o cliente entrar no portal.</DialogDescription>
            </DialogHeader>
            <AccessMessageCard title={`${name.trim()} cadastrado com sucesso`} message={message} password={createdPassword} />
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={reset}>
                <UserPlus /> Cadastrar outro
              </Button>
              <Button onClick={() => onOpenChange(false)}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>
                Cadastre o cliente e receba uma mensagem pronta com o link, e-mail e senha de acesso.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="cc-name">Nome do cliente</Label>
                <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Loja Exemplo" autoFocus aria-invalid={touched && !!errors.name} />
                {fieldError(errors.name)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-email">E-mail de acesso</Label>
                <Input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@empresa.com" aria-invalid={touched && !!errors.email} />
                {fieldError(errors.email)}
              </div>
              <PasswordField value={password} onChange={setPassword} id="cc-password" />
              <div className="space-y-1.5">
                <Label htmlFor="cc-price">Custo unitário do disparo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input id="cc-price" inputMode="decimal" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0,00" className="pl-9" aria-invalid={touched && !!errors.price} />
                </div>
                {fieldError(errors.price) || (
                  <p className="text-[11px] text-muted-foreground">Usado para calcular o faturamento estimado. Só você vê esse valor, o cliente não.</p>
                )}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Cadastrar e gerar acesso
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
