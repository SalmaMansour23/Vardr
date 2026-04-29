import { FlaggedBetsDashboard } from "@/components/flagged-bets-dashboard";

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export default function Page() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const aiIntelBaseUrl =
    process.env.AI_INTEL_BASE_URL || process.env.NEXT_PUBLIC_AI_INTEL_BASE_URL || "";
  const refreshSeconds = toPositiveInt(
    process.env.REFRESH_SECONDS || process.env.NEXT_PUBLIC_REFRESH_SECONDS,
    60,
  );

  return (
    <FlaggedBetsDashboard
      apiBaseUrl={apiBaseUrl}
      aiIntelBaseUrl={aiIntelBaseUrl}
      refreshSeconds={refreshSeconds}
    />
  );
}
