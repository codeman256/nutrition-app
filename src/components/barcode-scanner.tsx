"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Camera barcode scanner: native BarcodeDetector when available, @zxing/browser
 * as the fallback. Camera access needs HTTPS (or localhost).
 */
export function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (code: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    let rafId = 0;

    async function start() {
      const video = videoRef.current;
      if (!video) return;

      if (!window.isSecureContext) {
        onError(
          "Camera scanning needs HTTPS (or localhost). Type the barcode number instead.",
        );
        setActive(false);
        return;
      }

      try {
        type DetectorClass = new (options: { formats: string[] }) => {
          detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
        };
        const Detector = (window as unknown as { BarcodeDetector?: DetectorClass })
          .BarcodeDetector;

        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (cancelled) return;
          video.srcObject = stream;
          await video.play();
          const detector = new Detector({
            formats: ["upc_a", "upc_e", "ean_13", "ean_8"],
          });
          const tick = async () => {
            if (cancelled) return;
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                onDetected(codes[0].rawValue);
                setActive(false);
                return;
              }
            } catch {
              // keep scanning
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromVideoDevice(
            undefined,
            video,
            (result) => {
              if (result) {
                onDetected(result.getText());
                setActive(false);
              }
            },
          );
        }
      } catch (err) {
        onError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission was denied. Type the barcode number instead."
            : "Couldn't start the camera. Type the barcode number instead.",
        );
        setActive(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, onDetected, onError]);

  if (!active) {
    return (
      <Button type="button" variant="outline" onClick={() => setActive(true)}>
        Scan with camera
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        className="aspect-video w-full max-w-md rounded-lg border bg-black"
        playsInline
        muted
      />
      <Button type="button" variant="ghost" onClick={() => setActive(false)}>
        Stop scanning
      </Button>
    </div>
  );
}
