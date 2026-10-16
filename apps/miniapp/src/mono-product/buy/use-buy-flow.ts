import { useEffect, useRef, useState } from "react";
import {
  commerceOperationId, commerceRouteKey, validateBuyQuote, validateBuyRequest,
  validateCommerceAmount, validateCommerceSimulation,
  type BuyDraft, type BuyFlowProps, type BuyLoadResult, type BuyPort, type BuyQuote,
  type BuyRequest, type BuySimulation, type CommerceAcceptedSubmit, type CommerceIssue,
} from "../commerce";

type Stage = "method" | "amount" | "review" | "pending" | "result";
type BuyAttempt = CommerceAcceptedSubmit & { kind: "buy" };
type Loaded = { port: BuyPort; attempt: number; result: BuyLoadResult };

export function useBuyFlow({ route, port, privacy, initialDraft, onDraftChange,
  onSimulationResult, onSubmitBusyChange, onBack, onClose }: BuyFlowProps) {
  const [seed] = useState(() => matchingDraft(route, initialDraft));
  const [methodId, setMethodId] = useState<string | null>(seed?.methodId ?? null);
  const [amount, setAmount] = useState(seed?.fiatAmount ?? "");
  const raw = useRef({ methodId, fiatAmount: amount });
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>("method");
  const [quote, setQuote] = useState<BuyQuote | null>(null);
  const [issue, setIssue] = useState<CommerceIssue | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [simulation, setSimulation] = useState<BuySimulation | null>(null);
  const generation = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const quoteLock = useRef(false);
  const authorization = useRef<{ port: BuyPort; quote: BuyQuote } | null>(null);
  const accepted = useRef<BuyAttempt | null>(null);
  const delivered = useRef(new Set<string>());
  const listeners = useRef({ onDraftChange, onSimulationResult, onSubmitBusyChange });
  useEffect(() => { listeners.current = { onDraftChange, onSimulationResult, onSubmitBusyChange }; },
    [onDraftChange, onSimulationResult, onSubmitBusyChange]);

  const loading = loaded?.port !== port || loaded.attempt !== loadAttempt;
  const loadResult = !loading ? loaded!.result : null;
  const data = loadResult?.status === "ready" ? loadResult.data : null;
  const loadIssue = loadResult && loadResult.status !== "ready" ? loadResult.issue : null;
  const method = data?.methods.find(value => value.id === methodId) ?? null;
  const visibleQuote = authorization.current?.port === port ? quote : null;

  function release(attempt: BuyAttempt) {
    if (accepted.current?.operationId !== attempt.operationId) return;
    accepted.current = null;
    try { listeners.current.onSubmitBusyChange({ busy: false, operationId: attempt.operationId }); }
    catch { /* A host observer cannot reauthorize or replay the completed attempt. */ }
  }

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    authorization.current = null;
    setQuote(null); setIssue(null); setSimulation(null); setQuoting(false); setStage("method");
    quoteLock.current = false;
    async function load() {
      let result: BuyLoadResult;
      try {
        result = port.mode === "demo" && route.action === "buy"
          ? await port.loadRoute(route, { signal: controller.signal })
          : { status: "unavailable", issue: { code: "unsupported-route" } };
        if (result.status === "ready") {
          const routeData = result.data;
          const methods = routeData.methods;
          const problem = !Array.isArray(methods) || methods.length === 0 ? { code: "unsupported-method" as const }
            : methods.map(value => validateBuyRequest({ route, methodId: value.id,
              fiat: { currency: value.currency, amount: value.terms.minimum } }, routeData))
              .find(value => value !== null);
          if (problem) result = { status: "unavailable", issue: problem };
        } else if (result.status !== "unavailable" && result.status !== "error") {
          result = { status: "error", issue: { code: "unavailable" }, retryable: true };
        }
      } catch { result = { status: "error", issue: { code: "unavailable" }, retryable: true }; }
      if (!active || controller.signal.aborted) return;
      if (result.status === "ready") {
        const selected = result.data.methods.some(value => value.id === raw.current.methodId)
          ? raw.current.methodId : result.data.methods[0]!.id;
        raw.current.methodId = selected; setMethodId(selected);
      }
      setLoaded({ port, attempt: loadAttempt, result });
    }
    void load();
    return () => {
      active = false; controller.abort(); operation.current?.abort(); generation.current += 1;
      authorization.current = null;
      if (accepted.current) release(accepted.current);
    };
  }, [route, port, loadAttempt]);

  useEffect(() => {
    if (!visibleQuote || stage === "pending" || stage === "result") return;
    const currentQuote = visibleQuote;
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      if (accepted.current || authorization.current?.quote !== currentQuote) return;
      const remaining = currentQuote.expiresAt - Date.now();
      if (remaining > 0) { timer = setTimeout(check, Math.min(remaining, 2_147_483_647)); return; }
      authorization.current = null; setQuote(null); setIssue({ code: "expired-quote" }); setStage("amount");
    }
    timer = setTimeout(check, Math.max(0, Math.min(currentQuote.expiresAt - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [visibleQuote, stage]);

  function invalidate() {
    generation.current += 1; operation.current?.abort();
    authorization.current = null; quoteLock.current = false;
    setQuote(null); setIssue(null); setQuoting(false); setSimulation(null);
  }

  function publishDraft() {
    listeners.current.onDraftChange?.({ route: { ...route }, ...raw.current });
  }

  function chooseMethod(value: string) {
    if (privacy || accepted.current || !data?.methods.some(candidate => candidate.id === value)) return;
    invalidate(); raw.current.methodId = value; setMethodId(value); publishDraft();
  }

  function changeAmount(value: string) {
    if (privacy || accepted.current) return;
    invalidate(); raw.current.fiatAmount = value; setAmount(value); publishDraft();
  }

  function continueMethod() {
    if (privacy || accepted.current || !method) return;
    invalidate(); setStage("amount");
  }

  function currentRequest(): BuyRequest | null {
    const selected = data?.methods.find(candidate => candidate.id === raw.current.methodId);
    if (!data || !selected) { setIssue({ code: "unsupported-method" }); return null; }
    const checked = validateCommerceAmount(raw.current.fiatAmount, selected.terms);
    if (!checked.valid) { setIssue(checked.issue); return null; }
    const request: BuyRequest = { route, methodId: selected.id, fiat: { currency: selected.currency, amount: checked.amount } };
    const problem = validateBuyRequest(request, data);
    if (problem) { setIssue(problem); return null; }
    return request;
  }

  function nextOperation() {
    operation.current?.abort();
    const controller = new AbortController(); operation.current = controller;
    const ticket = ++generation.current;
    return { controller, current: () => ticket === generation.current && !controller.signal.aborted };
  }

  async function requestQuote() {
    if (privacy || accepted.current || quoteLock.current || !data || port.mode !== "demo") return;
    const request = currentRequest();
    if (!request) return;
    invalidate(); const task = nextOperation(); quoteLock.current = true; setQuoting(true);
    try {
      const response = await port.quote(request, { signal: task.controller.signal });
      if (!task.current()) return;
      if (response.status !== "quoted") { setIssue(response.issue ?? { code: "unavailable" }); return; }
      const problem = validateBuyQuote(request, response.quote, Date.now(), port.id);
      if (problem) { setIssue(problem); return; }
      const value = immutableCopy(response.quote);
      authorization.current = { port, quote: value }; setQuote(value); setStage("review");
    } catch { if (task.current()) setIssue({ code: "unavailable" }); }
    finally { if (task.current()) { quoteLock.current = false; setQuoting(false); } }
  }

  function recover(problem: CommerceIssue) {
    authorization.current = null; setQuote(null); setSimulation(null); setIssue(problem); setStage("amount");
  }

  async function submit() {
    const authorized = authorization.current;
    if (privacy || accepted.current || stage !== "review" || !authorized || authorized.port !== port ||
        authorized.quote !== quote || port.mode !== "demo") return;
    const request = currentRequest();
    if (!request) return;
    const problem = validateBuyQuote(request, authorized.quote, Date.now(), port.id);
    if (problem) { recover(problem); return; }
    const task = nextOperation();
    const idempotencyKey = crypto.randomUUID();
    const attempt: BuyAttempt = Object.freeze({ kind: "buy", quote: authorized.quote, idempotencyKey,
      operationId: commerceOperationId(authorized.quote, idempotencyKey) });
    // Lock and notify synchronously, before a port can accept the command.
    accepted.current = attempt; setStage("pending"); setIssue(null);
    try {
      listeners.current.onSubmitBusyChange({ busy: true, attempt });
      if (!task.current()) return;
      const response = await port.submit({ quote: attempt.quote, idempotencyKey }, { signal: task.controller.signal });
      if (!task.current()) return;
      if (response.status !== "simulated") { recover(response.issue ?? { code: "unavailable" }); return; }
      const invalid = validateCommerceSimulation(attempt.quote, response.simulation, idempotencyKey);
      if (invalid) { recover(invalid); return; }
      const event: BuySimulation = Object.freeze({ mode: "demo", kind: "buy", simulationId: attempt.operationId,
        idempotencyKey, quote: attempt.quote, result: immutableCopy(response.simulation.result) });
      setSimulation(event); setStage("result");
      if (!delivered.current.has(event.simulationId)) {
        delivered.current.add(event.simulationId);
        // The controller still owns its accepted snapshot during this callback.
        try { listeners.current.onSimulationResult(event); }
        catch { /* Observer failure does not change the validated financial outcome. */ }
      }
      if (event.result.status === "simulated-success") {
        raw.current.fiatAmount = ""; setAmount("");
        try { listeners.current.onDraftChange?.(null); }
        catch { /* Preserve the terminal outcome and always release its host guard. */ }
      }
    } catch { if (task.current()) recover({ code: "unavailable" }); }
    finally { release(attempt); }
  }

  function editAmount() {
    if (accepted.current) return;
    invalidate(); setStage("amount");
  }

  function back() {
    if (accepted.current) return;
    if (stage === "review") editAmount();
    else if (stage === "amount") { invalidate(); setStage("method"); }
    else onBack(route);
  }

  return { loading, data, loadIssue, retryable: loadResult?.status === "error" && loadResult.retryable,
    retry: () => { if (!accepted.current) setLoadAttempt(value => value + 1); },
    stage, amount, method, methodId, quote: visibleQuote, simulation, issue, quoting,
    chooseMethod, changeAmount, continueMethod, requestQuote, submit, editAmount, back,
    close: () => { if (!accepted.current) onClose(); } };
}

function matchingDraft(route: BuyFlowProps["route"], draft: BuyDraft | null | undefined): BuyDraft | null {
  if (!draft?.route || commerceRouteKey(route) !== commerceRouteKey(draft.route) || typeof draft.fiatAmount !== "string" ||
      (draft.methodId !== null && typeof draft.methodId !== "string")) return null;
  return { route: { ...route }, methodId: draft.methodId, fiatAmount: draft.fiatAmount };
}

/** Copy before freezing: neither a mutable response nor a callback can rewrite acceptance. */
function immutableCopy<T>(value: T): T {
  const copy = structuredClone(value);
  function freeze(item: unknown) {
    if (item === null || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.freeze(item);
    Object.values(item).forEach(freeze);
  }
  freeze(copy); return copy;
}
