import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePortal } from "@/hooks/usePortal";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { driveThumbnailUrl, driveStreamUrl } from "@/lib/driveMedia";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUTTON_LABEL_OPTIONS, formatTestNumbers, testNumbersAreValid } from "@/lib/whatsappFields";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Send,
  CheckCircle2,
  Upload,
  Image,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Clock,
  CalendarIcon,
  X,
  AlertTriangle,
  MessageCircle,
  Plus,
  MousePointerClick,
  User,
  Users,
  Check,
  ArrowLeft,
  ArrowRight,
  Film,
  ClipboardCheck,
  BookmarkPlus,
} from "lucide-react";

const MAX_SIZE = 20 * 1024 * 1024;
const MIN_LEAD_HOURS = 3;

const DEMAND_STATUS_META: Record<string, { label: string; cls: string }> = {
  pendente: { label: "A Fazer", cls: "bg-warning/20 text-warning" },
  conexao_numero: { label: "Conexão de Número", cls: "bg-indigo-500/15 text-indigo-500" },
  aprovacao_template: { label: "Template em Aprovação", cls: "bg-amber-500/15 text-amber-500" },
  producao: { label: "Em Produção", cls: "bg-fuchsia-500/15 text-fuchsia-500" },
  pronto: { label: "Pronto", cls: "bg-emerald-500/15 text-emerald-500" },
  disparado: { label: "Disparado", cls: "bg-success/15 text-success" },
  remarcado: { label: "Remarcado", cls: "bg-sky-500/15 text-sky-500" },
  cancelado: { label: "Cancelado", cls: "bg-destructive/15 text-destructive" },
};

function getSubmissionStatusMeta(submission: any) {
  const demandStatus = submission?.demand_status as string | null | undefined;
  if (demandStatus && DEMAND_STATUS_META[demandStatus]) return DEMAND_STATUS_META[demandStatus];
  return submission?.status === "pending"
    ? { label: "Pendente", cls: "bg-warning/20 text-warning" }
    : { label: "Processado", cls: "bg-primary/20 text-primary" };
}

interface MediaItem {
  url: string;
  storagePath: string;
  driveFileId: string;
  mimeType: string;
  fileName: string;
}

export interface EditingSubmission {
  id: string;
  action_name?: string | null;
  waba_profile_name?: string | null;
  waba_ddd?: string | null;
  waba_profile_photo_url?: string | null;
  waba_profile_photo_drive_id?: string | null;
  waba_profile_photo_storage_path?: string | null;
  message_text: string;
  offer_link?: string;
  contact_list_url?: string;
  contact_list_storage_paths?: string[] | null;
  contact_list_drive_file_ids?: string[] | null;
  dispatch_date?: string | null;
  scheduled_time?: string;
  observations?: string;
  buttons?: any;
  media_items?: any;
}

