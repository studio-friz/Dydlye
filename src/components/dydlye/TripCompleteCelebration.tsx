import { useCallback, useEffect, useState } from "react";
import { clearTrip } from "@/lib/tripPlanner";
import { useSettings } from "@/i18n/useTranslation";

interface Props {
  onClose: () => void;
}

const COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function ConfettiPiece({ index }: { index: number }) {
  const left = Math.random() * 100;
  const delay = Math.random() * 2;
  const duration = 2 + Math.random() * 3;
  const color = randomColor();
  const size = 6 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <div
      className="absolute animate-bounce"
      style={{
        left: `${left}%`,
        top: `-${10 + Math.random() * 20}px`,
        width: size,
        height: size * 1.4,
        background: color,
        borderRadius: Math.random() > 0.5 ? "50%" : "2px",
        animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
        transform: `rotate(${rotation}deg)`,
        opacity: 0,
      }}
    />
  );
}

export function TripCompleteCelebration({ onClose }: Props) {
  const { t, dir } = useSettings();
  const [visible, setVisible] = useState(true);
  const [pieces] = useState(() => Array.from({ length: 40 }, (_, i) => i));

  const handleFinish = useCallback(() => {
    clearTrip();
    setVisible(false);
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
      dir={dir}
    >
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg) scale(0);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(${360 + Math.random() * 720}deg) scale(1);
            opacity: 0;
          }
        }
      `}</style>
      {pieces.map((i) => (
        <ConfettiPiece key={i} index={i} />
      ))}

      <div className="relative z-10 mx-4 max-w-sm rounded-3xl bg-card p-8 text-center shadow-2xl animate-in zoom-in-110 duration-500">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-extrabold text-foreground mb-2">شكراً لزيارتكم المغرب!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">
          نتمنى أن تكون رحلتكم في المغرب مليئة بالذكريات الجميلة. تعالوا مرة أخرى!
        </p>
        <div className="text-4xl mb-6">🇲🇦</div>
        <button
          onClick={handleFinish}
          className="w-full rounded-2xl bg-gradient-to-l from-primary to-primary-glow px-6 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 hover:opacity-90"
        >
          إنهاء الرحلة
        </button>
      </div>
    </div>
  );
}
