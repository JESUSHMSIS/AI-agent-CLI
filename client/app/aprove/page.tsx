"use client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle, XCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

const AprovePage = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userCode = searchParams.get("user_code");
  const [isProccesing, setIsProccesing] = useState({
    approve: false,
    deny: false,
  });
  const handleAprove = async () => {
    setIsProccesing({
      approve: true,
      deny: false,
    });
    try {
      toast.loading("Aprobando dispositivo...", { id: "loading" });
      await authClient.device.approve({
        userCode: userCode!,
      });
      toast.dismiss("loading");
      toast.success("Dispositivo aprobado correctamente");
      router.push("/");
    } catch (error) {
      toast.error("Error al aprobar el dispositivo");
      console.log("hubo un erros al aprobar el dispositivo", error);
    } finally {
      setIsProccesing({
        approve: false,
        deny: false,
      });
    }
  };
  const hadleDeny = async () => {
    setIsProccesing({
      approve: false,
      deny: true,
    });
    try {
      toast.loading("Denegando dispositivo...", { id: "deny" });
      await authClient.device.deny({
        userCode: userCode!,
      });
      toast.dismiss("Denegado");
      toast.success("Dispositivo no denegado correctamente");
      router.push("/");
    } catch (error) {
      toast.error("Fallo el denegar el dispositivo");
    }
    setIsProccesing({
      approve: false,
      deny: false,
    });
  };
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background">
        <Spinner />
      </div>
    );
  }
  if (!data?.session && !data?.user) {
    router.push("/sign-in");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background font-sans">
      <div className="w-full max-w-md px-4">
        <div className="space-y-8">
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 bg-zinc-900/50 backdrop-blur-sm text-center">
            <div className="flex justify-center mb-6">
              <div className="relative ">
                <div className="w-24 rounded-2xl border-2 border-dashed border-zinc-600 bg-zinc-800 flex items-center justify-center">
                  <Smartphone className="h-12 w-12 text-cyan-400" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full border-2 border-zinc-900 flex items-center justify-center">
                  <span className="text-xs text-white font-bold">!</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-zinc-50">
                Autorizacion de dispositivo
              </h1>
              <p className="text-sm text-zinc-400">
                Una nueva solicitud de acceso a tu cuenta
              </p>
            </div>
          </div>
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-6 bg-zinc-900/50 backdrop-blur-sm space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Codigo de Autorizacion
              </p>
              <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700">
                <p className="text-xl font-mono font-bold text-cyan-400 text-center tracking-widest">
                  {userCode || "---"}
                </p>
              </div>
              <p className="text-xs text-zinc-600 text-center">
                Copia este codigo en el dispositivo que lo solicito
              </p>
            </div>
          </div>
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-6 bg-zinc-900/50 backdrop-blur-sm">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                Cuenta: {data?.user.email}
              </p>
              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
                <p className="text-sm text-zinc-300">
                  Solo aprueba la peticion si tu la hiciste, por seguridad no
                  compartas este codigo
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              onClick={handleAprove}
              disabled={isProccesing.approve}
              className=" w-full h-11 bg-emerald-400 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
            >
              {isProccesing.approve ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span>En proceso..</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Aprobar dispositivo</span>
                </>
              )}
            </Button>
            <Button
              onClick={hadleDeny}
              disabled={isProccesing.deny}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isProccesing.deny ? (
                <>
                  <Spinner className="w-4 h-4" />
                  <span className="">Cancelando...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  <span>Denegar dispositivo</span>
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px border-t border-dashed border-zinc-700"></div>
            <span className="text-xs text-zinc-600">Elige uno</span>
            <div className="flex-1 h-px border-t border-dashed border-zinc-700"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AprovePage;
