import { Card } from "@/components/ui/card";

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between text-[13px] text-gray-900">
        {label}
        <span className="text-gray-700 [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-semibold md:text-2xl tabular-nums tracking-[-0.03em] text-gray-1000">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-900">{hint}</p>}
    </Card>
  );
}
