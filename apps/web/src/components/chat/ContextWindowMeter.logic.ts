import type { ModelSelection, ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import {
  resolveSelectableProviderInstanceEntry,
  type ProviderInstanceEntry,
} from "../../providerInstances";
import { getDisplayModelName, type ModelEsque } from "./providerIconUtils";

export function providerSupportsManualCompaction(
  provider: ProviderInstanceEntry | null | undefined,
): boolean {
  return provider?.snapshot.slashCommands.some((command) => command.name === "compact") ?? false;
}

export function hasAvailableCompactionProvider(input: {
  readonly providers: ReadonlyArray<ProviderInstanceEntry>;
  readonly driverKind: ProviderDriverKind;
  readonly instanceId: ProviderInstanceId | null;
  readonly lockedInstanceId: ProviderInstanceId | null;
}): boolean {
  const driverProviders = input.providers.filter(
    (provider) => provider.driverKind === input.driverKind,
  );
  const lockedContinuationGroupKey = input.lockedInstanceId
    ? driverProviders.find((provider) => provider.instanceId === input.lockedInstanceId)
        ?.continuationGroupKey
    : undefined;
  const compatibleProviders = lockedContinuationGroupKey
    ? driverProviders.filter(
        (provider) => provider.continuationGroupKey === lockedContinuationGroupKey,
      )
    : driverProviders;

  return providerSupportsManualCompaction(
    resolveSelectableProviderInstanceEntry(compatibleProviders, input.instanceId ?? undefined),
  );
}

export function resolveContextWindowModelDisplayName(
  selection: ModelSelection | null | undefined,
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>,
): string | null {
  if (!selection) {
    return null;
  }

  const selectedModel = modelOptionsByInstance
    .get(selection.instanceId)
    ?.find((model) => model.slug === selection.model);

  return selectedModel ? getDisplayModelName(selectedModel) : selection.model;
}

export function formatContextWindowCompactionMessage(
  modelDisplayName: string | null | undefined,
  autoCompactThreshold?: number | null,
): string {
  if (typeof autoCompactThreshold === "number" && autoCompactThreshold > 0) {
    return `Compacts automatically at about ${autoCompactThreshold.toLocaleString("en-US")} tokens.`;
  }
  return modelDisplayName
    ? `Context for ${modelDisplayName} compacts automatically when needed.`
    : "Context compacts automatically when needed.";
}

export function shouldReserveContextWindowMeter(input: {
  readonly meterEnabled: boolean;
  readonly detailLoading: boolean;
  readonly threadStarted: boolean;
  readonly providerReportsContextWindow: boolean | null;
}): boolean {
  return (
    input.meterEnabled &&
    input.detailLoading &&
    input.threadStarted &&
    input.providerReportsContextWindow !== false
  );
}

export function formatContextWindowCost(cost: {
  readonly amount: number;
  readonly currency: string;
}): string {
  const fractionDigits = Math.abs(cost.amount) > 0 && Math.abs(cost.amount) < 0.01 ? 4 : 2;
  return `${cost.currency} ${cost.amount.toFixed(fractionDigits)}`;
}

export type ContextWindowMeterTone = "neutral" | "warning" | "critical";

const CONTEXT_WINDOW_METER_WARNING_PERCENTAGE = 75;

export function resolveContextWindowMeterScale(input: {
  readonly usedTokens: number;
  readonly maxTokens: number | null;
  readonly capTokens: number;
}): {
  readonly scaleTokens: number;
  readonly usedPercentage: number;
  readonly tone: ContextWindowMeterTone;
} {
  const maxTokens = input.maxTokens !== null && input.maxTokens > 0 ? input.maxTokens : null;
  const toneTokens = Math.min(maxTokens ?? input.capTokens, input.capTokens);
  // The bar runs to twice the cap so use past the cap stays visible.
  const scaleTokens = Math.min(maxTokens ?? 2 * input.capTokens, 2 * input.capTokens);
  const usedTokens = Math.max(0, input.usedTokens);
  const percentage = (usedTokens * 100) / toneTokens;
  return {
    scaleTokens,
    usedPercentage: Math.min(100, (usedTokens * 100) / scaleTokens),
    tone:
      percentage >= 100
        ? "critical"
        : percentage >= CONTEXT_WINDOW_METER_WARNING_PERCENTAGE
          ? "warning"
          : "neutral",
  };
}
