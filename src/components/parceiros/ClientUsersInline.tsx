import { useEffect, useState } from "react";
import { callPartnerApi } from "@/lib/partnerApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PasswordField } from "@/components/parceiros/PasswordField";
import { AccessMessageCard } from "@/components/parceiros/AccessMessageCard";
import { CopyButton } from "@/components/common/CopyButton";
import { buildAccessMessage, generatePassword, portalLoginUrl } from "@/lib/credentials";
import { KeyRound, Trash2, UserPlus, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";

interface ClientUser {
  id: string;
  auth_user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
}

interface Props {
  responsibleId: string;
  clientName: string;
  slug: string;
  partnerName: string;
}

interface SuccessState {
  title: string;
  message: string;
  password: string;
}

function initials(s: string) {
  const parts = s.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export function ClientUsersInline({ responsibleId, clientName, slug, partnerName }: Props) {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetting, setResetting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClientUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const loginUrl = portalLoginUrl(slug);

  const load = async () => {
    setLoading(true);
    try {
      const j = await callPartnerApi("list-client-users", { responsible_id: responsibleId });
      setUsers((j.users || []) as ClientUser[]);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responsibleId]);

  const openAdd = () => {
    setEmail("");
    setDisplayName("");
    setPassword(generatePassword());
    setAddOpen(true);
  };

  const add = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || password.length < 8) {
      toast.error("Informe o e-mail e uma senha de pelo menos 8 caracteres");
      return;
    }
    setSaving(true);
    try {
      await callPartnerApi("add-client-user", { responsible_id: responsibleId, email: cleanEmail, password, display_name: displayName });
      setAddOpen(false);
      setSuccess({
        title: `Usuário ${cleanEmail} adicionado`,
        password,
        message: buildAccessMessage({ partnerName, recipientName: displayName || clientName, url: loginUrl, email: cleanEmail, password }),
      });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar usuário");
    } finally {
      setSaving(false);
    }
  };

  const openReset = (u: ClientUser) => {
    setResetTarget(u);
    setResetPwd(generatePassword());
  };

  const resetPassword = async () => {
    if (!resetTarget || resetPwd.length < 8) return;
    setResetting(true);
    try {
      await callPartnerApi("reset-client-user-password", {
        responsible_id: responsibleId,
        auth_user_id: resetTarget.auth_user_id,
        password: resetPwd,
      });
      const target = resetTarget;
      setResetTarget(null);
      setSuccess({
        title: "Senha redefinida",
        password: resetPwd,
        message: buildAccessMessage({
          partnerName,
          recipientName: target.display_name || clientName,
          url: loginUrl,
          email: target.email || "",
          password: resetPwd,
          isReset: true,
        }),
      });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao redefinir senha");
    } finally {
      setResetting(false);
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setBusyId(removeTarget.auth_user_id);
    try {
      await callPartnerApi("remove-client-user", { responsible_id: responsibleId, auth_user_id: removeTarget.auth_user_id });
      toast.success("Acesso removido");
      setRemoveTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover acesso");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" /> Link de acesso do portal
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-md bg-background border px-2.5 py-1.5 text-xs">{loginUrl}</code>
          <CopyButton text={loginUrl} size="icon" successMessage="Link copiado" className="h-8 w-8" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Usuários com acesso</p>
          <p className="text-xs text-muted-foreground">Pessoas que entram no portal por este cliente.</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <UserPlus /> Novo usuário
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum usuário com acesso. Clique em <strong>Novo usuário</strong> para liberar o portal.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const label = u.display_name || u.email || "—";
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                  {initials(label)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{label}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {u.role === "owner" ? "Titular" : "Membro"}
                    </Badge>
                  </div>
                  {u.display_name && u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                </div>
                <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => openReset(u)} title="Gerar nova senha">
                  <KeyRound /> <span className="hidden sm:inline">Nova senha</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remover acesso"
                  aria-label="Remover acesso"
                  onClick={() => setRemoveTarget(u)}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Libera mais uma pessoa para acessar o portal de {clientName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">E-mail</Label>
              <Input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="pessoa@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">Nome (opcional)</Label>
              <Input id="nu-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <PasswordField value={password} onChange={setPassword} id="nu-password" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={add} disabled={saving || !email.trim() || password.length < 8}>
              {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Adicionar e gerar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar nova senha</DialogTitle>
            <DialogDescription>
              A senha atual de <strong>{resetTarget?.email}</strong> deixará de funcionar.
            </DialogDescription>
          </DialogHeader>
          <PasswordField value={resetPwd} onChange={setResetPwd} id="reset-password" label="Nova senha" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button onClick={resetPassword} disabled={resetting || resetPwd.length < 8}>
              {resetting ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Redefinir senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!success} onOpenChange={(v) => !v && setSuccess(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados de acesso</DialogTitle>
            <DialogDescription>Envie a mensagem abaixo para a pessoa entrar no portal.</DialogDescription>
          </DialogHeader>
          {success && <AccessMessageCard title={success.title} message={success.message} password={success.password} />}
          <DialogFooter>
            <Button onClick={() => setSuccess(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remover acesso</DialogTitle>
            <DialogDescription>
              <strong>{removeTarget?.email || removeTarget?.display_name}</strong> não conseguirá mais entrar no portal de {clientName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={busyId === removeTarget?.auth_user_id}>
              {busyId === removeTarget?.auth_user_id ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
