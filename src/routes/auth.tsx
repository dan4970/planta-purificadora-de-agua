import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Droplets, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar — AquaMant" },
      {
        name: "description",
        content: "Acceso al CRM de mantenimiento de la planta purificadora de agua.",
      },
      { property: "og:title", content: "Ingresar — AquaMant" },
      { property: "og:description", content: "Acceso para administradores, supervisores y técnicos." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/panel", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("No pudimos ingresar", { description: error.message });
      return;
    }
    navigate({ to: "/panel", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/panel`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos crear la cuenta", { description: error.message });
      return;
    }
    if (data.session) {
      navigate({ to: "/panel", replace: true });
    } else {
      toast.success("Cuenta creada", {
        description: "Revisá tu correo para confirmar la dirección y después ingresá.",
      });
    }
  }

  async function google() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("No pudimos usar Google", { description: String(result.error) });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/panel", replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <Card className="relative w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Droplets className="h-6 w-6 text-primary" />
            <span className="text-display text-xl font-semibold">AquaMant</span>
          </div>
          <CardTitle className="pt-3 text-2xl">Acceso al sistema</CardTitle>
          <CardDescription>
            CRM de mantenimiento de la planta purificadora. El primer usuario registrado queda como
            administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ingresar">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ingresar">Ingresar</TabsTrigger>
              <TabsTrigger value="registro">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="ingresar">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@planta.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ingresar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="registro">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre y apellido</Label>
                  <Input
                    id="name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Daniel Vega"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email2">Correo</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password2">Contraseña</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google} disabled={loading}>
            Continuar con Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
