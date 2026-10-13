"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Monitor, Usb } from "lucide-react";

const FIRMWARE_UPDATER_URL = "https://asnasb.github.io/elxie-web-flasher/";

export default function FirmwarePage() {
  const [deviceType, setDeviceType] = useState<"checking" | "mobile" | "desktop">("checking");

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|iPhone|iPod|iPad|Mobile|Windows Phone|IEMobile/i.test(userAgent);
    setDeviceType(isMobile ? "mobile" : "desktop");
  }, []);

  if (deviceType === "checking") {
    return <main className="fixed inset-0 z-[60] bg-background" aria-label="Loading firmware updater" />;
  }

  if (deviceType === "mobile") {
    return (
      <main className="fixed inset-0 z-[60] flex items-center justify-center bg-background px-6 py-10">
        <section className="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Monitor size={27} />
          </div>
          <h1 className="mt-5 text-xl font-black tracking-tight">Use a desktop to update firmware</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Firmware updates require a USB connection to your robot. Open the firmware updater on a desktop computer with the robot connected by USB.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-black/20 px-3 py-2.5 text-xs font-medium text-white/50">
            <Usb size={15} />
            USB connection required
          </div>
          <Link
            href="/settings"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary/90"
          >
            <ArrowLeft size={17} />
            Return to the app
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[60] bg-background">
      <iframe
        src={FIRMWARE_UPDATER_URL}
        title="Elxie firmware updater"
        className="absolute inset-0 h-full w-full border-0 bg-white"
        allow="serial; usb"
      />
      <Link
        href="/settings"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/75 px-3 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-black/90"
      >
        <ArrowLeft size={17} />
        Return to app
      </Link>
    </main>
  );
}
