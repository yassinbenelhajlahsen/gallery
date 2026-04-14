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
    <section className="w-full">
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        <div
          className={`space-y-6 transition-all duration-400 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <header>
            <h1 className="font-display text-5xl leading-tight text-[#222]">
              Admin
            </h1>
          </header>

          <div className="flex border-b border-[#E0E0E0]">
            <button
              type="button"
              onClick={() => selectTab("upload")}
              className={`cursor-pointer border-b-2 -mb-px px-5 pb-3 pt-1 text-sm font-semibold transition-colors duration-150 touch-manipulation active:opacity-60 ${
                activeTab === "upload"
                  ? "border-[#222] text-[#222]"
                  : "border-transparent text-[#999] hover:text-[#222]"
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => selectTab("delete")}
              className={`cursor-pointer border-b-2 -mb-px px-5 pb-3 pt-1 text-sm font-semibold transition-colors duration-150 touch-manipulation active:opacity-60 ${
                activeTab === "delete"
                  ? "border-[#741d1d] text-[#741d1d]"
                  : "border-transparent text-[#999] hover:text-[#741d1d]"
              }`}
            >
              Delete
            </button>
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
