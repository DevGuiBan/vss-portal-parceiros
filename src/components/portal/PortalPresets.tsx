import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { usePortal } from "@/hooks/usePortal";
import type { DemandPreset } from "@/contexts/PortalContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { BookmarkPlus, Loader2, Search, Send, Trash2, Image as ImageIcon, MousePointerClick } from "lucide-react";

export function PortalPresets({
  token,
  onUse,
}: {
  token: string | null;
  onUse: (preset: DemandPreset) => void;
}) {
  const { listPresets, deletePreset } = usePortal(token);
  const [presets, setPresets] = useState<DemandPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DemandPreset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPresets(await listPresets());
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [listPresets]);

  useEffect(() => { load(); }, [load]);

  const filtered = presets.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      String(p.payload?.message_text || "").toLowerCase().includes(q)
    );
  });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deletePreset(pendingDelete.id);
      setPresets((prev) => prev.filter((p) => p.id !== pendingDelete.id));
      toast.success("Modelo removido");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-primary" />
            Modelos de Demanda
          </CardTitle>
          <CardDescription>
            Demandas pré-fixas prontas para reutilizar. Escolha um modelo, ajuste o que precisar e
            defina a data, o horário e a lista de contatos antes de enviar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar modelo"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <p className="text-sm font-medium">Nenhum modelo salvo</p>
            <p className="text-xs text-muted-foreground">
              Monte um disparo em "Nova Demanda" e use "Salvar como modelo de demanda".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((p) => {
            const media = Array.isArray(p.payload?.media_items) ? p.payload.media_items.length : 0;
            const btns = Array.isArray(p.payload?.buttons) ? p.payload.buttons.length : 0;
            return (
              <Card key={p.id} className="flex flex-col hover:border-primary/40 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                  {p.description && (
                    <CardDescription className="text-xs line-clamp-2">{p.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                  <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                    {String(p.payload?.message_text || "Sem texto salvo")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.payload?.waba_profile_name && (
                      <Badge variant="secondary" className="text-[10px]">{p.payload.waba_profile_name}</Badge>
                    )}
                    {media > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ImageIcon className="h-3 w-3" /> {media}
                      </Badge>
                    )}
                    {btns > 0 && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <MousePointerClick className="h-3 w-3" /> {btns}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button size="sm" className="flex-1" onClick={() => onUse(p)}>
                      <Send className="h-3.5 w-3.5 mr-1.5" /> Usar modelo
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setPendingDelete(p)}
                      title="Excluir modelo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo "{pendingDelete?.name}" será removido definitivamente. Demandas já enviadas não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
