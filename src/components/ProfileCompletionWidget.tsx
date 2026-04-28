import { CheckCircle2, Circle } from "lucide-react";

type CompletionSection = {
  label: string;
  completed: number;
  total: number;
};

export type ProfileCompletionData = {
  percent: number;
  completedFields: number;
  totalFields: number;
  sections: CompletionSection[];
};

function SemiCircleProgress({ percent }: { percent: number }) {
  const normalized = Math.max(0, Math.min(100, percent));
  const radius = 76;
  const circumference = Math.PI * radius;
  const progress = circumference - (normalized / 100) * circumference;

  return (
    <div className="relative mx-auto h-[130px] w-[180px] overflow-hidden">
      <svg
        viewBox="0 0 180 100"
        className="absolute inset-x-0 bottom-0 h-[180px] w-[180px]"
        aria-hidden="true"
      >
        <path
          d={`M 14 90 A ${radius} ${radius} 0 0 1 166 90`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 14 90 A ${radius} ${radius} 0 0 1 166 90`}
          fill="none"
          stroke="#22c55e"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <div className="text-4xl font-bold text-slate-900">{normalized}%</div>
        <div className="mt-1 text-sm font-medium text-slate-500">Complete</div>
      </div>
    </div>
  );
}

export default function ProfileCompletionWidget({
  data,
  onOpenProfile,
}: {
  data: ProfileCompletionData;
  onOpenProfile: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-foreground">Complete Your Profile</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A stronger profile helps other members discover you faster.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenProfile}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
        >
          Update
        </button>
      </div>

      <div className="mt-2">
        <SemiCircleProgress percent={data.percent} />
      </div>

      <div className="space-y-3">
        {data.sections.map((section) => {
          const done = section.completed >= section.total;
          return (
            <div key={section.label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
                <span className={`text-sm ${done ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                  {section.label}
                </span>
              </div>
              <span className={`text-sm font-semibold ${done ? "text-green-500" : "text-slate-500"}`}>
                {section.completed}/{section.total}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {data.completedFields}/{data.totalFields} profile details completed.
      </div>
    </div>
  );
}
