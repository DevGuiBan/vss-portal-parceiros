import { useEffect, useState } from "react";
import { callPartnerApi } from "@/lib/partnerApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Trash2, UserPlus, Loader2, Users } from "lucide-react";
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
}

export function ClientUsersInline({ responsibleId, clientName }: Props) {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<ClientUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [removeTarget, setRemoveTarget] = useState<ClientUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const add = async () => {
    if (!email || password.length < 8) {
      toast.error("E-mail e senha (min. 8) obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await callPartnerApi("add-client-user", { responsible_id: responsibleId, email, password, display_name: displayName });
      toast.success("Usuário adicionado");
      setAddOpen(false);
      setEmail("");
      setPassword("");
      setDisplayName("");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetTarget || resetPwd.length < 8) {
      toast.error("Senha mínima 8");
      return;
    }
    try {
      await callPartnerApi("reset-client-user-password", {
        responsible_id: responsibleId,
        auth_user_id: resetTarget.auth_user_id,
        password: resetPwd,
      });
      toast.success("Senha redefinida");
      setResetTarget(null);
      setResetPwd("");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const remove = async () => {
    if (!removeTarget) return;
    setBusyId(removeTarget.auth_user_id);
    try {
      await callPartnerApi("remove-client-user", { responsible_id: responsibleId, auth_user_id: removeTarget.auth_user_id });
      toast.success("Usuário removido");
      setRemoveTarget(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-md border border-border/60 bg-muted/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuários</span>
          <Badge variant="secondary" className="text-[10px]">{users.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-3 w-3 mr-1" /> Novo usuário
        </Button>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground py-2">Carregando…</p>
      ) : users.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhum usuário cadastrado.</p>
      ) : (
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.email || u.display_name || "—"}</div>
                {u.display_name && u.email && <div className="text-[10px] text-muted-foreground truncate">{u.display_name}</div>}
              </div>
              <Badge variant={u.role === "owner" ? "secondary" : "outline"} className="text-[9px]">
                {u.role === "owner" ? "Titular" : "Membro"}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Redefinir senha"
                onClick={() => { setResetTarget(u); setResetPwd(""); }}
              >
                <KeyRound className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                title="Remover"
                onClick={() => setRemoveTarget(u)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo usuário — {clientName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Nome (opcional)</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={add} disabled={saving || !email || password.length < 8}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserPlus className="h-3.5 w-3.5 mr-1" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Redefinir senha — {resetTarget?.email}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} autoFocus placeholder="Mínimo 8 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancelar</Button>
            <Button onClick={resetPassword} disabled={resetPwd.length < 8}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Remover acesso</DialogTitle></DialogHeader>
          <p className="text-sm">
            Remover <span className="font-medium">{removeTarget?.email || removeTarget?.display_name}</span> de{" "}
            <span className="font-medium">{clientName}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={remove} disabled={busyId === removeTarget?.auth_user_id}>
              {busyId === removeTarget?.auth_user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
