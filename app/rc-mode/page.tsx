"use client";

import SubPageHeader from "@/components/SubPageHeader";
import ControlPanel from "@/components/ControlPanel";

export default function RcModePage() {
  return (
    // AppShell pads content by the bottom nav (5rem) plus the safe-area insets.
    <main className="h-[calc(100dvh-5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-hidden bg-background">
      <SubPageHeader
        title="RC Mode"
        subtitle="Free Ride"
        backHref="/"
      />

      <div className="mx-auto flex h-full max-w-md flex-col px-4 pb-2 pt-20">
        <ControlPanel mode="free-ride" />
      </div>
    </main>
  );
}