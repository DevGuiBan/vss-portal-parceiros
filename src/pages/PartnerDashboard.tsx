import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, LogOut, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerBranding } from "@/hooks/usePartnerBranding";
import { callPartnerApi } from "@/lib/partnerApi";

interface ClientStat { id: string; name: string; email: string | null; sent: number; delivered: number }

export default function PartnerDashboard() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { branding } = usePartnerBranding(slug);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [clients, setClients] = useState<ClientStat[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const j = await callPartnerApi("list-clients-with-stats");
      setClients(j.clients || []);
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("parceiro")) setForbidden(true);
      else toast.error(e?.message || "Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (!authLoading && user) load(); }, [authLoading, user]);

  if (!authLoading && !user) return <Navigate to={`/${slug}/login`} replace />;
  if (forbidden) return <Navigate to={`/${slug}/login`} replace />;

  const createClient = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) {
      toast.error("Nome, e-mail e senha (min. 8) são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await callPartnerApi("create-client", { name: name.trim(), email: email.trim(), password });
      toast.success("Cliente cadastrado");
      setCreateOpen(false); setName(""); setEmail(""); setPassword("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(
    () => clients.reduce((acc, c) => ({ sent: acc.sent + c.sent, delivered: acc.delivered + c.delivered }), { sent: 0, delivered: 0 }),
    [clients],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding?.logo_url && <img src={branding.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
          <h1 className="text-lg font-semibold">{branding?.display_name || "Portal do Parceiro"}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1.5" /> Sair
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clientes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{clients.length}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Enviadas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.sent}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entregues</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.delivered}</CardContent></Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Seus clientes</h2>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Novo cliente</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente cadastrado ainda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2 px-4">Cliente</th>
                    <th className="text-left py-2 px-4">E-mail</th>
                    <th className="text-right py-2 px-4">Enviadas</th>
                    <th className="text-right py-2 px-4">Entregues</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 px-4 font-medium">{c.name}</td>
                      <td className="py-2 px-4 text-muted-foreground">{c.email || "—"}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{c.sent}</td>
                      <td className="py-2 px-4 text-right tabular-nums">{c.delivered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
            <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createClient} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
