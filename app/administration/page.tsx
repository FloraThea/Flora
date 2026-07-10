import { notFound } from "next/navigation";
import { FloraAppShell } from "@/components/ui/FloraAppShell";
import { isAdministrationEnabled } from "@/lib/env/admin-access";
import { AdministrationPage } from "./components/AdministrationPage";

export default function AdministrationRoutePage() {
  if (!isAdministrationEnabled()) {
    notFound();
  }

  return (
    <FloraAppShell>
      <AdministrationPage />
    </FloraAppShell>
  );
}
