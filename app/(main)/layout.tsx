import { AuthGate } from "@/components/auth/auth-gate";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default function MainLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <main className="app-shell">
        <div className="top-bar">
          <span>Mamma Moves</span>
          <SignOutButton />
        </div>
        {children}
      </main>
      <BottomNav />
    </AuthGate>
  );
}
