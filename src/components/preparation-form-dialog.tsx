import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, type NewPreparation, type PaceGroup, type PreparationDetail, type PreparationUpdate } from "@/lib/api-client";
import {
  DEFAULT_DISTANCE_KM, DEFAULT_PACE_SEC, DEFAULT_RULES, MAX_RULES, MAX_RUNS_PER_WEEK, MAX_WEEKS, PACE_GROUPS,
  PACE_GROUP_META, PACE_STEP_PER_WEEK, computeWeeks, formatKm, formatPace, formatShortRange, isValidKm, isValidPace,
  parseKm, parsePace, type PlanWeek,
} from "@/lib/preparation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NumberField } from "@/components/number-field";

type Props =
  | { mode: "create"; onSaved: (id: number) => void }
  | { mode: "edit"; preparation: PreparationDetail; onSaved: () => void };

// Wie viele Wochen bzw. Regeln auf eine Dialogseite passen, ohne dass sie scrollen muss.
const WEEKS_PER_PAGE = 4;
const RULES_PER_PAGE = 4;
const DEFAULT_RUNS_PER_WEEK = 2;

// Wie im Ereignis-Dialog: iPhone-Safari gibt Datumsfeldern sonst eine eigene Mindestbreite.
const DATE_INPUT = "appearance-none min-w-0 [&::-webkit-date-and-time-value]:text-left";
const CELL_INPUT = "h-9 px-1 text-center tabular-nums";

type Page =
  | { kind: "basics" }
  | { kind: "distances"; from: number; to: number }
  | { kind: "paces"; from: number; to: number }
  | { kind: "rules"; from: number; to: number };

type PaceInputs = Record<PaceGroup, string>;

// Vorbelegung für alle möglichen Wochen/Läufe – genutzt werden nur die ersten n.
const defaultDistances = () =>
  Array.from({ length: MAX_WEEKS }, () => Array.from({ length: MAX_RUNS_PER_WEEK }, () => formatKm(DEFAULT_DISTANCE_KM)));
const defaultPaces = (): PaceInputs[] =>
  Array.from({ length: MAX_WEEKS }, (_, w) => ({
    A: formatPace(DEFAULT_PACE_SEC.A - w * PACE_STEP_PER_WEEK),
    B: formatPace(DEFAULT_PACE_SEC.B - w * PACE_STEP_PER_WEEK),
    C: formatPace(DEFAULT_PACE_SEC.C - w * PACE_STEP_PER_WEEK),
  }));

const chunks = (count: number, size: number) =>
  Array.from({ length: Math.max(1, Math.ceil(count / size)) }, (_, i) => ({ from: i * size, to: Math.min(count, (i + 1) * size) }));

