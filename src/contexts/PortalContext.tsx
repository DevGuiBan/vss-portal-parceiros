import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/integrations/supabase/client";

interface ClientProfile {
  id: string;
  name: string;
  whatsapp_name: string;
  profile_photo_url: string;
  preferred_ddd: string;
  profile_configured: boolean;
  default_copy?: string;
}

interface Submission {
  id: string;
  message_text: string;
  media_url: string;
  offer_link: string;
  contact_list_url: string;
  status: string;
  created_at: string;
  scheduled_time?: string;
  dispatch_date?: string | null;
  dispatch_id?: string | null;
  action_name?: string | null;
  demand_status?: string | null;
  demand_id?: string | null;
}

export interface PortalDispatch {
  id: string;
  date: string;
  scheduled_time: string;
  status: string;
  copy: string;
  quantity: number;
  sale_price: number;
  credit_used: number;
  executed_at: string | null;
  created_at: string;
  contact_list_url: string;
  creative_url: string;
  link: string;
}

export interface PortalReport {
  id: string;
  dispatch_id: string;
  quantity_sent: number;
  delivered: number;
  failures: number;
  delivery_rate: number;
  view_rate: number;
  date: string;
}

export interface PortalManualReport {
  id: string;
  client_id: string | null;
  client_name: string;
  name?: string | null;
  date: string;
  sent: number;
  delivered: number;
  failures?: number;
  delivery_rate?: number;
  demand_id?: string | null;
  unit_price?: number | null;
  saved_at: string;
}

export interface PortalOverview {
  credit_balance: number;
  submissions: Submission[];
  dispatches: PortalDispatch[];
  reports: PortalReport[];
  manual_reports?: PortalManualReport[];
}

export interface ResponsibleInfo {
  id: string;
  name: string;
  email: string | null;
}

interface PortalContextValue {
  token: string | null;
  profile: ClientProfile | null;
  responsible: ResponsibleInfo | null;
  submissions: Submission[];
  overview: PortalOverview | null;
  loading: boolean;
  error: string | null;
  switching: boolean;
  updateProfile: (data: { whatsapp_name: string; profile_photo_url: string; preferred_ddd: string }) => Promise<void>;
  submitDispatch: (data: any) => Promise<void>;
  updateSubmission: (id: string, data: any) => Promise<void>;
  loadOverview: () => Promise<void>;
  uploadFile: (file: File, prefix: string, onProgress?: (pct: number) => void) => Promise<UploadResult>;
  requestChange: (submissionId: string, message: string) => Promise<void>;
  deleteSubmission: (id: string) => Promise<void>;
  listPresets: () => Promise<DemandPreset[]>;
  savePreset: (data: { id?: string; name: string; description?: string; payload: any }) => Promise<DemandPreset>;
  deletePreset: (id: string) => Promise<void>;
}

export interface DemandPreset {
  id: string;
  name: string;
  description: string;
  payload: any;
  updated_at: string;
}

