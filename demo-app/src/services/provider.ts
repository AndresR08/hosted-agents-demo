import { useMemo } from "react";
import { useDemoStore } from "@/state/store";
import type { DemoDataService } from "./contracts";
import { AzureService } from "./azure/azureService";
import { SimulationService } from "./simulation/simulationService";

const azureService = new AzureService();
const simulationService = new SimulationService();

/**
 * Returns the DemoDataService implementation for the current Live/Replay
 * mode (DESIGN_DECISIONS.md). Panels call this instead of importing either
 * implementation directly, so switching modes (the `L` shortcut) is
 * transparent to every component.
 */
export function useDemoDataService(): DemoDataService {
  const mode = useDemoStore((state) => state.mode);
  return useMemo(
    () => (mode === "live" ? azureService : simulationService),
    [mode],
  );
}
