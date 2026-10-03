import { useCallback, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { normalizeInternalTransferAmount, validateInternalTransferQuote, type InternalTransferDraft,
  type InternalTransferIssue, type InternalTransferPort, type InternalTransferQuote, type InternalTransferRequest,
  type InternalTransferResult, type InternalTransferSimulation } from "../internal-transfer";
import type { InternalReceiveDestination, ReceiveRoute } from "./receive-types";

export type InternalReceiveTransferOptions = {
  route: ReceiveRoute;
  destination: InternalReceiveDestination;
  port: InternalTransferPort;
  draft: InternalTransferDraft;
  privacy: boolean;
  onDraftChange: (draft: InternalTransferDraft | null) => void;
  onSimulationResult?: (event: InternalTransferSimulation) => void;
  abortRef: RefObject<(() => void) | null>;
};
type Stage = "edit" | "quoting" | "review" | "pending" | "result";
type State = { stage: Stage; quote: InternalTransferQuote | null; result: InternalTransferResult | null; issue: InternalTransferIssue | null };
type Stored = State & { port: InternalTransferPort; destination: InternalReceiveDestination; draftKey: string };
const EMPTY: State = { stage: "edit", quote: null, result: null, issue: null };

export function useInternalReceiveTransfer({ route, destination, port, draft, privacy, onDraftChange,
  onSimulationResult, abortRef }: InternalReceiveTransferOptions) {
  const instanceId = useId();
  const sources = destination.sources.filter(source => source.status === "available");
  const sourceId = draft.sourceAccountId ?? (sources.length === 1 ? sources[0]!.accountId : null);
  const source = sources.find(candidate => candidate.accountId === sourceId) ?? null;
  const amount = normalizeInternalTransferAmount(draft.amount);
  const draftKey = JSON.stringify([sourceId, draft.amount]);
  const [stored, setStored] = useState<Stored | null>(null);
  // Clearing a successful draft must not erase the accepted result. User edits still invalidate it.
  const state: State = stored?.port === port && stored.destination === destination &&
    (stored.stage === "result" || stored.draftKey === draftKey) ? stored : EMPTY;
  const sequence = useRef(0);
  const attempt = useRef(0);
  const active = useRef(false);
  const closed = useRef(false);
  const submitLocked = useRef(false);
  const running = useRef<{ controller: AbortController; kind: "quote" | "submit" } | null>(null);
  const emitted = useRef<string | null>(null);
  const latest = useRef({ port, destination, draftKey, privacy, onDraftChange, onSimulationResult });
  useLayoutEffect(() => { latest.current = { port, destination, draftKey, privacy, onDraftChange, onSimulationResult }; });

  const invalidate = useCallback(() => {
    sequence.current += 1;
    running.current?.controller.abort();
    running.current = null;
    submitLocked.current = false;
  }, []);
  const cancel = useCallback(() => { closed.current = true; invalidate(); }, [invalidate]);
  useLayoutEffect(() => {
    active.current = true; closed.current = false;
    abortRef.current = cancel;
    return () => {
      active.current = false;
      invalidate();
      if (abortRef.current === cancel) abortRef.current = null;
    };
  }, [port, destination, abortRef, cancel, invalidate]);

  function show(next: Partial<State>) {
    setStored({ ...EMPTY, ...next, port, destination, draftKey });
  }
  function start(kind: "quote" | "submit") {
    invalidate();
    const controller = new AbortController(), ticket = sequence.current;
    running.current = { controller, kind };
    return { signal: controller.signal, current: () => active.current && !closed.current &&
      ticket === sequence.current && !controller.signal.aborted && latest.current.port === port &&
      latest.current.destination === destination && latest.current.draftKey === draftKey };
  }
  function request(): InternalTransferRequest | null {
    return source && amount && route.receiveMode === "internal-transfer" ? {
      sourceAccountId: source.accountId, destinationAccountId: route.accountId,
      assetId: route.assetId, networkId: route.networkId, amount,
    } : null;
  }
  function changeSource(accountId: string) {
    if (closed.current || submitLocked.current || privacy || !sources.some(candidate => candidate.accountId === accountId)) return;
    invalidate(); show({});
    onDraftChange({ sourceAccountId: accountId, amount: draft.amount });
  }
  function changeAmount(value: string) {
    if (closed.current || submitLocked.current || privacy) return;
    invalidate(); show({});
    onDraftChange({ sourceAccountId: sourceId, amount: value });
  }
  function edit() {
    if (closed.current || state.stage === "pending") return;
    invalidate(); show({});
  }
  async function calculate() {
    if (closed.current || !active.current || latest.current.privacy || submitLocked.current || running.current?.kind === "quote") return;
    const expected = request();
    if (!expected || port.mode !== "demo") { show({ issue: !source ? "unsupported-route" : "invalid-amount" }); return; }
    const task = start("quote");
    show({ stage: "quoting" });
    try {
      const response = await port.quote({ ...expected }, { signal: task.signal });
      if (!task.current()) return;
      if (response.status === "unavailable") show({ issue: response.issue });
      else {
        const quote = copyQuote(response.quote);
        const issue = validateInternalTransferQuote(expected, quote, Date.now());
        show(issue ? { issue } : { stage: "review", quote });
      }
    } catch {
      if (task.current()) show({ issue: "unavailable" });
    } finally {
      if (task.current()) running.current = null;
    }
  }
  async function confirm() {
    if (closed.current || !active.current || latest.current.privacy || submitLocked.current ||
        state.stage !== "review" || !state.quote || port.mode !== "demo") return;
    const expected = request();
    if (!expected) { invalidate(); show({ issue: !source ? "unsupported-route" : "invalid-amount" }); return; }
    const acceptedQuote = copyQuote(state.quote);
    const issue = validateInternalTransferQuote(expected, acceptedQuote, Date.now());
    if (issue) { invalidate(); show({ issue }); return; }
    const task = start("submit");
    // Synchronous ref lock closes the same-event gap before disabled controls render.
    submitLocked.current = true;
    const simulationId = `demo-internal:${instanceId}:${++attempt.current}`;
    show({ stage: "pending", quote: acceptedQuote });
    let acceptedResult: InternalTransferResult | null;
    try {
      // The command and the receipt use independent copies: a port cannot mutate the accepted receipt.
      const response = await port.submit({ quote: copyQuote(acceptedQuote), idempotencyKey: simulationId }, { signal: task.signal });
      if (!task.current()) return;
      acceptedResult = copyResult(response);
    } catch {
      if (task.current()) { invalidate(); show({ issue: "unavailable" }); }
      return;
    }
    if (!acceptedResult) { invalidate(); show({ issue: "unavailable" }); return; }
    running.current = null;
    show({ stage: "result", quote: acceptedQuote, result: acceptedResult });
    // Keep the submit lock until explicit Edit or a new scope, including same-tick reentry.
    if (emitted.current === simulationId) return;
    emitted.current = simulationId;
    if (acceptedResult.status === "simulated-success") latest.current.onDraftChange(null);
    if (active.current && !closed.current) latest.current.onSimulationResult?.({ simulationId,
      quote: copyQuote(acceptedQuote), result: { ...acceptedResult } });
  }

  return { ...state, sourceId, source, amount,
    canCalculate: Boolean(source && amount && !privacy && port.mode === "demo" && state.stage !== "quoting" && state.stage !== "pending"),
    changeSource, changeAmount, calculate, confirm, edit, cancel };
}

function copyQuote(quote: InternalTransferQuote): InternalTransferQuote {
  return { mode: quote.mode, id: quote.id,
    request: { sourceAccountId: quote.request.sourceAccountId, destinationAccountId: quote.request.destinationAccountId,
      assetId: quote.request.assetId, networkId: quote.request.networkId, amount: quote.request.amount },
    sourceAccountLabel: quote.sourceAccountLabel, destinationAccountLabel: quote.destinationAccountLabel,
    symbol: quote.symbol, networkLabel: quote.networkLabel, available: quote.available, assetDebit: quote.assetDebit,
    fee: { amount: quote.fee.amount, symbol: quote.fee.symbol }, expiresAt: quote.expiresAt };
}
function copyResult(result: InternalTransferResult): InternalTransferResult | null {
  if (result?.mode !== "demo") return null;
  if (result.status === "simulated-success") return { mode: "demo", status: "simulated-success" };
  if (result.status === "simulated-failure" && ["rejected", "expired", "unavailable"].includes(result.reason)) {
    return { mode: "demo", status: "simulated-failure", reason: result.reason };
  }
  return null;
}
