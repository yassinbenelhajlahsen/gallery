import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageReveal } from "../hooks/usePageReveal";
import UploadTab from "../components/admin/UploadTab";
import DeleteTab from "../components/admin/DeleteTab";

type AdminTab = "upload" | "delete";

const getTabFromParams = (tabParam: string | null): AdminTab =>
  tabParam === "delete" ? "delete" : "upload";

export default function AdminPage() {
  const isVisible = usePageReveal();
  const [searchParams, setSearchParams] = useSearchParams();
  const uploadPanelRef = useRef<HTMLDivElement | null>(null);
  const deletePanelRef = useRef<HTMLDivElement | null>(null);
  const [panelHeight, setPanelHeight] = useState<number>(0);

  const activeTab = useMemo<AdminTab>(
    () => getTabFromParams(searchParams.get("tab")),
    [searchParams],
  );
  const [loadedTabs, setLoadedTabs] = useState<Record<AdminTab, boolean>>({
    upload: activeTab === "upload",
    delete: activeTab === "delete",
  });

  const selectTab = (tab: AdminTab) => {
    setLoadedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const activePanel =
      activeTab === "upload" ? uploadPanelRef.current : deletePanelRef.current;
    if (!activePanel) return;
    setPanelHeight(activePanel.scrollHeight);
  }, [activeTab]);

  useEffect(() => {
    const uploadPanel = uploadPanelRef.current;
    const deletePanel = deletePanelRef.current;
    if (!uploadPanel || !deletePanel || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      const activePanel =
        activeTab === "upload"
          ? uploadPanelRef.current
          : deletePanelRef.current;
      if (!activePanel) return;
      setPanelHeight(activePanel.scrollHeight);
    });

    observer.observe(uploadPanel);
    observer.observe(deletePanel);
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <section className="flex w-full justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6 rounded-4xl bg-white/90 p-6 shadow-[0_35px_120px_rgba(248,180,196,0.25)] ring-1 ring-white/60 backdrop-blur-2xl sm:p-8">
        <div
          className={`space-y-6 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header className="space-y-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#2f2f2f]/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em] text-white">
              Admin
            </span>
            <h1 className="text-3xl font-bold text-[#333]">Admin Controls</h1>
          </header>

          <div className="mx-auto w-full max-w-xl rounded-2xl border border-[#ececec] bg-[#f3f3f3] p-1.5 shadow-inner shadow-white/70">
            <div className="relative grid grid-cols-2">
              <div
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1/2 rounded-xl bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out motion-reduce:transition-none ${
                  activeTab === "upload" ? "translate-x-0" : "translate-x-full"
                }`}
              />
              <button
                type="button"
                onClick={() => selectTab("upload")}
                className={`relative z-10 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  activeTab === "upload"
                    ? "text-[#1f1f1f]"
                    : "text-[#6d6d6d] hover:text-[#2d2d2d]"
                }`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => selectTab("delete")}
                className={`relative z-10 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  activeTab === "delete"
                    ? "text-[#741d1d]"
                    : "text-[#6d6d6d] hover:text-[#741d1d]"
                }`}
              >
                Delete
              </button>
            </div>
          </div>

          <div
            className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
            style={{ height: panelHeight > 0 ? `${panelHeight}px` : undefined }}
          >
            <div className="relative">
              <div
                ref={uploadPanelRef}
                className={`w-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                  activeTab === "upload"
                    ? "relative translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 -translate-x-full opacity-0"
                }`}
              >
                {loadedTabs.upload || activeTab === "upload" ? (
                  <UploadTab />
                ) : null}
              </div>
              <div
                ref={deletePanelRef}
                className={`w-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                  activeTab === "delete"
                    ? "relative translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 translate-x-full opacity-0"
                }`}
              >
                {loadedTabs.delete || activeTab === "delete" ? (
                  <DeleteTab />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
