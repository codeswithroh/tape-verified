import { Providers } from "@/components/Providers";
import { Shell } from "@/components/app/Shell";

export const metadata = { title: "Tape — app" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Shell>{children}</Shell>
    </Providers>
  );
}