export function PortalSubmissionForm({
  token,
  editing,
  prefill,
  onDone,
}: {
  token: string | null;
  editing?: EditingSubmission | null;
  prefill?: { presetName?: string; payload: any } | null;
  onDone?: () => void;
}) {
  const { submitDispatch, updateSubmission, submissions, uploadFile, savePreset } = usePortal(token);
  const [actionName, setActionName] = useState("");
  const [historyPage, setHistoryPage] = useState(0);
  const [wabaName, setWabaName] = useState("");
  const [wabaDdd, setWabaDdd] = useState("");
  const [wabaPhotoUrl, setWabaPhotoUrl] = useState("");
  const [wabaPhotoDriveId, setWabaPhotoDriveId] = useState("");
  const [wabaPhotoStoragePath, setWabaPhotoStoragePath] = useState("");
  const [messageText, setMessageText] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [contactListUrls, setContactListUrls] = useState<string[]>([]);
  const [contactListNames, setContactListNames] = useState<string[]>([]);
  const [contactListPaths, setContactListPaths] = useState<string[]>([]);
  const [contactListDriveIds, setContactListDriveIds] = useState<string[]>([]);
  const [dispatchDate, setDispatchDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("");
  const [observations, setObservations] = useState("");
  const [buttons, setButtons] = useState<{ label: string; link: string }[]>([]);
  const [testNumbers, setTestNumbers] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [mediaProgress, setMediaProgress] = useState(0);
  const [contactsProgress, setContactsProgress] = useState(0);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [contactsUploadError, setContactsUploadError] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [fileSizeWarning, setFileSizeWarning] = useState<string | null>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    setActionName(editing.action_name || "");
    setWabaName(editing.waba_profile_name || "");
    setWabaDdd(editing.waba_ddd || "");
    setWabaPhotoUrl(editing.waba_profile_photo_url || "");
    setWabaPhotoDriveId(editing.waba_profile_photo_drive_id || "");
    setWabaPhotoStoragePath(editing.waba_profile_photo_storage_path || "");
    setMessageText(editing.message_text || "");
    setDispatchDate(editing.dispatch_date ? new Date(editing.dispatch_date + "T12:00:00") : undefined);
    setScheduledTime(editing.scheduled_time || "");
    setObservations(editing.observations || "");
    setTestNumbers((editing as any)?.test_numbers || "");
    const btns = Array.isArray(editing.buttons) ? editing.buttons : [];
    setButtons(btns.map((b: any) => ({ label: String(b?.label || ""), link: String(b?.link || "") })));
    const items = Array.isArray(editing.media_items) ? editing.media_items : [];
    setMediaItems(
      items.map((m: any) => ({
        url: String(m?.url || ""),
        storagePath: String(m?.storage_path || m?.storagePath || ""),
        driveFileId: String(m?.drive_file_id || m?.driveFileId || ""),
        mimeType: String(m?.mime_type || m?.mimeType || ""),
        fileName: String(m?.file_name || m?.fileName || ""),
      })),
    );
    const urls = (editing.contact_list_url || "").split("\n").filter(Boolean);
    setContactListUrls(urls);
    setContactListNames(
      urls.map((u, i) => {
        try {
          return decodeURIComponent(u.split("/").pop() || `Lista ${i + 1}`);
        } catch {
          return `Lista ${i + 1}`;
        }
      }),
    );
    setContactListPaths(editing.contact_list_storage_paths || []);
    setContactListDriveIds(editing.contact_list_drive_file_ids || []);
    setCurrentStep(1);
  }, [editing]);

  const [presetSourceName, setPresetSourceName] = useState("");
  useEffect(() => {
    if (!prefill?.payload) return;
    const p = prefill.payload || {};
    setPresetSourceName(prefill.presetName || "");
    setActionName(String(p.action_name || ""));
    setWabaName(String(p.waba_profile_name || ""));
    setWabaDdd(String(p.waba_ddd || ""));
    setWabaPhotoUrl(String(p.waba_profile_photo_url || ""));
    setWabaPhotoDriveId(String(p.waba_profile_photo_drive_id || ""));
    setWabaPhotoStoragePath(String(p.waba_profile_photo_storage_path || ""));
    setMessageText(String(p.message_text || ""));
    setObservations(String(p.observations || ""));
    setTestNumbers(String(p.test_numbers || ""));
    setButtons(
      (Array.isArray(p.buttons) ? p.buttons : []).map((b: any) => ({
        label: String(b?.label || ""),
        link: String(b?.link || ""),
      })),
    );
    setMediaItems(
      (Array.isArray(p.media_items) ? p.media_items : []).map((m: any) => ({
        url: String(m?.url || ""),
        storagePath: String(m?.storage_path || m?.storagePath || ""),
        driveFileId: String(m?.drive_file_id || m?.driveFileId || ""),
        mimeType: String(m?.mime_type || m?.mimeType || ""),
        fileName: String(m?.file_name || m?.fileName || ""),
      })),
    );
    setDispatchDate(undefined);
    setScheduledTime("");
    setCurrentStep(1);
  }, [prefill]);

  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toast.error("Informe um nome para o modelo");
      return;
    }
    setSavingPreset(true);
    try {
      await savePreset({
        name: presetName.trim(),
        description: presetDescription.trim(),
        payload: {
          action_name: actionName.trim(),
          waba_profile_name: wabaName.trim(),
          waba_ddd: wabaDdd.trim(),
          waba_profile_photo_url: wabaPhotoUrl,
          waba_profile_photo_drive_id: wabaPhotoDriveId,
          waba_profile_photo_storage_path: wabaPhotoStoragePath,
          message_text: messageText.trim(),
          media_items: mediaItems,
          buttons: buttons.filter((b) => b.label.trim()),
          observations: observations.trim(),
          test_numbers: formatTestNumbers(testNumbers),
        },
      });
      toast.success("Modelo salvo", { description: "Disponível em Modelos de Demanda." });
      setPresetDialogOpen(false);
      setPresetName("");
      setPresetDescription("");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingPreset(false);
    }
  };

  const leadHours = useMemo(() => {
    if (!dispatchDate || !scheduledTime) return null;
    const [h, m] = scheduledTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const target = new Date(dispatchDate);
    target.setHours(h, m, 0, 0);
    return (target.getTime() - Date.now()) / (1000 * 60 * 60);
  }, [dispatchDate, scheduledTime]);
  const belowLeadTime = leadHours !== null && leadHours < MIN_LEAD_HOURS;

  const handleProfilePhotoUpload = async (file: File) => {
    if (file.size > MAX_SIZE) {
      toast.error("Imagem muito grande", { description: "Máximo de 20MB." });
      return;
    }
    setUploading("profile-photo");
    setPhotoUploadError(null);
    setPhotoProgress(0);
    try {
      const result = await uploadFile(file, "profile-photo", setPhotoProgress);
      setWabaPhotoUrl(result.url);
      setWabaPhotoDriveId(result.driveFileId || "");
      setWabaPhotoStoragePath(result.storagePath || "");
      toast.success("Foto carregada");
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Erro ao enviar foto");
      toast.error("Erro ao enviar foto", { description: msg });
      setPhotoUploadError(msg);
    } finally {
      setUploading(null);
    }
  };

  type WizardStep = 1 | 2 | 3 | 4;
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  const stepsMeta = [
    { id: 1 as const, label: "Perfil WhatsApp", icon: User },
    { id: 2 as const, label: "Mensagem", icon: MessageSquare },
    { id: 3 as const, label: "Lista de Contatos", icon: Users },
    { id: 4 as const, label: "Confirmação", icon: ClipboardCheck },
  ];

  const goNext = () => {
    if (currentStep === 1) {
      if (!actionName.trim()) {
        toast.error("Informe o nome da ação");
        return;
      }
      if (!wabaName.trim()) {
        toast.error("Informe o nome que aparecerá no WhatsApp");
        return;
      }
      if (!wabaDdd.trim()) {
        toast.error("Informe o DDD preferido");
        return;
      }
      if (!wabaPhotoUrl) {
        toast.error("Envie a foto do perfil do WhatsApp");
        return;
      }
    }
    if (currentStep === 2) {
      if (!messageText.trim()) {
        toast.error("O texto da mensagem é obrigatório");
        return;
      }
      if (!dispatchDate) {
        toast.error("A data do disparo é obrigatória");
        return;
      }
      if (!scheduledTime.trim()) {
        toast.error("O horário do disparo é obrigatório");
        return;
      }
      const validBtns = buttons.filter((b) => b.label.trim() && b.link.trim());
      if (validBtns.length === 0) {
        toast.error("Adicione ao menos 1 botão com link");
        return;
      }
    }
    if (currentStep === 3) {
      if (contactListUrls.length === 0) {
        toast.warning("Solicitação sem lista de contatos", {
          description: "A demanda só avança quando a lista for enviada.",
        });
      }
    }
    setCurrentStep((prev) => (prev < 4 ? ((prev + 1) as WizardStep) : prev));
  };
  const goPrev = () => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));

  const handleMediaUpload = async (files: FileList) => {
    const arr = Array.from(files);
    const oversize = arr.find((f) => f.size > MAX_SIZE);
    if (oversize) {
      setFileSizeWarning(
        `O arquivo "${oversize.name}" (${(oversize.size / 1024 / 1024).toFixed(1)}MB) ultrapassa o limite de 20MB. Você pode enviar o arquivo diretamente pelo WhatsApp que nós adicionamos para você.`,
      );
      return;
    }
    setFileSizeWarning(null);
    setUploading("media");
    setMediaUploadError(null);
    setMediaProgress(0);
    try {
      let completedBytes = 0;
      const totalBytes = arr.reduce((s, f) => s + f.size, 0) || 1;
      const perFileLoaded = new Array(arr.length).fill(0);
      const results = await Promise.all(
        arr.map((file, idx) =>
          uploadFile(file, "media", (pct) => {
            perFileLoaded[idx] = (pct / 100) * file.size;
            const loaded = perFileLoaded.reduce((s, v) => s + v, 0) + completedBytes;
            setMediaProgress(Math.min(100, Math.round((loaded / totalBytes) * 100)));
          }).then(
            (r) =>
              ({
                url: r.url,
                storagePath: r.storagePath || "",
                driveFileId: r.driveFileId || "",
                mimeType: r.mimeType || file.type,
                fileName: r.fileName || file.name,
              }) as MediaItem,
          ),
        ),
      );
      setMediaItems((prev) => [...prev, ...results]);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Erro ao enviar arquivo");
      toast.error("Erro ao enviar arquivo", { description: msg });
      setMediaUploadError(msg);
    } finally {
      setUploading(null);
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContactListUpload = async (files: FileList) => {
    setUploading("contacts");
    setContactsUploadError(null);
    setContactsProgress(0);
    try {
      const arr = Array.from(files);
      const totalBytes = arr.reduce((s, f) => s + f.size, 0) || 1;
      const perFileLoaded = new Array(arr.length).fill(0);
      const results = await Promise.all(
        arr.map((file, idx) =>
          uploadFile(file, "contacts", (pct) => {
            perFileLoaded[idx] = (pct / 100) * file.size;
            const loaded = perFileLoaded.reduce((s, v) => s + v, 0);
            setContactsProgress(Math.min(100, Math.round((loaded / totalBytes) * 100)));
          }).then((r) => ({ r, name: file.name })),
        ),
      );
      setContactListUrls((prev) => [...prev, ...results.map((x) => x.r.url)]);
      setContactListNames((prev) => [...prev, ...results.map((x) => x.name)]);
      setContactListPaths((prev) => [...prev, ...results.map((x) => x.r.storagePath)]);
      setContactListDriveIds((prev) => [...prev, ...results.map((x) => x.r.driveFileId || "")]);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "Erro ao enviar arquivo");
      toast.error("Erro ao enviar arquivo", { description: msg });
      setContactsUploadError(msg);
    } finally {
      setUploading(null);
    }
  };

  const removeContactList = (index: number) => {
    setContactListUrls((prev) => prev.filter((_, i) => i !== index));
    setContactListNames((prev) => prev.filter((_, i) => i !== index));
    setContactListPaths((prev) => prev.filter((_, i) => i !== index));
    setContactListDriveIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!messageText.trim()) {
      setError("O texto da mensagem é obrigatório");
      return;
    }
    if (!dispatchDate) {
      setError("A data do disparo é obrigatória");
      return;
    }
    if (!scheduledTime.trim()) {
      setError("O horário do disparo é obrigatório");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const validButtons = buttons.filter((b) => b.label.trim());
      const validButtonsWithLink = validButtons.filter((b) => b.link.trim());
      if (validButtonsWithLink.length === 0) {
        setError("Adicione ao menos 1 botão com link");
        setSubmitting(false);
        return;
      }
      const primaryLink = validButtons.find((b) => b.link.trim())?.link.trim() || "";
      const firstMedia = mediaItems[0];
      const payload = {
        action_name: actionName.trim(),
        waba_profile_name: wabaName.trim(),
        waba_ddd: wabaDdd.trim(),
        waba_profile_photo_url: wabaPhotoUrl,
        waba_profile_photo_drive_id: wabaPhotoDriveId,
        waba_profile_photo_storage_path: wabaPhotoStoragePath,
        message_text: messageText.trim(),
        media_url: firstMedia?.url || "",
        media_storage_path: firstMedia?.storagePath || undefined,
        media_drive_file_id: firstMedia?.driveFileId || undefined,
        media_items: mediaItems,
        offer_link: primaryLink,
        contact_list_url: contactListUrls.join("\n"),
        contact_list_storage_paths: contactListPaths,
        contact_list_drive_file_ids: contactListDriveIds.filter(Boolean),
        scheduled_time: scheduledTime.trim(),
        observations: observations.trim(),
        observations_only: observations.trim(),
        buttons: validButtons.map((b) => ({ label: b.label.trim(), link: b.link.trim() })),
        dispatch_date: dispatchDate ? format(dispatchDate, "yyyy-MM-dd") : undefined,
        test_numbers: formatTestNumbers(testNumbers),
      };
      if (editing) {
        await updateSubmission(editing.id, payload);
        toast.success("Solicitação atualizada");
        onDone?.();
        return;
      }
      await submitDispatch(payload);
      setSuccess(true);
      setActionName("");
      setWabaName("");
      setWabaDdd("");
      setWabaPhotoUrl("");
      setWabaPhotoDriveId("");
      setWabaPhotoStoragePath("");
      setMessageText("");
      setMediaItems([]);
      setContactListUrls([]);
      setContactListNames([]);
      setContactListPaths([]);
      setContactListDriveIds([]);
      setDispatchDate(undefined);
      setScheduledTime("");
      setObservations("");
      setButtons([]);
      setTestNumbers("");
      setFileSizeWarning(null);
      setCurrentStep(1);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
      <div className="space-y-6 min-w-0">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{editing ? "Editar Solicitação" : "Nova Demanda"}</CardTitle>
              {editing && onDone && (
                <Button variant="ghost" size="sm" className="ml-auto" onClick={onDone}>
                  <X className="h-4 w-4 mr-1" /> Cancelar edição
                </Button>
              )}
            </div>
            <CardDescription>
              {editing ? "Ajuste os dados desta solicitação pendente" : "Envie os dados do seu próximo disparo"}
            </CardDescription>
            {!editing && presetSourceName && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <BookmarkPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  Usando o modelo <strong>{presetSourceName}</strong> — ajuste o que precisar e defina data, horário e
                  lista.
                </span>
              </div>
            )}
            {/* Stepper */}
            <div className="flex items-start justify-center gap-0 pt-4 mx-auto w-full max-w-2xl">
              {stepsMeta.map((s, idx) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isDone = currentStep > s.id;
                return (
                  <div key={s.id} className={cn("flex items-start", idx < stepsMeta.length - 1 ? "flex-1" : "")}>
                    <div className="relative flex flex-col items-center gap-1.5 w-24 shrink-0">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors",
                          isActive && "border-primary bg-primary text-primary-foreground",
                          isDone && "border-primary bg-primary/20 text-primary",
                          !isActive && !isDone && "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium text-center",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {idx < stepsMeta.length - 1 && (
                      <div
                        className={cn("h-0.5 flex-1 mt-[18px] mx-1", isDone ? "bg-primary" : "bg-muted-foreground/20")}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ===== STEP 1: WhatsApp Profile ===== */}
            {currentStep === 1 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-4 w-4" /> Nome da ação *
                  </Label>
                  <Input
                    value={actionName}
                    onChange={(e) => {
                      if (!editing) setActionName(e.target.value);
                    }}
                    placeholder="Ex.: Black Friday - Lote 1"
                    maxLength={120}
                    readOnly={!!editing}
                    disabled={!!editing}
                  />
                  {editing && (
                    <p className="text-[11px] text-muted-foreground">
                      O nome da ação só pode ser alterado pelo responsável no consolidado dos relatórios.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <User className="h-4 w-4" /> Nome que aparecerá no WhatsApp *
                    </Label>
                    <Input
                      value={wabaName}
                      onChange={(e) => setWabaName(e.target.value)}
                      placeholder="Ex.: Loja XYZ"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">DDD *</Label>
                    <Input
                      value={wabaDdd}
                      onChange={(e) => setWabaDdd(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      placeholder="11"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Image className="h-4 w-4" /> Foto de perfil do WhatsApp *
                  </Label>
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    {wabaPhotoUrl ? (
                      <img src={wabaPhotoUrl} alt="Foto" className="h-14 w-14 rounded-full object-cover border" />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex gap-2">
                      <input
                        ref={profilePhotoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleProfilePhotoUpload(e.target.files[0])}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => profilePhotoRef.current?.click()}
                        disabled={uploading === "profile-photo"}
                      >
                        {uploading === "profile-photo" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        {wabaPhotoUrl ? "Alterar" : "Enviar foto"}
                      </Button>
                      {wabaPhotoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setWabaPhotoUrl("");
                            setWabaPhotoDriveId("");
                            setWabaPhotoStoragePath("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {photoUploadError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <p className="flex-1 text-destructive/90">
                        <span className="font-medium">Falha ao enviar foto:</span> {photoUploadError}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setPhotoUploadError(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {uploading === "profile-photo" && (
                    <div className="space-y-1">
                      <Progress value={photoProgress} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground">Enviando foto... {photoProgress}%</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Estes dados são usados apenas neste disparo.</p>
                </div>
              </div>
            )}

            {/* ===== STEP 2: Message ===== */}
            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" /> Texto da Mensagem *
                  </Label>
                  <Textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Digite o texto da mensagem..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Image className="h-4 w-4" /> Imagens ou Vídeos da Ação
                  </Label>
                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mediaItems.map((m, i) => (
                        <div
                          key={i}
                          className="relative group rounded-md overflow-hidden border bg-muted/30 aspect-square"
                        >
                          {(() => {
                            const isVid =
                              m.mimeType.startsWith("video/") ||
                              /\.(mp4|webm|mov|m4v|ogv|mkv|avi)(\?|#|$)/i.test(m.fileName || m.url);
                            const thumb = driveThumbnailUrl(m.url, 400);
                            if (m.mimeType.startsWith("image/") || (isVid && thumb)) {
                              return (
                                <>
                                  <img
                                    src={thumb || m.url}
                                    alt={m.fileName}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      const fallback = driveStreamUrl(m.url, "jpg");
                                      if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                                    }}
                                  />
                                  {isVid && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[10px] font-semibold uppercase tracking-wide pointer-events-none">
                                      Vídeo
                                    </span>
                                  )}
                                </>
                              );
                            }
                            return (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="h-8 w-8 text-muted-foreground" />
                              </div>
                            );
                          })()}
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                            {m.fileName}
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-90"
                            onClick={() => removeMedia(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={mediaRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && e.target.files.length > 0 && handleMediaUpload(e.target.files)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => mediaRef.current?.click()}
                    disabled={!!uploading}
                  >
                    {uploading === "media" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {mediaItems.length > 0 ? "Adicionar mais mídias" : "Enviar mídia"}
                  </Button>
                  {uploading === "media" && (
                    <div className="space-y-1">
                      <Progress value={mediaProgress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Enviando mídia... {mediaProgress}%
                      </p>
                    </div>
                  )}
                  {mediaUploadError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-destructive">Falha ao enviar mídia</p>
                        <p className="text-destructive/80">{mediaUploadError}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setMediaUploadError(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {fileSizeWarning && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm text-warning-foreground">
                      <p className="font-medium">Arquivo muito grande</p>
                      <p>{fileSizeWarning}</p>
                      <p className="text-xs mt-1 flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        Use o campo de observações abaixo para nos avisar sobre o envio via WhatsApp.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-6 w-6 p-0"
                      onClick={() => setFileSizeWarning(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <CalendarIcon className="h-4 w-4" /> Data do Disparo *
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dispatchDate ? format(dispatchDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dispatchDate}
                          onSelect={setDispatchDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Horário
                    </Label>
                    <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                  </div>
                </div>

                {dispatchDate && scheduledTime && belowLeadTime && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-warning-foreground">Antecedência curta</p>
                      <p className="text-warning-foreground/90">
                        Recomendamos enviar com pelo menos <strong>3 horas</strong> de antecedência.
                        {leadHours !== null && leadHours >= 0
                          ? ` Faltam apenas ${leadHours.toFixed(1)}h para o horário escolhido — pode não dar tempo de processarmos.`
                          : " O horário escolhido já passou."}
                      </p>
                    </div>
                  </div>
                )}
                {dispatchDate && scheduledTime && !belowLeadTime && leadHours !== null && leadHours < 6 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <p className="text-sm text-warning-foreground">
                      Prazo apertado: faltam {leadHours.toFixed(1)}h. Recomendamos enviar com mais tempo para evitar
                      imprevistos.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MousePointerClick className="h-4 w-4" /> Botões da Mensagem
                    <span className="text-xs text-muted-foreground font-normal">(opcional, máx. 2)</span>
                  </Label>
                  <div className="space-y-2">
                    {buttons.map((b, i) => (
                      <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Select
                            value={b.label || undefined}
                            onValueChange={(val) =>
                              setButtons((prev) => prev.map((v, idx) => (idx === i ? { ...v, label: val } : v)))
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder={`Texto do botão ${i + 1}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {BUTTON_LABEL_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setButtons((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input
                            value={b.link}
                            onChange={(e) =>
                              setButtons((prev) =>
                                prev.map((v, idx) => (idx === i ? { ...v, link: e.target.value } : v)),
                              )
                            }
                            placeholder="Link de redirecionamento (https://...)"
                            className="text-xs"
                          />
                        </div>
                      </div>
                    ))}
                    {buttons.length < 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setButtons((prev) => [...prev, { label: "", link: "" }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Adicionar botão
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ===== STEP 3: Contact List ===== */}
            {currentStep === 3 && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> Lista de Contatos
                  </Label>
                  {contactListUrls.length > 0 && (
                    <div className="space-y-1">
                      {contactListUrls.map((url, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate flex-1" title={contactListNames[i] || `Lista ${i + 1}`}>
                            {contactListNames[i] || `Lista ${i + 1}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeContactList(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={contactRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.txt"
                    className="hidden"
                    multiple
                    onChange={(e) =>
                      e.target.files && e.target.files.length > 0 && handleContactListUpload(e.target.files)
                    }
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => contactRef.current?.click()}
                    disabled={!!uploading}
                  >
                    {uploading === "contacts" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {contactListUrls.length > 0 ? "Adicionar mais listas" : "Enviar lista"}
                  </Button>
                  {uploading === "contacts" && (
                    <div className="space-y-1">
                      <Progress value={contactsProgress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Enviando lista... {contactsProgress}%
                      </p>
                    </div>
                  )}
                  {contactsUploadError && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-destructive">Falha ao enviar lista</p>
                        <p className="text-destructive/80">{contactsUploadError}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setContactsUploadError(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Aceita múltiplos arquivos (CSV, TXT, XLSX).</p>
                  {contactListUrls.length === 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Falta a lista de contatos.</span> O envio é
                        opcional agora, mas a demanda não segue para produção até que a lista seja enviada — você pode
                        anexá-la depois em Minhas Solicitações ou pelo WhatsApp.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> Observações
                  </Label>
                  <Textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Informações extras, avisos sobre envio de mídia via WhatsApp, etc."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4" /> Números de teste
                    <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Textarea
                    value={testNumbers}
                    onChange={(e) => setTestNumbers(e.target.value)}
                    onBlur={() => setTestNumbers((prev) => formatTestNumbers(prev))}
                    placeholder="Um número por linha. Ex: 5511927021663"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Formato 55 + DDD + número (ex.: 5511927021663). Formatamos automaticamente ao sair do campo.
                  </p>
                  {testNumbers.trim() && !testNumbersAreValid(formatTestNumbers(testNumbers)) && (
                    <p className="text-xs text-destructive">
                      Há números fora do padrão 55DDDNUMERO. Revise antes de enviar.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ===== STEP 4: Confirmation ===== */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-3">
                    {wabaPhotoUrl ? (
                      <img src={wabaPhotoUrl} alt="" className="h-12 w-12 rounded-full object-cover border" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{actionName || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {wabaName || "—"} · DDD {wabaDdd || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Data</p>
                      <p>{dispatchDate ? format(dispatchDate, "dd/MM/yyyy", { locale: ptBR }) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Horário</p>
                      <p>{scheduledTime || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Mensagem</p>
                    <div className="rounded bg-background p-2 text-sm whitespace-pre-wrap max-h-40 overflow-auto">
                      {messageText || "—"}
                    </div>
                  </div>
                  {buttons.filter((b) => b.label.trim()).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Botões</p>
                      <ul className="space-y-1">
                        {buttons
                          .filter((b) => b.label.trim())
                          .map((b, i) => (
                            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                {b.label}
                              </span>
                              {b.link.trim() ? (
                                <a
                                  href={b.link.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                  {b.link.trim()}
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">sem link</span>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {mediaItems.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Mídias ({mediaItems.length})</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {mediaItems.map((m, i) => (
                          <div key={i} className="aspect-square rounded overflow-hidden border bg-muted/30">
                            {(() => {
                              const isVid =
                                m.mimeType.startsWith("video/") ||
                                /\.(mp4|webm|mov|m4v|ogv|mkv|avi)(\?|#|$)/i.test(m.fileName || m.url);
                              const thumb = driveThumbnailUrl(m.url, 300);
                              if (m.mimeType.startsWith("image/") || (isVid && thumb)) {
                                return (
                                  <img
                                    src={thumb || m.url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      const fallback = driveStreamUrl(m.url, "jpg");
                                      if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                                    }}
                                  />
                                );
                              }
                              return (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Film className="h-5 w-5 text-muted-foreground" />
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Listas de contatos ({contactListUrls.length})</p>
                    {contactListUrls.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">Nenhuma lista enviada.</span> A demanda ficará
                          aguardando a lista de contatos para seguir.
                        </p>
                      </div>
                    ) : (
                      <ul className="text-sm space-y-0.5">
                        {contactListNames.map((n, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate">{n || `Lista ${i + 1}`}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {observations.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Observações</p>
                      <p className="text-sm whitespace-pre-wrap">{observations}</p>
                    </div>
                  )}
                  {testNumbers.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Números de teste</p>
                      <div className="rounded bg-background p-2 text-sm font-mono whitespace-pre-wrap break-words">
                        {testNumbers}
                      </div>
                    </div>
                  )}
                </div>
                {dispatchDate && scheduledTime && belowLeadTime && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-warning-foreground">Antecedência curta</p>
                      <p className="text-warning-foreground/90">
                        Recomendamos enviar com pelo menos <strong>3 horas</strong> de antecedência.
                        {leadHours !== null && leadHours >= 0
                          ? ` Faltam apenas ${leadHours.toFixed(1)}h — pode não dar tempo de processarmos.`
                          : " O horário escolhido já passou."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Atenção</p>
                  <p>
                    Após a aprovação da solicitação pela nossa equipe, ela não poderá mais ser editada por aqui. Para
                    qualquer alteração posterior, entre em contato pelo WhatsApp.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Revise as informações. Ao enviar, o disparo entra na fila para nossa equipe processar.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/10 text-primary text-sm">
                <CheckCircle2 className="h-4 w-4" /> Disparo enviado com sucesso!
              </div>
            )}

            {/* Wizard navigation */}
            <div className="flex gap-3 pt-2 border-t">
              <Button variant="outline" onClick={goPrev} disabled={currentStep === 1 || submitting} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              {currentStep < 4 ? (
                <Button onClick={goNext} disabled={submitting} className="flex-1">
                  Próximo <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  {editing ? "Salvar alterações" : "Enviar Demanda"}
                </Button>
              )}
            </div>

            {!editing && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setPresetName(presetSourceName || actionName || "");
                  setPresetDialogOpen(true);
                }}
                disabled={submitting || !messageText.trim()}
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Salvar como modelo de demanda
              </Button>
            )}
          </CardContent>
        </Card>

        {submissions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Histórico recente</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y divide-border/50">
                {submissions.slice(historyPage * 5, historyPage * 5 + 5).map((s) => {
                  const statusMeta = getSubmissionStatusMeta(s);
                  return (
                    <li key={s.id} className="flex items-center justify-between py-2 text-sm gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">
                          {(s.action_name && s.action_name.trim()) ||
                            (s.message_text ? s.message_text.slice(0, 60) : "(sem nome da ação)")}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}{" "}
                          {new Date(s.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {submissions.length > 5 && (
                <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
                  <span>
                    Página {historyPage + 1} de {Math.ceil(submissions.length / 5)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                      disabled={historyPage === 0}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setHistoryPage((p) => Math.min(Math.ceil(submissions.length / 5) - 1, p + 1))}
                      disabled={historyPage >= Math.ceil(submissions.length / 5) - 1}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:sticky lg:top-4">
        <WhatsAppPreview
          senderName={wabaName || ""}
          senderPhoto={wabaPhotoUrl}
          messageText={messageText}
          mediaUrl={mediaItems[0]?.url || ""}
          mediaMimeType={mediaItems[0]?.mimeType || ""}
          mediaFileName={mediaItems[0]?.fileName || ""}
          scheduledTime={scheduledTime}
          buttons={buttons}
        />
      </div>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar modelo de demanda</DialogTitle>
            <DialogDescription>
              O conteúdo (perfil, mensagem, mídias, botões e observações) fica salvo para reutilizar. Data, horário e
              lista de contatos são definidos a cada envio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Nome do modelo</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Ex.: Oferta consignado - padrão"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preset-desc">Descrição (opcional)</Label>
              <Textarea
                id="preset-desc"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                rows={2}
                placeholder="Quando usar este modelo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)} disabled={savingPreset}>
              Cancelar
            </Button>
            <Button onClick={handleSavePreset} disabled={savingPreset}>
              {savingPreset ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <BookmarkPlus className="h-4 w-4 mr-2" />
              )}
              Salvar modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
