"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  commerceOperationId, commerceRouteKey, validateCommerceAmount, validateCommerceSimulation,
  validateSwapQuote, validateSwapRequest,
  type CommerceAcceptedSubmit, type CommerceIssue, type SwapFlowProps, type SwapPort,
  type SwapQuote, type SwapRequest, type SwapRouteData, type SwapSimulation,
} from "../commerce";

type Stage = "edit" | "review" | "pending" | "result";
type Loaded = { port: SwapPort; attempt: number; data: SwapRouteData | null; issue: CommerceIssue | null; retryable: boolean };
type Accepted = {
  attempt: CommerceAcceptedSubmit & { kind: "swap" };
  release: SwapFlowProps["onSubmitBusyChange"];
  terminal: SwapFlowProps["onSimulationResult"];
};

/** Steps and asynchronous ownership are local; commerce owns all money/binding guards. */
export function useSwapFlow(props: SwapFlowProps) {
  const { route, port, privacy } = props;
  const [seed] = useState(() => props.initialDraft && commerceRouteKey(props.initialDraft.route) === commerceRouteKey(route)
    ? structuredClone(props.initialDraft) : null);
  const [sourceAmount, setSourceAmount] = useState(seed?.sourceAmount ?? "");
  const [pairId, setPairId] = useState<string | null>(seed?.pairId ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>("edit");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [result, setResult] = useState<SwapSimulation | null>(null);
  const [issue, setIssue] = useState<CommerceIssue | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<"quote" | "submit" | null>(null);
  const generation = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const accepted = useRef<Accepted | null>(null);
  const sequence = useRef(0);
  const sessionId = useId();
  const current = useRef(props);
  current.current = props;

  const releaseAccepted = useCallback(() => {
    const value = accepted.current;
    accepted.current = null;
    if (value) value.release({ busy: false, operationId: value.attempt.operationId });
  }, []);

  const loading = loaded?.port !== port || loaded?.attempt !== loadAttempt;
  const data = loading ? null : loaded?.data ?? null;
  const pair = data?.pairs.find(value => value.id === pairId) ?? null;
  // A replacement port never gets an old quote/result, even before effect cleanup.
  const visibleQuote = data ? quote : null;
  const visibleResult = data ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    generation.current += 1;
    operation.current?.abort();
    setQuote(null); setResult(null); setIssue(null); setNotice(null); setWorking(null); setStage("edit");
    async function load() {
      try {
        const answer = port.mode === "demo" && route.action === "swap"
          ? await port.loadRoute(route, { signal: controller.signal })
          : { status: "unavailable" as const, issue: { code: "unsupported-route" as const } };
        if (!active || current.current.port !== port) return;
        if (answer.status === "ready") {
          const value = structuredClone(answer.data);
          if (commerceRouteKey(value.route) !== commerceRouteKey(route) || !Array.isArray(value.pairs)) {
            setLoaded({ port, attempt: loadAttempt, data: null, issue: { code: "unsupported-route" }, retryable: false });
            return;
          }
          setLoaded({ port, attempt: loadAttempt, data: value, issue: null, retryable: false });
          setPairId(selected => selected === null && value.pairs.length === 1 ? value.pairs[0]!.id : selected);
        } else {
          setLoaded({ port, attempt: loadAttempt, data: null, issue: answer.issue,
            retryable: answer.status === "error" && answer.retryable });
        }
      } catch {
        if (active && current.current.port === port) setLoaded({ port, attempt: loadAttempt, data: null,
          issue: { code: "unavailable" }, retryable: true });
      }
    }
    void load();
    return () => {
      active = false; controller.abort(); operation.current?.abort(); generation.current += 1;
      releaseAccepted();
    };
  }, [route, port, loadAttempt, releaseAccepted]);

  useEffect(() => {
    if (!quote || stage === "pending" || stage === "result") return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (accepted.current || current.current.port !== port) return;
      const remaining = quote.expiresAt - Date.now();
      if (remaining > 0) { timer = setTimeout(check, Math.min(remaining, 2_147_483_647)); return; }
      generation.current += 1; operation.current?.abort();
      setQuote(null); setWorking(null); setStage("edit"); setIssue({ code: "expired-quote" });
    };
    timer = setTimeout(check, Math.max(0, Math.min(quote.expiresAt - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [quote, stage, port]);

  useEffect(() => {
    if (!privacy || working !== "quote" || accepted.current) return;
    generation.current += 1; operation.current?.abort();
    setWorking(null); setQuote(null); setStage("edit");
  }, [privacy, working]);

  function invalidate() {
    generation.current += 1; operation.current?.abort();
    setQuote(null); setResult(null); setIssue(null); setNotice(null); setWorking(null); setStage("edit");
  }

  function saveDraft(amount: string, destinationId: string | null) {
    current.current.onDraftChange?.({ route: structuredClone(route), sourceAmount: amount, pairId: destinationId });
  }

  function changeAmount(value: string) {
    if (accepted.current || current.current.privacy) return;
    invalidate(); setSourceAmount(value); saveDraft(value, pairId);
  }

  function changePair(value: string) {
    if (accepted.current || current.current.privacy) return;
    const selected = value || null;
    invalidate(); setPairId(selected); saveDraft(sourceAmount, selected);
  }

  function nextWork() {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const ticket = ++generation.current;
    return { controller, owns: () => ticket === generation.current && current.current.port === port && !controller.signal.aborted };
  }

  function requestNow(): SwapRequest | null {
    if (!data || !pair) { setIssue({ code: "unsupported-pair" }); return null; }
    const quantity = validateCommerceAmount(sourceAmount, data.terms);
    if (!quantity.valid) { setIssue(quantity.issue); return null; }
    const request = { route, pairId: pair.id, destination: pair.destination, sourceAmount: quantity.amount };
    const invalid = validateSwapRequest(request, data);
    if (invalid) { setIssue(invalid); return null; }
    return structuredClone(request);
  }

  async function calculate() {
    if (accepted.current || current.current.privacy || working === "quote" || loading) return;
    const request = requestNow();
    if (!request) return;
    const work = nextWork();
    setQuote(null); setResult(null); setIssue(null); setNotice(null); setWorking("quote");
    try {
      const answer = await port.quote(structuredClone(request), { signal: work.controller.signal });
      if (!work.owns() || current.current.privacy) return;
      if (answer.status !== "quoted") { setIssue(answer.issue); return; }
      const invalid = validateSwapQuote(request, answer.quote, Date.now(), port.id);
      if (invalid) { setIssue(invalid); return; }
      setQuote(structuredClone(answer.quote)); setStage("review");
    } catch {
      if (work.owns()) setIssue({ code: "unavailable" });
    } finally {
      if (work.owns()) setWorking(null);
    }
  }

  async function submit() {
    if (accepted.current || current.current.privacy || !visibleQuote || stage !== "review") return;
    const request = requestNow();
    if (!request) return;
    const invalid = validateSwapQuote(request, visibleQuote, Date.now(), port.id);
    if (invalid) { invalidate(); setIssue(invalid); return; }
    const work = nextWork();
    const captured = structuredClone(visibleQuote);
    const idempotencyKey = `swap-${sessionId}-${++sequence.current}`;
    const attempt: Accepted["attempt"] = { kind: "swap", quote: captured, idempotencyKey,
      operationId: commerceOperationId(captured, idempotencyKey) };
    const owner = { attempt, release: current.current.onSubmitBusyChange, terminal: current.current.onSimulationResult };
    accepted.current = owner;
    setIssue(null); setNotice(null); setWorking("submit"); setStage("pending");
    try {
      owner.release({ busy: true, attempt: structuredClone(attempt) });
      const answer = await port.submit({ quote: structuredClone(captured), idempotencyKey }, { signal: work.controller.signal });
      if (!work.owns() || accepted.current !== owner) return;
      if (answer.status !== "simulated") { invalidate(); setIssue(answer.issue); return; }
      const resultIssue = validateCommerceSimulation(captured, answer.simulation, idempotencyKey);
      if (resultIssue) { invalidate(); setIssue(resultIssue); return; }
      const simulation = structuredClone(answer.simulation);
      setResult(simulation); setStage("result");
      // Controller still owns the immutable accepted attempt during terminal ingestion.
      owner.terminal(structuredClone(simulation));
      if (simulation.result.status === "simulated-success") current.current.onDraftChange?.(null);
    } catch {
      if (work.owns()) { invalidate(); setIssue({ code: "unavailable" }); }
    } finally {
      if (accepted.current === owner) releaseAccepted();
      if (work.owns()) setWorking(null);
    }
  }

  function back() {
    if (accepted.current) { setNotice("Дождитесь результата симуляции."); return; }
    if (stage === "review") invalidate();
    else current.current.onBack(route);
  }

  function close() {
    if (accepted.current) { setNotice("Дождитесь результата симуляции."); return; }
    current.current.onClose();
  }

  return {
    data, pair, pairId, sourceAmount, loading, stage: data ? stage : "edit" as Stage,
    quote: visibleQuote, result: visibleResult, working, pending: accepted.current !== null,
    issue: loading ? null : loaded?.issue ?? issue, notice, retryable: !loading && loaded?.retryable === true,
    restoredDraft: seed !== null, changeAmount, changePair, calculate, submit, back, close,
    loadAgain: () => setLoadAttempt(value => value + 1),
    recalculate: () => { if (!accepted.current) invalidate(); },
  };
}
