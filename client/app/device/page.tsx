"use client";
import { authClient } from "@/lib/auth-client";
import type React from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
const DevicePage = () => {
  const [userCode, setUserCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const formattedCode = userCode.trim().replace(/-/g, "").toUpperCase();
      const response = await authClient.device({
        query: { user_code: formattedCode },
      });
      if (response.data) {
        router.push(`/aprove?user_code=${formattedCode}`);
      }
    } catch (error) {
      setError("Codigo invalido o ya expiro");
    } finally {
      setIsLoading(false);
    }
  };
  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length > 4) {
      value = value.slice(0, 4) + "-" + value.slice(4, 8);
    }
    setUserCode(value);
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="p-3 rounded-lg border-2 border-dashed border-zinc-700">
            <ShieldAlert className="w-8 h-8 text-yellow-300" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Autorizacion de dispositivo
            </h1>
            <p className="text-muted-foreground">
              Ingresa el codigo de dispositivo para continuar
            </p>
          </div>
        </div>
        <form
          className="border-2 border-dashed border-zinc-700 rounded-xl p-8 bg-zinc-950 backdrop-blur-sm"
          onSubmit={handleSubmit}
        >
          <div className="space-y-6">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Codigo de dispositivo{" "}
            </label>
            <input
              id="code"
              type="text"
              value={userCode}
              onChange={handleOnChange}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className="w-full px-4 py-3 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-zync-600 font-mono text-center text-lg tracking-widest"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Obten tu codigo de autorizacion del dispositivo en el que te
              quieras conectar
            </p>
            {error && (
              <div className="p-3 rounded-lg bg-red-950 border border-red-900 text-red-200 text-sm">
                {error}
              </div>
            )}
            <button className="w-full py-3 px-4 bg-zinc-100 text-zinc-950 font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {isLoading ? "Verificando..." : "Continuar"}
            </button>
            <div className="p-4 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este codigo es unico para tu dispositivo y expirara pronto. Toma
                en cuenta que es confidencial y no debes de compartir a nadie
                este codigo.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DevicePage;
