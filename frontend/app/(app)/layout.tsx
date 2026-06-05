import Sidebar from "@/components/Sidebar";
import IdentitySync from "@/components/IdentitySync";
import FaviconUpdater from "@/components/FaviconUpdater";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
