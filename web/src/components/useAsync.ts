import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  status: "loading" | "ready" | "error";
  data?: T;
  error?: unknown;
  reload: () => void;
}

/**
 * Runs an async task on mount and exposes its outcome, with a reload for the retry affordances
 * the degraded states offer. Results from a superseded run are discarded, so a slow first request
 * can't overwrite a fresher one.
 */
export function useAsync<T>(task: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<{ status: AsyncState<T>["status"]; data?: T; error?: unknown }>(
    { status: "loading" },
  );
  const [nonce, setNonce] = useState(0);
  const runId = useRef(0);

  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    const id = ++runId.current;
    setState({ status: "loading" });

    taskRef.current().then(
      (data) => {
        if (runId.current === id) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (runId.current === id) setState({ status: "error", error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, reload };
}
