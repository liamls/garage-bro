import { useRef, useEffect } from "react";

interface VUMeterProps {
  inputLevel: number;
  outputLevel: number;
  isActive: boolean;
}

const BARS = 20;
const GAP = 2;

export function VUMeter({ inputLevel, outputLevel, isActive }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const drawCol = (x: number, w: number, level: number, label: string) => {
      const labelH = 14;
      const usable = H - labelH;
      const barH = (usable - BARS * GAP) / BARS;

      for (let i = 0; i < BARS; i++) {
        const t = i / BARS;
        const lit = isActive && t <= level;

        let litColor: string;
        if (t > 0.88) litColor = "#ff5656";
        else if (t > 0.72) litColor = "#ffb22d";
        else if (t > 0.5) litColor = "#edff4a";
        else litColor = "#93ff7d";

        const dimColor = "rgba(255,255,255,0.07)";

        ctx.fillStyle = lit ? litColor : dimColor;

        if (lit) {
          ctx.shadowColor = litColor;
          ctx.shadowBlur = 4;
        } else {
          ctx.shadowBlur = 0;
        }

        const y = usable - (i + 1) * (barH + GAP);
        ctx.beginPath();
        ctx.roundRect(x, y, w, barH, 1.5);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "7px Instrument Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x + w / 2, H - 2);
    };

    const cw = (W - 8) / 2;
    drawCol(0, cw, inputLevel, "IN");
    drawCol(cw + 8, cw, outputLevel, "OUT");
  }, [inputLevel, outputLevel, isActive]);

  return (
    <div className="vu-meter">
      <div className="vu-label">Level</div>
      <canvas ref={canvasRef} width={64} height={110} />
    </div>
  );
}