// Dialog zum Anlegen und Bearbeiten einer Vorbereitung. Statt zu scrollen verteilt er sich auf
// mehrere Seiten (wischen oder Weiter/Zurück, Punkte unten zeigen die Seite):
// Grunddaten → Distanzen je Lauf → Pace je Gruppe → Regeln. Lange Pläne bekommen mehr Seiten.
// Beim Bearbeiten sind Mannschaft, Zeitraum und Läufe pro Woche fest.
export function PreparationFormDialog(props: Props) {
  const isEdit = props.mode === "edit";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [runs, setRuns] = useState(DEFAULT_RUNS_PER_WEEK);
  const [distances, setDistances] = useState<string[][]>(defaultDistances);
  const [paces, setPaces] = useState<PaceInputs[]>(defaultPaces);
  const [rules, setRules] = useState<string[]>(DEFAULT_RULES);
  const [showErrors, setShowErrors] = useState(false);
  const [page, setPage] = useState(0);
  const [emblaRef, embla] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps" });

  const groupsQ = useQuery({ queryKey: ["groups"], queryFn: () => api.groups.list(), enabled: open && !isEdit });

  const weeks: PlanWeek[] = useMemo(() => {
    if (props.mode === "edit") {
      return props.preparation.weeks.map((w) => ({ number: w.number, start: new Date(w.starts_at), end: new Date(w.ends_at) }));
    }
    return computeWeeks(startDate, endDate);
  }, [props, startDate, endDate]);
  const tooLong = weeks.length > MAX_WEEKS;
  const planWeeks = tooLong ? [] : weeks;

  const pages: Page[] = useMemo(() => [
    { kind: "basics" },
    ...chunks(planWeeks.length, WEEKS_PER_PAGE).map((c) => ({ kind: "distances" as const, ...c })),
    ...chunks(planWeeks.length, WEEKS_PER_PAGE).map((c) => ({ kind: "paces" as const, ...c })),
    ...chunks(rules.length, RULES_PER_PAGE).map((c) => ({ kind: "rules" as const, ...c })),
  ], [planWeeks.length, rules.length]);

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setPage(embla.selectedScrollSnap());
    embla.on("select", onSelect).on("reInit", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect).off("reInit", onSelect);
    };
  }, [embla]);

  const reset = () => {
    setTitle(""); setGroupId(""); setStartDate(""); setEndDate(""); setRuns(DEFAULT_RUNS_PER_WEEK);
    setDistances(defaultDistances()); setPaces(defaultPaces()); setRules(DEFAULT_RULES);
    setShowErrors(false); setPage(0);
  };

  const onOpenChange = (next: boolean) => {
    // Beim Bearbeiten immer den aktuellen Stand übernehmen.
    if (next && props.mode === "edit") {
      const p = props.preparation;
      setTitle(p.title);
      setGroupId(String(p.group.id));
      setStartDate(p.start_date);
      setEndDate(p.end_date);
      setRuns(p.runs_per_week);
      const d = defaultDistances();
      const pc = defaultPaces();
      p.weeks.forEach((w, i) => {
        w.units.forEach((u, r) => { d[i][r] = formatKm(Number(u.distance_km)); });
        pc[i] = { A: formatPace(w.pace.A), B: formatPace(w.pace.B), C: formatPace(w.pace.C) };
      });
      setDistances(d);
      setPaces(pc);
      setRules(p.rules.length ? p.rules : [""]);
      setShowErrors(false);
      setPage(0);
    }
    // Beim Öffnen wird das Karussell neu aufgebaut und startet auf Seite 1.
    setOpen(next);
  };

  const setDistance = (w: number, r: number, v: string) =>
    setDistances((ds) => ds.map((row, i) => (i === w ? row.map((x, j) => (j === r ? v : x)) : row)));
  const setPace = (w: number, g: PaceGroup, v: string) =>
    setPaces((ps) => ps.map((row, i) => (i === w ? { ...row, [g]: v } : row)));
  const setRule = (i: number, v: string) => setRules((rs) => rs.map((x, j) => (j === i ? v : x)));
  const addRule = () => {
    setRules((rs) => [...rs, ""]);
    // Neue Regel kann auf einer neuen Seite landen – dorthin wischen, sobald sie existiert.
    requestAnimationFrame(() => embla?.scrollTo(embla.scrollSnapList().length - 1));
  };
  const removeRule = (i: number) => setRules((rs) => (rs.length <= 1 ? [""] : rs.filter((_, j) => j !== i)));

  // Erste fehlerhafte Seite und Meldung – null, wenn alles passt.
  const validate = (): { page: number; message: string } | null => {
    const pageOf = (kind: Page["kind"], index = 0) =>
      pages.findIndex((p) => p.kind === kind && (p.kind === "basics" || (index >= p.from && index < p.to)));
    if (!title.trim()) return { page: 0, message: "Bitte gib der Vorbereitung einen Namen" };
    if (title.trim().length > 60) return { page: 0, message: "Der Name ist zu lang (max. 60 Zeichen)" };
    if (!groupId) return { page: 0, message: "Bitte wähle eine Mannschaft" };
    if (!startDate || !endDate) return { page: 0, message: "Bitte wähle den Zeitraum" };
    if (endDate < startDate) return { page: 0, message: "Das Enddatum darf nicht vor dem Startdatum liegen" };
    if (tooLong) return { page: 0, message: `Eine Vorbereitung darf höchstens ${MAX_WEEKS} Wochen lang sein` };
    for (let w = 0; w < planWeeks.length; w++) {
      for (let r = 0; r < runs; r++) {
        if (!isValidKm(parseKm(distances[w][r]))) return { page: pageOf("distances", w), message: `Woche ${w + 1}, Lauf ${r + 1}: Distanz zwischen 0,5 und 50 km angeben` };
      }
    }
    for (let w = 0; w < planWeeks.length; w++) {
      for (const g of PACE_GROUPS) {
        if (!isValidPace(parsePace(paces[w][g]))) return { page: pageOf("paces", w), message: `Woche ${w + 1}, Gruppe ${g}: Pace zwischen 3:00 und 12:00 angeben (z. B. 5:45)` };
      }
    }
    const longRule = rules.findIndex((r) => r.trim().length > 200);
    if (longRule >= 0) return { page: pageOf("rules", longRule), message: "Eine Regel ist zu lang (max. 200 Zeichen)" };
    return null;
  };

  const weekPlan = (w: number) => ({
    distancesKm: distances[w].slice(0, runs).map((d) => parseKm(d)!),
    paceASec: parsePace(paces[w].A)!,
    paceBSec: parsePace(paces[w].B)!,
    paceCSec: parsePace(paces[w].C)!,
  });
  const cleanRules = () => rules.map((r) => r.trim()).filter(Boolean);

  const m = useMutation({
    mutationFn: async () => {
      if (props.mode === "edit") {
        const body: PreparationUpdate = { title: title.trim(), rules: cleanRules(), weeks: planWeeks.map((_, w) => weekPlan(w)) };
        await api.preparations.update(props.preparation.id, body);
        return { id: props.preparation.id, count: 0 };
      }
      const body: NewPreparation = {
        title: title.trim(),
        groupId: Number(groupId),
        startDate,
        endDate,
        runsPerWeek: runs,
        rules: cleanRules(),
        weeks: planWeeks.map((wk, w) => ({ startsAt: wk.start.toISOString(), endsAt: wk.end.toISOString(), ...weekPlan(w) })),
      };
      return api.preparations.create(body);
    },
    onSuccess: (res) => {
      setOpen(false);
      if (props.mode === "edit") {
        toast.success("Vorbereitung gespeichert");
        props.onSaved();
      } else {
        toast.success(`Vorbereitung erstellt · ${res.count} Ereignisse`);
        reset();
        props.onSaved(res.id);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = () => {
    const error = validate();
    if (error) {
      setShowErrors(true);
      embla?.scrollTo(Math.max(0, error.page));
      toast.error(error.message);
      return;
    }
    m.mutate();
  };

  const isLast = page >= pages.length - 1;
  const current = pages[Math.min(page, pages.length - 1)];
  const subtitle = (() => {
    const range = (p: { from: number; to: number }) => (planWeeks.length > WEEKS_PER_PAGE ? ` · Woche ${p.from + 1}–${p.to}` : "");
    switch (current.kind) {
      case "basics": return "Name, Mannschaft und Zeitraum";
      case "distances": return `Distanz je Lauf in km${range(current)}`;
      case "paces": return `Pace je Gruppe in min/km${range(current)}`;
      case "rules": return "Regeln für alle Spieler (Stichpunkte)";
    }
  })();

  const invalid = (bad: boolean) => (showErrors && bad ? "border-destructive focus-visible:ring-destructive" : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="icon" title="Bearbeiten"><Pencil className="h-4 w-4" /></Button>
        ) : (
          <Button className="shadow-glow"><Plus className="h-4 w-4 mr-1" /> Vorbereitung</Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex flex-col max-w-lg w-[calc(100%-2rem)] h-[min(620px,90dvh)] rounded-xl p-4 sm:p-6 gap-4">
        <DialogHeader className="text-left pr-6">
          <DialogTitle>{isEdit ? "Vorbereitung bearbeiten" : "Neue Vorbereitung"}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <div ref={emblaRef} className="overflow-hidden flex-1 min-h-0 -mx-1">
          <div className="flex h-full">
            {pages.map((pg, i) => (
              // Die Seiten sind so bemessen, dass sie nicht scrollen – nur auf sehr kleinen Displays als Notlösung.
              <section key={`${pg.kind}-${i}`} className="min-w-0 shrink-0 grow-0 basis-full h-full overflow-y-auto overflow-x-hidden px-1 py-0.5" aria-label={`Seite ${i + 1} von ${pages.length}`}>
                {pg.kind === "basics" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="prep-title">Name der Vorbereitung</Label>
                      <Input id="prep-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Winter2026" className={invalid(!title.trim())} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mannschaft</Label>
                      {isEdit ? (
                        <Input value={props.mode === "edit" ? props.preparation.group.name : ""} disabled />
                      ) : (
                        <Select value={groupId} onValueChange={setGroupId}>
                          <SelectTrigger className={invalid(!groupId)}><SelectValue placeholder="Wählen…" /></SelectTrigger>
                          <SelectContent>
                            {(groupsQ.data ?? []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="prep-start">Von</Label>
                        <Input id="prep-start" type="date" value={startDate} disabled={isEdit} onChange={(e) => setStartDate(e.target.value)} className={cn(DATE_INPUT, invalid(!startDate))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prep-end">Bis</Label>
                        <Input id="prep-end" type="date" value={endDate} min={startDate || undefined} disabled={isEdit} onChange={(e) => setEndDate(e.target.value)} className={cn(DATE_INPUT, invalid(!endDate || endDate < startDate))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Läufe pro Woche</Label>
                      {isEdit ? <Input value={runs} disabled /> : <NumberField min={1} max={MAX_RUNS_PER_WEEK} value={runs} onChange={setRuns} />}
                    </div>
                    <div className={`rounded-lg p-3 text-sm ${tooLong ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                      {tooLong
                        ? `Der Zeitraum ist zu lang – höchstens ${MAX_WEEKS} Wochen.`
                        : planWeeks.length === 0
                          ? "Wähle den Zeitraum. Woche 1 beginnt am Startdatum, jede Woche endet sonntags um 23:59."
                          : <><span className="font-semibold text-foreground">{planWeeks.length} {planWeeks.length === 1 ? "Woche" : "Wochen"} · {planWeeks.length * runs} Ereignisse</span><br />Jede Woche endet sonntags um 23:59, die letzte am Enddatum.</>}
                    </div>
                  </div>
                )}

                {pg.kind === "distances" && (planWeeks.length === 0 ? <NeedsPeriod /> : (
                  <div className="space-y-2">
                    <div className="grid items-center gap-1.5 text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `4rem repeat(${runs}, minmax(0, 1fr)) 3rem` }}>
                      <span>Woche</span>
                      {Array.from({ length: runs }, (_, r) => <span key={r} className="text-center">Lauf {r + 1}</span>)}
                      <span className="text-right">Σ km</span>
                    </div>
                    {planWeeks.slice(pg.from, pg.to).map((wk) => {
                      const w = wk.number - 1;
                      const sum = distances[w].slice(0, runs).reduce((s, d) => s + (parseKm(d) ?? 0), 0);
                      return (
                        <div key={w} className="grid items-center gap-1.5" style={{ gridTemplateColumns: `4rem repeat(${runs}, minmax(0, 1fr)) 3rem` }}>
                          <div className="leading-tight">
                            <div className="text-sm font-semibold">W{wk.number}</div>
                            <div className="text-[10px] text-muted-foreground">{formatShortRange(wk.start, wk.end)}</div>
                          </div>
                          {Array.from({ length: runs }, (_, r) => (
                            <Input key={r} inputMode="decimal" value={distances[w][r]} aria-label={`Woche ${wk.number}, Lauf ${r + 1} in km`}
                              onChange={(e) => setDistance(w, r, e.target.value)} className={cn(CELL_INPUT, invalid(!isValidKm(parseKm(distances[w][r]))))} />
                          ))}
                          <span className="text-right text-sm font-semibold tabular-nums">{formatKm(sum)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {pg.kind === "paces" && (planWeeks.length === 0 ? <NeedsPeriod /> : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[4rem_repeat(3,minmax(0,1fr))] items-end gap-1.5 text-xs font-medium text-muted-foreground">
                      <span>Woche</span>
                      {PACE_GROUPS.map((g) => (
                        <span key={g} className="min-w-0 text-center leading-tight">
                          <span className="block text-foreground font-semibold">{g}</span>
                          <span className="block truncate text-[10px]">{PACE_GROUP_META[g].name}</span>
                        </span>
                      ))}
                    </div>
                    {planWeeks.slice(pg.from, pg.to).map((wk) => {
                      const w = wk.number - 1;
                      return (
                        <div key={w} className="grid grid-cols-[4rem_repeat(3,minmax(0,1fr))] items-center gap-1.5">
                          <div className="leading-tight">
                            <div className="text-sm font-semibold">W{wk.number}</div>
                            <div className="text-[10px] text-muted-foreground">{formatShortRange(wk.start, wk.end)}</div>
                          </div>
                          {PACE_GROUPS.map((g) => (
                            <Input key={g} inputMode="decimal" value={paces[w][g]} placeholder="5:45" aria-label={`Woche ${wk.number}, Gruppe ${g} in min/km`}
                              onChange={(e) => setPace(w, g, e.target.value)} className={cn(CELL_INPUT, invalid(!isValidPace(parsePace(paces[w][g]))))} />
                          ))}
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground pt-1">Format m:ss, z. B. 5:45. Jeder Spieler sieht nur die Pace seiner Gruppe.</p>
                  </div>
                ))}

                {pg.kind === "rules" && (
                  <div className="space-y-2">
                    {rules.slice(pg.from, pg.to).map((rule, k) => {
                      const i = pg.from + k;
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shrink-0" aria-hidden />
                          {/* Vier Zeilen, damit auch lange Regeln ganz lesbar sind – vier passen ohne Scrollen auf eine Seite. */}
                          <Textarea value={rule} maxLength={200} rows={4} placeholder="Neue Regel…" aria-label={`Regel ${i + 1}`}
                            onChange={(e) => setRule(i, e.target.value)} className={cn("min-h-0 h-[5.5rem] resize-none py-1.5 text-sm leading-snug", invalid(rule.trim().length > 200))} />
                          <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9" title="Regel entfernen" onClick={() => removeRule(i)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                    {pg.to === rules.length && rules.length < MAX_RULES && (
                      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRule}>
                        <Plus className="h-4 w-4 mr-1" /> Regel hinzufügen
                      </Button>
                    )}
                    {pg.to === rules.length && (
                      <p className="text-xs text-muted-foreground">Die Spieler sehen die Regeln als Stichpunkte über ihren Vorbereitungs-Ereignissen.</p>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => embla?.scrollPrev()} disabled={page === 0}>Zurück</Button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Dialogseiten">
            {pages.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === page} aria-label={`Seite ${i + 1}`}
                onClick={() => embla?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground"}`} />
            ))}
          </div>
          {isLast ? (
            <Button type="button" onClick={submit} disabled={m.isPending}>{isEdit ? "Speichern" : "Erstellen"}</Button>
          ) : (
            <Button type="button" onClick={() => embla?.scrollNext()}>Weiter</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NeedsPeriod() {
  return (
    <div className="h-full grid place-items-center text-center text-sm text-muted-foreground px-6">
      Wähle auf der ersten Seite zuerst den Zeitraum – danach stehen hier die Wochen.
    </div>
  );
}
