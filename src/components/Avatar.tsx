import { cn } from "@/lib/utils";

function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase();
}

const gradients = [
  "from-[#0ea5e9] to-[#6366f1]", // sky -> indigo
  "from-[#22c55e] to-[#14b8a6]", // green -> teal
  "from-[#f59e0b] to-[#ef4444]", // amber -> red
  "from-[#d946ef] to-[#8b5cf6]", // fuchsia -> violet
  "from-[#1e346b] to-[#d4af37]", // navy -> gold (brand)
  "from-[#111827] to-[#4b5563]", // slate
];

export default function Avatar({
  src,
  name,
  seed,
  className,
}: {
  src?: string | null;
  name?: string | null;
  seed: string;
  className?: string;
}) {
  const h = hashString(seed);
  const g = gradients[h % gradients.length];
  const label = initials(name || seed) || "SL";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border border-border bg-background flex items-center justify-center shrink-0",
        className
      )}
    >
      {src && src.trim() !== "" ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className={cn("h-full w-full bg-gradient-to-br flex items-center justify-center", g)}>
          <span className="text-white/95 font-semibold text-sm">{label}</span>
        </div>
      )}
    </div>
  );
}
