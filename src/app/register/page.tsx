import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { enabledProviders } from "@/lib/oauth";

// read env per request so new oauth credentials show up without a rebuild
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense>
      <AuthForm mode="register" providers={enabledProviders()} />
    </Suspense>
  );
}
