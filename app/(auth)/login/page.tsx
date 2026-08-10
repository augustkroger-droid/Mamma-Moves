import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-card surface">Hämtar Mamma Moves...</div>}>
      <AuthForm />
    </Suspense>
  );
}
