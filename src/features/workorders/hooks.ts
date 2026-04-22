import { useCallback, useEffect, useState } from "react";
import { listWorkOrdersForPortal } from "./api";
import type { WorkOrder, WorkOrderPortal } from "./types";

export function useWorkOrders(portal: WorkOrderPortal) {
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextItems = await listWorkOrdersForPortal(portal);
      setItems(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load work orders.");
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
}
