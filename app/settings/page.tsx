"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Bluetooth,
  ChevronRight,
  CircleHelp,
  Cpu,
  LoaderCircle,
  LogOut,
  Unplug,
  User as UserIcon,
} from "lucide-react";
import Image from "next/image";

import { useBleContext } from "@/context/BleContext";
import { clearAllLocalProgress } from "@/lib/progressStore";

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { status, deviceInfo, connect, disconnect } = useBleContext();
  const isConnecting = status === "connecting";
  const isConnected = status === "connected";
  const primaryEmail =
    user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)
      ?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "No email address";

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-24">
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-accent">
          Preferences
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">Settings</h1>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-3 p-4">
          {user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={user.fullName ?? "User avatar"}
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl border border-primary/30 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary">
              <UserIcon size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {user?.fullName ?? user?.username ?? "Authenticated User"}
            </p>
            <p className="truncate text-xs text-white/45">{primaryEmail}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              clearAllLocalProgress();
              void signOut();
            }}
            className="rounded-lg p-2 text-white/50 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={17} />
          </button>
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Bluetooth size={18} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Robot connection</p>
              <p className="truncate text-xs text-white/45">
                {isConnecting
                  ? "Searching for robot…"
                  : isConnected
                    ? `${deviceInfo?.name ?? "Robot"} · ${deviceInfo?.model ?? "Connected"}`
                    : "Not connected"}
              </p>
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isConnected ? "bg-success" : isConnecting ? "animate-pulse bg-warning" : "bg-white/20"
              }`}
              aria-label={isConnected ? "Connected" : "Disconnected"}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (isConnected) disconnect();
              else void connect().catch((error: unknown) => console.error("[SETTINGS] Connect failed", error));
            }}
            disabled={isConnecting}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-white/10 disabled:opacity-50"
          >
            {isConnecting ? (
              <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" />Searching…</span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-2"><Unplug size={14} />Disconnect</span>
            ) : (
              <span className="inline-flex items-center gap-2"><Bluetooth size={14} />Connect robot</span>
            )}
          </button>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        <Link
          href="/settings/firmware"
          className="flex items-center gap-3 p-4 transition hover:bg-white/[0.03]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Cpu size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Update firmware</span>
            <span className="mt-0.5 block text-xs text-white/45">
              {deviceInfo?.firmware ? `Installed: ${deviceInfo.firmware}` : "Open the firmware updater"}
            </span>
          </span>
          <ChevronRight size={18} className="text-white/40" />
        </Link>
        <div className="flex items-center gap-3 border-t border-border px-4 py-3 text-white/45">
          <CircleHelp size={17} />
          <span className="text-xs">Elxie robot controller</span>
        </div>
      </section>
    </main>
  );
}
