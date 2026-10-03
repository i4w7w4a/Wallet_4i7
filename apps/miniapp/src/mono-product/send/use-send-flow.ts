import { useEffect, useRef, useState } from "react";
import type { ProductActionRoute } from "@wallet/core";
import type { SendDemoResult, SendIssue, SendPort, SendQuote, SendRecipient, SendRequest, SendRouteData } from "./send-port";
import { validateAmount, validateQuote } from "./send-validation";
import { formDraft, matchingDraft, type SendFormOptions } from "./send-form";

type Stage = "recipient" | "amount" | "review" | "pending" | "result";
type Loaded = { port: SendPort; attempt: number; data: SendRouteData | null; issue: SendIssue | null };

export function useSendFlow(route: ProductActionRoute, port: SendPort, {
  initialDraft, onDraftChange, onSimulationResult,
}: SendFormOptions = {}) {
  const [seed] = useState(() => matchingDraft(route, initialDraft));
  const [restoredDraft, setRestoredDraft] = useState(seed !== null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [stage, setStage] = useState<Stage>("recipient");
  const [recipient, setRecipient] = useState<SendRecipient>(() => seed?.recipient ?? { address: "" });
  const [validatedRecipient, setValidatedRecipient] = useState<SendRecipient | null>(null);
  const [amount, setAmount] = useState(() => seed?.amount ?? "");
  const [quote, setQuote] = useState<SendQuote | null>(null);
  const [issue, setIssue] = useState<SendIssue | null>(null);
  const [working, setWorking] = useState<"recipient" | "quote" | "send" | null>(null);
  const [result, setResult] = useState<SendDemoResult | null>(null);
  const generation = useRef(0);
  const operation = useRef<AbortController | null>(null);
  const sendLocked = useRef(false);
  const observers = useRef({ onDraftChange, onSimulationResult });
  useEffect(() => { observers.current = { onDraftChange, onSimulationResult }; }, [onDraftChange, onSimulationResult]);
  const data = loaded?.port === port && loaded.attempt === loadAttempt ? loaded.data : null;
  const loading = loaded?.port !== port || loaded.attempt !== loadAttempt;
  const loadIssue = !loading ? loaded?.issue : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const value = port.mode === "demo" && route.action === "send"
          ? await port.loadRoute(route, { signal: controller.signal }) : null;
        if (!active) return;
        setLoaded({ port, attempt: loadAttempt, data: value, issue: value ? null : { code: "unsupported-route" } });
      } catch {
        if (active) setLoaded({ port, attempt: loadAttempt, data: null, issue: { code: "unavailable" } });
      } finally {
        // New port/rules invalidate authorization, while raw form input remains editable.
        if (active) {
          setStage("recipient"); setValidatedRecipient(null);
          setQuote(null); setIssue(null); setWorking(null); setResult(null);
          sendLocked.current = false;
        }
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      operation.current?.abort();
      generation.current += 1;
    };
  }, [route, port, loadAttempt]);

  useEffect(() => {
    if (!quote || stage === "pending" || stage === "result") return;
    const ticket = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    function check() {
      if (ticket !== generation.current) return;
      const remaining = quote!.expiresAt - Date.now();
      if (remaining > 0) { timer = setTimeout(check, Math.min(remaining, 2_147_483_647)); return; }
      setQuote(null); setIssue({ code: "expired-quote" }); setStage("amount");
    }
    timer = setTimeout(check, Math.max(0, Math.min(quote.expiresAt - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [quote, stage]);

  function nextOperation() {
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const ticket = ++generation.current;
    return { controller, current: () => ticket === generation.current && !controller.signal.aborted };
  }

  function invalidate() {
    generation.current += 1;
    operation.current?.abort();
    setQuote(null); setIssue(null); setWorking(null); setResult(null);
  }

  function changeRecipient(value: SendRecipient) {
    if (sendLocked.current) return;
    invalidate(); setRecipient(value); setValidatedRecipient(null);
    observers.current.onDraftChange?.(formDraft(route, value, amount));
  }

  function changeAmount(value: string) {
    if (sendLocked.current) return;
    invalidate(); setAmount(value);
    observers.current.onDraftChange?.(formDraft(route, recipient, value));
  }

  function startAgain() {
    if (sendLocked.current) return;
    invalidate(); setRecipient({ address: "" }); setValidatedRecipient(null); setAmount("");
    setStage("recipient"); setRestoredDraft(false);
    observers.current.onDraftChange?.(null);
  }

  function editRecipient() {
    if (sendLocked.current) return;
    invalidate(); setValidatedRecipient(null); setStage("recipient");
  }

  async function continueRecipient() {
    if (!data || working === "recipient" || sendLocked.current) return;
    if (!recipient.address.trim() || (data.recipient.memo?.required && !recipient.memo?.trim())) {
      setIssue({ code: "invalid-recipient" }); return;
    }
    const task = nextOperation();
    setWorking("recipient"); setIssue(null); setQuote(null);
    try {
      const validation = await port.validateRecipient(route, recipient, { signal: task.controller.signal });
      if (!task.current()) return;
      if (!validation.valid || !validation.recipient.address.trim() ||
          (data.recipient.memo?.required && !validation.recipient.memo?.trim())) setIssue({ code: "invalid-recipient" });
      else {
        setValidatedRecipient(validation.recipient); setRecipient(validation.recipient); setStage("amount");
        if (validation.recipient.address !== recipient.address || validation.recipient.memo !== recipient.memo) {
          observers.current.onDraftChange?.(formDraft(route, validation.recipient, amount));
        }
      }
    } catch {
      if (task.current()) setIssue({ code: "unavailable" });
    } finally { if (task.current()) setWorking(null); }
  }

  function currentRequest(): SendRequest | null {
    if (!data || !validatedRecipient) return null;
    const validation = validateAmount(amount, data.terms);
    if (!validation.valid) { setIssue(validation.issue); return null; }
    return { route, recipient: validatedRecipient, amount: validation.amount };
  }

  async function requestQuote() {
    if (sendLocked.current || !data || port.mode !== "demo") return;
    const request = currentRequest();
    if (!request) return;
    const task = nextOperation();
    setStage("amount"); setQuote(null); setIssue(null); setResult(null); setWorking("quote");
    try {
      const response = await port.quote(request, { signal: task.controller.signal });
      if (!task.current()) return;
      if (response.status === "unavailable") setIssue(response.issue);
      else {
        const problem = validateQuote(request, response.quote, Date.now());
        if (problem) setIssue(problem);
        else setQuote(response.quote);
      }
    } catch {
      if (task.current()) setIssue({ code: "unavailable" });
    } finally { if (task.current()) setWorking(null); }
  }

  function review() {
    if (!quote || sendLocked.current) return;
    const request = currentRequest();
    if (!request) return;
    const problem = validateQuote(request, quote, Date.now());
    if (problem) { setQuote(null); setIssue(problem); return; }
    setStage("review"); setIssue(null);
  }

  async function submit() {
    if (sendLocked.current || stage !== "review" || !quote || port.mode !== "demo") return;
    const request = currentRequest();
    if (!request) return;
    const problem = validateQuote(request, quote, Date.now());
    if (problem) { setQuote(null); setIssue(problem); setStage("amount"); return; }
    // Ref lock closes the same-event gap before React renders disabled controls.
    sendLocked.current = true;
    const task = nextOperation();
    setStage("pending"); setWorking("send"); setIssue(null);
    let accepted: SendDemoResult;
    let simulationId: string | null = null;
    try {
      simulationId = `demo:${quote.id}:${crypto.randomUUID()}`;
      const response = await port.send({ quote, idempotencyKey: simulationId },
        { signal: task.controller.signal });
      if (!task.current()) return;
      accepted = response.mode === "demo" && (response.status === "simulated-success" || response.status === "simulated-failure")
        ? response : { mode: "demo", status: "simulated-failure", reason: "unavailable" };
    } catch {
      accepted = { mode: "demo", status: "simulated-failure", reason: "unavailable" };
    }
    if (!task.current()) return;
    setResult(accepted); sendLocked.current = false; setWorking(null); setStage("result");
    // Event-driven, never replayed by renders/effects. Observer errors cannot rewrite the result.
    if (simulationId !== null) {
      observers.current.onSimulationResult?.({ simulationId, route: { ...route }, quantity: request.amount, result: { ...accepted } });
    }
  }

  function back(onBack: () => void) {
    if (sendLocked.current) return;
    if (stage === "review") setStage("amount");
    else if (stage === "amount") editRecipient();
    else onBack();
  }

  return { data, loading, loadIssue, loadAgain: () => setLoadAttempt(value => value + 1), stage,
    restoredDraft, startAgain,
    recipient, validatedRecipient, amount, quote, issue, working, result, changeRecipient, changeAmount,
    editRecipient, continueRecipient, requestQuote, review, submit, back };
}
