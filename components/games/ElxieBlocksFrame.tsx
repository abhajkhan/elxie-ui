"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBleContext } from "@/context/BleContext";

const BLOCKS_SRC = "/elxie-blocks/index.html?embed=1";

// Window messages from the iframe (handshake + exit) and the MessagePort
// protocol used afterwards. Mirrors ElxLink.AppBridge in public/elxie-blocks/js/link.js.
type FrameMessage = { type: "elxie-blocks:ready" } | { type: "elxie-blocks:exit" };
type PortRequest = { t: "write"; id: number; bytes: Uint8Array };
type BridgeState = { t: "state"; connected: boolean; vm: boolean; name: string | null };

/**
 * Hosts the standalone Elxie Blocks editor and lends it the app's BLE
 * connection: VM frames go over the shared GATT link via `vmChannel`, so the
 * robot stays connected for the games while Blocks is open.
 */
export default function ElxieBlocksFrame() {
  const router = useRouter();
  const { status, vmChannel, deviceName } = useBleContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const portRef = useRef<MessagePort | null>(null);

  const stateRef = useRef<BridgeState>({ t: "state", connected: false, vm: false, name: null });
  const vmRef = useRef(vmChannel);

  useEffect(() => {
    vmRef.current = vmChannel;
    stateRef.current = { t: "state", connected: status === "connected", vm: vmChannel !== null, name: deviceName };
    portRef.current?.postMessage(stateRef.current);
  }, [status, vmChannel, deviceName]);

  useEffect(() => {
    if (!vmChannel) return;
    return vmChannel.subscribe((bytes) => portRef.current?.postMessage({ t: "data", bytes }));
  }, [vmChannel]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<FrameMessage>) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;

      if (event.data?.type === "elxie-blocks:exit") {
        router.push("/playground");
        return;
      }
      if (event.data?.type !== "elxie-blocks:ready") return;

      // Fresh channel per (re)load of the iframe.
      portRef.current?.close();
      const channel = new MessageChannel();
      portRef.current = channel.port1;
      channel.port1.onmessage = ({ data }: MessageEvent<PortRequest>) => {
        if (data?.t !== "write") return;
        const vm = vmRef.current;
        const pending = vm ? vm.write(data.bytes) : Promise.reject(new Error("Elxie is not connected"));
        pending
          .then(() => channel.port1.postMessage({ t: "written", id: data.id }))
          .catch((error: unknown) =>
            channel.port1.postMessage({
              t: "written",
              id: data.id,
              error: error instanceof Error ? error.message : String(error),
            })
          );
      };
      iframeRef.current?.contentWindow?.postMessage({ type: "elxie-blocks:bridge" }, window.location.origin, [channel.port2]);
      channel.port1.postMessage(stateRef.current);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      portRef.current?.close();
      portRef.current = null;
    };
  }, [router]);

  return (
    <main className="fixed inset-0 h-dvh w-full bg-[#F2F3F7]">
      <iframe
        ref={iframeRef}
        src={BLOCKS_SRC}
        title="Elxie Blocks"
        allow="bluetooth; serial"
        className="h-full w-full border-0"
      />
    </main>
  );
}
