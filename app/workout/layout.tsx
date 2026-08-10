import { AuthGate } from "@/components/auth/auth-gate";

export default function WorkoutLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthGate>{children}</AuthGate>;
}