export interface UploadResult {
  url: string;
  storagePath: string;
  bucket: string;
  mimeType: string;
  fileName: string;
  driveFileId?: string;
  driveWebViewLink?: string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

/**
 * Versão enxuta de PortalContext.tsx (vss-disparos-manager) para o portal
 * do cliente final white-label: só modo autenticado, um único responsible
 * (sem troca de carteira — cada cliente final tem exatamente um). O
 * `responsible_id_for_user` e o `portal-api` são os mesmos do app admin.
 */
export function PortalProvider({ children }: { children: ReactNode }) {
  const token: string | null = null;
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [responsible, setResponsible] = useState<ResponsibleInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-api`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const buildAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { apikey };
    let access: string | undefined;
    const { data } = await supabase.auth.getSession();
    access = data.session?.access_token;
    if (!access) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      access = refreshed.session?.access_token;
    }
    if (access) headers["Authorization"] = `Bearer ${access}`;
    return headers;
  }, [apikey]);

  const callApi = useCallback(async (action: string, body?: any) => {
    const url = `${baseUrl}?${new URLSearchParams({ action })}`;
    let res: Response;
    const authHeaders = await buildAuthHeaders();
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body || {}),
      });
    } catch {
      throw new Error("Erro de conexão. Verifique sua internet.");
    }
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new Error("Resposta inválida do servidor.");
    }
    if (!res.ok) throw new Error(json.error || "Erro desconhecido");
    return json;
  }, [baseUrl, buildAuthHeaders]);

  const uploadFile = useCallback(async (file: File, prefix: string, onProgress?: (pct: number) => void): Promise<UploadResult> => {
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo permitido: 20MB.`);
    }
    const url = `${baseUrl}?${new URLSearchParams({ action: "upload-file" })}`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("prefix", prefix);
    const authHeaders = await buildAuthHeaders();
    const json: any = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      for (const [k, v] of Object.entries(authHeaders)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };
      xhr.onload = () => {
        let parsed: any;
        try { parsed = JSON.parse(xhr.responseText); }
        catch { return reject(new Error("O servidor não respondeu corretamente. O arquivo pode ser muito grande — tente um menor.")); }
        if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(parsed.error || "Erro no upload"));
        resolve(parsed);
      };
      xhr.onerror = () => reject(new Error("Erro de conexão. Verifique sua internet e tente novamente."));
      xhr.send(formData);
    });
    return {
      url: json.url,
      storagePath: json.storagePath || "",
      bucket: json.bucket || "client-uploads",
      mimeType: json.mimeType || file.type,
      fileName: json.fileName || file.name,
      driveFileId: json.driveFileId || undefined,
      driveWebViewLink: json.driveWebViewLink || undefined,
    };
  }, [baseUrl, buildAuthHeaders]);

  const loadProfileAndOverview = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    try {
      setError(null);
      if (!loadedOnceRef.current) setLoading(true);
      else setSwitching(true);
      const [profileData, ov] = await Promise.all([
        callApi("get-profile"),
        callApi("get-overview").catch(() => null),
      ]);
      if (reqId !== requestIdRef.current) return;
      loadedOnceRef.current = true;
      setProfile(profileData);
      if (ov) {
        setOverview(ov);
        setSubmissions(Array.isArray(ov.submissions) ? ov.submissions : []);
      } else {
        setOverview(null);
        setSubmissions([]);
      }
    } catch (e: unknown) {
      if (reqId !== requestIdRef.current) return;
      setError(getErrorMessage(e));
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false);
        setSwitching(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callApi]);

  const loadOverview = useCallback(async () => {
    try {
      const data = await callApi("get-overview");
      setOverview(data);
      if (Array.isArray(data?.submissions)) setSubmissions(data.submissions);
    } catch (e) {
      console.error(e);
    }
  }, [callApi]);

  useEffect(() => {
    loadProfileAndOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime + polling: reflete qualquer mudança de status feita pelos
  // administradores no painel de Envios (daily_demands).
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { loadOverview(); }, 400);
    };
    const channel = supabase
      .channel("portal-daily-demands")
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_demands" }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "client_submissions" }, scheduleRefresh)
      .subscribe();
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") loadOverview();
    }, 180000);
    let lastHiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
        return;
      }
      if (Date.now() - lastHiddenAt > 10000) loadOverview();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.clearInterval(pollId);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [loadOverview]);

  // Carrega o responsável vinculado ao usuário logado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data: respId } = await supabase.rpc("responsible_id_for_user", { _uid: uid });
      if (cancelled) return;
      if (respId) {
        const { data } = await supabase
          .from("responsibles")
          .select("id, name, email")
          .eq("id", respId as string)
          .maybeSingle();
        if (!cancelled && data) setResponsible(data as ResponsibleInfo);
        return;
      }
      const { data } = await supabase
        .from("responsibles")
        .select("id, name, email")
        .eq("auth_user_id", uid)
        .maybeSingle();
      if (!cancelled && data) setResponsible(data as ResponsibleInfo);
    })();
    return () => { cancelled = true; };
  }, []);

  const updateProfile = async (data: { whatsapp_name: string; profile_photo_url: string; preferred_ddd: string }) => {
    await callApi("update-profile", data);
    await loadProfileAndOverview();
  };

  const submitDispatch = async (data: any) => {
    await callApi("submit", data);
    await loadOverview();
  };

  const updateSubmission = async (id: string, data: any) => {
    await callApi("update-submission", { id, ...data });
    await loadOverview();
  };

  const requestChange = async (submissionId: string, message: string) => {
    await callApi("request-change", { submissionId, message });
    await loadOverview();
  };

  const deleteSubmission = async (id: string) => {
    await callApi("delete-submission", { id });
    await loadOverview();
  };

  const listPresets = useCallback(async (): Promise<DemandPreset[]> => {
    const res = await callApi("list-presets");
    return Array.isArray(res) ? (res as DemandPreset[]) : [];
  }, [callApi]);

  const savePreset = useCallback(
    async (data: { id?: string; name: string; description?: string; payload: any }): Promise<DemandPreset> =>
      (await callApi("save-preset", data)) as DemandPreset,
    [callApi],
  );

  const deletePreset = useCallback(async (id: string) => { await callApi("delete-preset", { id }); }, [callApi]);

  const value = useMemo<PortalContextValue>(() => ({
    token, profile, responsible, submissions, overview, loading, error, switching,
    updateProfile, submitDispatch, updateSubmission, loadOverview, uploadFile,
    requestChange, deleteSubmission,
    listPresets, savePreset, deletePreset,
  }), [token, profile, responsible, submissions, overview, loading, error, switching, loadOverview, uploadFile, listPresets, savePreset, deletePreset]);

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalContext() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortalContext must be used inside PortalProvider");
  return ctx;
}
