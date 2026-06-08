import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Sidebar from "@/components/Sidebar";
import IdentitySync from "@/components/IdentitySync";
import FaviconUpdater from "@/components/FaviconUpdater";
import { fetchOnboardingStatus } from "@/lib/server-api";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // New, empty workspace → send the user through the onboarding wizard first.
  // Platform admins bypass it: they operate the install (manage workspaces at /admin)
  // and shouldn't be forced through the tenant onboarding before reaching the app shell.
  // (If the backend is unreachable, fall through and let the page surface the error.)
  // Note: redirect() throws NEXT_REDIRECT, so it must run outside the try/catch.
  const session = await getServerSession(authOptions);
  let needsOnboarding = false;
  try {
    needsOnboarding = (await fetchOnboardingStatus()).needs_onboarding;
  } catch {
    /* backend down — don't block the app shell */
  }
  if (needsOnboarding && !session?.user?.is_admin) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <IdentitySync />
      <FaviconUpdater />
      <main className="flex-1 min-h-0 overflow-y-auto bg-white">
        <div className="px-8 py-6 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
