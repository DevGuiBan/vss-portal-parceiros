import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortal } from "@/hooks/usePortal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Inbox,
  Image as ImageIcon,
  Link as LinkIcon,
  Search,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
  Send,
  Clock,
  Paperclip,
  Loader2,
  Trash2,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Activity,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeSearch } from "@/lib/normalizeSearch";
import { PortalLiveDispatchDialog } from "@/components/portal/PortalLiveDispatchDialog";

const DEMAND_STATUS_META: Record<string, { label: string; cls: string }> = {
  pendente: { label: "A Fazer", cls: "bg-warning/15 text-warning border-warning/30" },
  conexao_numero: { label: "Conexão de Número", cls: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
  aprovacao_template: { label: "Template em Aprovação", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  producao: { label: "Em Produção", cls: "bg-fuchsia-500/15 text-fuchsia-500 border-fuchsia-500/30" },
  pronto: { label: "Pronto", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  disparado: { label: "Disparado", cls: "bg-success/15 text-success border-success/30" },
  remarcado: { label: "Remarcado", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function PortalSubmissionsList({ token }: { token: string | null }) {
  const { overview, loadOverview, requestChange, uploadFile, deleteSubmission } = usePortal(token);
  const submissions = overview?.submissions || [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const PAGE_SIZE = 8;
  const [page, setPage] = useState(1);
  const [lockedInfo, setLockedInfo] = useState<{ id: string; title: string; status: string } | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [liveTarget, setLiveTarget] = useState<{ id: string; title: string } | null>(null);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSubmission(deleteTarget.id);
      toast.success("Solicitação excluída.");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const result = await uploadFile(file, "change-request");
          setAttachments((prev) => [...prev, { name: file.name, url: result.url }]);
        } catch (e: any) {
          toast.error(`Falha ao enviar ${file.name}: ${e?.message || "erro"}`);
        }
      }
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitChangeRequest = async () => {
    if (!lockedInfo) return;
    const msg = requestMessage.trim();
    if (!msg && attachments.length === 0) {
      toast.error("Descreva a alteração ou anexe um arquivo.");
      return;
    }
    setSending(true);
    try {
      const attachmentsBlock = attachments.length
        ? `\n\nAnexos:\n${attachments.map((a) => `- ${a.name}: ${a.url}`).join("\n")}`
        : "";
      await requestChange(lockedInfo.id, `${msg}${attachmentsBlock}`.trim());
      toast.success("Solicitação enviada. Nossa equipe será notificada.");
      setLockedInfo(null);
      setRequestMessage("");
      setAttachments([]);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar a solicitação.");
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(() => {
    const q = normalizeSearch(search).trim();
    return submissions.filter((s: any) => {
      if (statusFilter !== "all") {
        const effective = s.demand_status || s.status;
        if (effective !== statusFilter) return false;
      }
      if (q) {
        const hay = `${s.action_name || ""} ${s.message_text || ""}`;
        if (!normalizeSearch(hay).includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, statusFilter]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = search || statusFilter !== "all";

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {submissions.length > 0 && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome da ação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="pendente">A Fazer</SelectItem>
                <SelectItem value="conexao_numero">Conexão de Número</SelectItem>
                <SelectItem value="aprovacao_template">Template em Aprovação</SelectItem>
                <SelectItem value="producao">Em Produção</SelectItem>
                <SelectItem value="pronto">Pronto</SelectItem>
                <SelectItem value="disparado">Disparado</SelectItem>
                <SelectItem value="remarcado">Remarcado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} de {submissions.length} solicitação{submissions.length === 1 ? "" : "ões"}
            </span>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </>
      )}

      {submissions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma solicitação enviada ainda.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma solicitação encontrada com os filtros atuais.</p>
          </CardContent>
        </Card>
      ) : (
            <div className="space-y-3">
              {visible.map((s: any) => {
                const ds = s.demand_status as string | null | undefined;
                const meta = ds ? DEMAND_STATUS_META[ds] : null;
                const title = (s.action_name || "").trim() || (s.message_text || "").slice(0, 60) || "(sem nome)";
                const adminDeleted = !!s.admin_deleted_at;
                const demandLocked = !!ds && ds !== "pendente";
                const canEdit = s.status === "pending" && !demandLocked && !adminDeleted;
                const hasPendingChange = !!s.change_request_at && !s.change_request_resolved_at;
                const hasResolvedChange = !!s.change_request_at && !!s.change_request_resolved_at;
                if (adminDeleted) {
                  return (
                    <div key={s.id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                            <AlertOctagon className="h-4 w-4 text-destructive shrink-0" /> {title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Enviada em {new Date(s.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 bg-destructive/15 text-destructive border-destructive/40">
                          Excluída pelo administrador
                        </Badge>
                      </div>
                      <div className="rounded-md bg-background/60 border border-destructive/20 p-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Motivo informado pela equipe:</p>
                        <p className="text-sm">
                          {s.admin_deleted_reason || <span className="text-muted-foreground italic">Sem motivo informado.</span>}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Excluída em {new Date(s.admin_deleted_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
                      </p>
                    </div>
                  );
                }
                const expanded = expandedId === s.id;
                return (
                  <Card key={s.id} className="overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                      onClick={() => setExpandedId(expanded ? null : s.id)}
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      {hasPendingChange && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-amber-500/15 text-amber-600 inline-flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" /> Alteração solicitada
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          meta
                            ? meta.cls
                            : s.status === "pending"
                              ? "bg-warning/15 text-warning border-warning/30"
                              : "bg-primary/15 text-primary border-primary/30",
                        )}
                      >
                        {meta?.label || (s.status === "pending" ? "Pendente" : "Processado")}
                      </Badge>
                      {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {expanded && (
                      <CardContent className="pt-0 pb-4 space-y-3 border-t">
                        <div className="flex flex-wrap gap-2 pt-3 text-xs text-muted-foreground">
                          {s.media_url && (
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                              <ImageIcon className="h-3 w-3" /> Mídia
                            </span>
                          )}
                          {s.offer_link && (
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                              <LinkIcon className="h-3 w-3" /> Link
                            </span>
                          )}
                          {s.contact_list_url ? (
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5">
                              <Users className="h-3 w-3" /> Lista
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-600 px-2 py-0.5"
                              title="Envie a lista de contatos para a demanda seguir"
                            >
                              <AlertTriangle className="h-3 w-3" /> Falta a lista de contatos
                            </span>
                          )}
                          {hasResolvedChange && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 px-2 py-0.5"
                              title={`Aprovada em ${new Date(s.change_request_resolved_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Alteração aprovada
                            </span>
                          )}
                        </div>
                        {(hasPendingChange || hasResolvedChange) && s.change_request_text && (
                          <div
                            className={cn(
                              "rounded-md border p-2.5 text-xs whitespace-pre-wrap break-words",
                              hasResolvedChange
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-amber-500/30 bg-amber-500/5",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Sua solicitação de alteração
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {hasResolvedChange
                                  ? `Aprovada em ${new Date(s.change_request_resolved_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                                  : `Enviada em ${new Date(s.change_request_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                              </span>
                            </div>
                            <p className="text-foreground/90 leading-relaxed">
                              {s.change_request_text}
                            </p>
                          </div>
                        )}
                        {canEdit && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              Para corrigir algo, exclua esta solicitação e envie novamente.
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive flex-1"
                                onClick={() => setDeleteTarget({ id: s.id, title })}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                              </Button>
                            </div>
                          </div>
                        )}
                        {(!canEdit) && (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {hasPendingChange
                                ? "Alteração já solicitada. Aguarde nossa equipe."
                                : "Esta solicitação já está em andamento na nossa equipe."}
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => setLiveTarget({ id: s.id, title })}
                              >
                                <Activity className="h-3.5 w-3.5 mr-1" /> Acompanhar disparo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                disabled={hasPendingChange}
                                onClick={() => {
                                  setLockedInfo({ id: s.id, title, status: meta?.label || "Em andamento" });
                                  setRequestMessage("");
                                }}
                              >
                                <Lock className="h-3.5 w-3.5 mr-1" />
                                {hasPendingChange ? "Alteração já solicitada" : "Solicitar alteração"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!lockedInfo} onOpenChange={(o) => !o && setLockedInfo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-500" /> Solicitar alteração
            </DialogTitle>
            <DialogDescription>
              A demanda <strong>{lockedInfo?.title}</strong> está no status{" "}
              <strong>{lockedInfo?.status}</strong>. Descreva abaixo o que precisa ser
              ajustado — nossa equipe receberá a solicitação no painel.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={requestMessage}
            onChange={(e) => setRequestMessage(e.target.value)}
            placeholder="Ex.: trocar o link da oferta para https://... ou alterar o horário para 15h."
            rows={5}
            maxLength={2000}
            disabled={sending}
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {requestMessage.length}/2000
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="change-request-attachments"
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-accent transition-colors",
                  (sending || uploadingAttachment) && "opacity-50 pointer-events-none",
                )}
              >
                {uploadingAttachment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
                {uploadingAttachment ? "Enviando..." : "Anexar arquivos"}
              </label>
              <input
                id="change-request-attachments"
                type="file"
                multiple
                className="hidden"
                disabled={sending || uploadingAttachment}
                onChange={(e) => {
                  handleAttachFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <span className="text-[11px] text-muted-foreground">
                Máx. 20MB por arquivo
              </span>
            </div>
            {attachments.length > 0 && (
              <ul className="space-y-1">
                {attachments.map((a, idx) => (
                  <li
                    key={`${a.url}-${idx}`}
                    className="flex items-center justify-between gap-2 text-xs rounded-md border bg-muted/40 px-2 py-1"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate hover:underline"
                      title={a.name}
                    >
                      {a.name}
                    </a>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeAttachment(idx)}
                      disabled={sending}
                      aria-label={`Remover ${a.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setLockedInfo(null)} disabled={sending}>
              Cancelar
            </Button>
            <Button
              onClick={submitChangeRequest}
              disabled={sending || uploadingAttachment || (!requestMessage.trim() && attachments.length === 0)}
            >
              <Send className="h-4 w-4 mr-1.5" />
              {sending ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              A solicitação <strong>{deleteTarget?.title}</strong> será removida
              permanentemente. Se ela ainda não foi processada, também será
              retirada do nosso painel. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PortalLiveDispatchDialog
        open={!!liveTarget}
        onOpenChange={(o) => !o && setLiveTarget(null)}
        submissionId={liveTarget?.id ?? null}
        title={liveTarget?.title}
      />
    </div>
  );
}
