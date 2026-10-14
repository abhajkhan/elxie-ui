"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BluetoothConnectionGate from "@/components/BluetoothConnectionGate";
import BluetoothNotificationBanner from "@/components/BluetoothNotificationBanner";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  const isAuthPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isFirmwarePage = pathname.startsWith("/settings/firmware");
  // Blocks is a full-screen editor with its own back button and connect flow.
  const isBlocksPage = pathname.startsWith("/playground/blocks");
  const showAppComponents = Boolean(isSignedIn && !isAuthPage && !isFirmwarePage && !isBlocksPage);

  return (
    <>
      {showAppComponents && (
        <>
          <AppHeader />
          <BluetoothNotificationBanner />
          <BluetoothConnectionGate />
        </>
      )}

      <div
        className={
          showAppComponents
            ? "pt-[env(safe-area-inset-top,0px)] pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
            : ""
        }
      >
        {children}
      </div>

      {showAppComponents && <BottomNav />}
    </>
  );
}
