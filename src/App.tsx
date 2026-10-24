import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/pages/Login";
import PartnerDashboard from "@/pages/PartnerDashboard";
import ClientHome from "@/pages/ClientHome";
import NotFound from "@/pages/NotFound";

// Rotas reservadas que não podem colidir com o slug de um parceiro (mesma
// denylist usada na criação do parceiro, em vss-disparos-manager/src/pages/Parceiros.tsx).
const RESERVED = new Set(["admin", "api", "static", "assets", "login"]);

function SlugRoutes() {
  return (
    <Routes>
      <Route path=":slug/login" element={<Login />} />
      <Route path=":slug/admin" element={<PartnerDashboard />} />
      <Route path=":slug" element={<ClientHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
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
