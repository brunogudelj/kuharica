/* Kamera i čitanje barkoda. Chrome na Androidu ima ugrađeni čitač (BarcodeDetector),
   a za Safari na iPhoneu i ostale preglednike učita se ZXing tek kad zatreba. */
import { useEffect, useRef, useState } from "react";

interface BarcodeDetectorLike {
  detect(src: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (o?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export function Scanner({ onCode, onClose }: { onCode: (c: string) => void; onClose?: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let alive = true;
    let stop = () => {};
    const found = (c: string) => {
      if (!alive) return;
      alive = false;
      stop();
      navigator.vibrate?.(60);
      cb.current(c);
    };
    const v = video.current;
    if (!v) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Ovaj preglednik ne daje pristup kameri. Upiši barkod ručno.");
      return;
    }
    const Det = window.BarcodeDetector;
    (async () => {
      try {
        if (Det) {
          const det = new Det({ formats: FORMATS });
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          stop = () => stream.getTracks().forEach((t) => t.stop());
          if (!alive) return stop();
          v.srcObject = stream;
          await v.play();
          while (alive) {
            try {
              const got = await det.detect(v);
              if (got[0]?.rawValue) return found(got[0].rawValue);
            } catch {
              /* sljedeća slika */
            }
            await new Promise((r) => setTimeout(r, 200));
          }
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          if (!alive) return;
          const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, v, (res) => {
            if (res) found(res.getText());
          });
          stop = () => controls.stop();
          if (!alive) stop();
        }
      } catch {
        if (alive) setErr("Kamera nije dopuštena ili nije dostupna. Upiši barkod ručno.");
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, []);

  return (
    <div className="scanner">
      {err ? (
        <p className="miss">{err}</p>
      ) : (
        <div className="scanview">
          <video ref={video} muted playsInline aria-label="Kamera za barkod" />
          <span className="scanline" aria-hidden="true" />
        </div>
      )}
      {onClose && (
        <button type="button" className="btn ghost small" onClick={onClose}>
          Zatvori kameru
        </button>
      )}
    </div>
  );
}
