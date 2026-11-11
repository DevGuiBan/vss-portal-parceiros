import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

// Cada área é um chunk separado: o parceiro não baixa o formulário de
// demanda do cliente (e vice-versa), e o login carrega o mínimo possível.
const Login = lazy(() => import("@/pages/Login"));
const PartnerDashboard = lazy(() => import("@/pages/PartnerDashboard"));
const ClientHome = lazy(() => import("@/pages/ClientHome"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Rotas reservadas que não podem colidir com o slug de um parceiro (mesma
// denylist usada na criação do parceiro, em vss-disparos-manager/src/pages/Parceiros.tsx).
const RESERVED = new Set(["admin", "api", "static", "assets", "login"]);

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );
}

function SlugRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path=":slug/login" element={<Login />} />
        <Route path=":slug/admin" element={<PartnerDashboard />} />
        <Route path=":slug" element={<ClientHome />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <SlugRoutes />
    </BrowserRouter>
  );
}

export { RESERVED as RESERVED_SLUGS };
