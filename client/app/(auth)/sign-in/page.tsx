"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SignInPage = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  useEffect(() => {
    if (data?.session && data?.user) {
      router.push("/");
    }
  }, [data, router]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <LoginForm />
    </div>
  );
};

export default SignInPage;
