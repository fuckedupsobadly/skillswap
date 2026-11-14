"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { bookSession } from "@/app/actions/booking";
import { MEMBER_FLOOR_MIN } from "@/modules/ledger/core";
import { formatHours, formatMinutes } from "@/modules/platform/format";
import { ChoiceRow } from "@/ui/choice";
import { FormError } from "@/ui/field";
import { village } from "@/ui/village/store";

const dayKey = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
const dayLabel = (iso: string, tz: string) => {
  const d = new Date(iso);
  const wd = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz }).format(d);
  const n = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(d);
  return `${wd} ${n}`;
};
const time = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(
    new Date(iso),
  );
const isNow = (iso: string) => Date.parse(iso) - Date.now() < 10 * 60_000;

/**
 * The booking scroll (§8.4). Length, Day, Time in your timezone with their time underneath, then the cost
 * written plainly: held now, paid only after you both confirm. The one gold button says exactly what happens.
 */
export function BookingForm(props: {
  offerId: string;
  requestId: string | null;
  lengths: number[];
  defaultLength: number;
  slotsByLength: Record<number, string[]>;
  initialAt: string | null;
  wantNow: boolean;
  myTz: string;
  theirTz: string;
  theirName: string;
  balanceMin: number;
  note: string | null;
}) {
  const router = useRouter();
  const [length, setLength] = useState(props.defaultLength);
  const slots = props.slotsByLength[length] ?? [];
  const pickInitial = (list: string[]) => {
    if (props.initialAt) {
      const want = Date.parse(props.initialAt);
      const hit = list.find((s) => Date.parse(s) === want) ?? list.find((s) => Date.parse(s) >= want);
      if (hit) return hit;
    }
    if (props.wantNow && list[0] && isNow(list[0])) return list[0];
    return list[0] ?? null;
  };
  const [slot, setSlot] = useState<string | null>(() => pickInitial(slots));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const days = useMemo(() => {
    const m = new Map<string, { label: string; slots: string[] }>();
    for (const s of slots) {
      const k = dayKey(s, props.myTz);
      if (!m.has(k)) m.set(k, { label: dayLabel(s, props.myTz), slots: [] });
      m.get(k)!.slots.push(s);
    }
    return [...m.entries()];
  }, [slots, props.myTz]);
  const day = slot ? dayKey(slot, props.myTz) : days[0]?.[0];
  const times = days.find(([k]) => k === day)?.[1].slots ?? [];
  const sameTz =
    props.myTz === props.theirTz || (slot ? time(slot, props.myTz) === time(slot, props.theirTz) : true);
  const after = props.balanceMin - length;
  const tooLow = after < MEMBER_FLOOR_MIN;
  const cost = formatHours(length);
  const nowMissing = props.wantNow && !(slots[0] && isNow(slots[0]));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!slot) return;
        start(async () => {
          setError(null);
          const res = await bookSession({
            offerId: props.offerId,
            startsAt: slot,
            lengthMin: length,
            requestId: props.requestId,
          });
          if (!res.ok) return setError(res.error);
          village.command({ c: "reload" });
          router.replace(`/sessions/${res.data.id}`);
        });
      }}
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-[72px_1fr] items-center gap-3">
          <span aria-hidden className="font-pixel text-label">
            Length
          </span>
          <ChoiceRow
            name="length"
            legend="Length"
            value={length}
            options={props.lengths.map((l) => ({
              value: l,
              label: <span className="tnum font-sans">{formatMinutes(l)}</span>,
            }))}
            onChange={(l) => {
              setLength(l);
              setSlot(pickInitial(props.slotsByLength[l] ?? []));
            }}
          />
        </div>

        {slots.length === 0 ? (
          <p className="text-ink-soft">
            No time you've both marked free in the next 7 days. Leave {props.theirName} a note, or widen your
            hours in your hut.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[72px_1fr] items-center gap-3">
              <span aria-hidden className="font-pixel text-label">
                Day
              </span>
              <ChoiceRow
                name="day"
                legend="Day"
                value={day ?? null}
                options={days.map(([k, d]) => ({
                  value: k,
                  label: <span className="tnum font-sans">{d.label}</span>,
                }))}
                onChange={(k) => setSlot(days.find(([x]) => x === k)?.[1].slots[0] ?? null)}
              />
            </div>
            <div className="grid grid-cols-[72px_1fr] items-start gap-3">
              <span aria-hidden className="flex min-h-11 items-center font-pixel text-label">
                Time
              </span>
              <div className="grid gap-1">
                <div className="flex flex-wrap items-start gap-1">
                  <ChoiceRow
                    name="time"
                    legend="Time, in your timezone"
                    value={slot}
                    className="flex-1"
                    options={times.map((s) => ({
                      value: s,
                      aria: isNow(s) ? `Now, ${time(s, props.myTz)}` : undefined,
                      label: <span className="tnum font-sans">{isNow(s) ? "Now" : time(s, props.myTz)}</span>,
                    }))}
                    onChange={setSlot}
                  />
                  <span className="flex min-h-11 items-center pl-2 text-meta text-ink-soft">(your time)</span>
                </div>
                {slot ? (
                  <p className="tnum px-3 text-meta text-ink-soft" aria-live="polite">
                    {sameTz
                      ? `Same time for ${props.theirName}`
                      : `= ${time(slot, props.theirTz)} for ${props.theirName}`}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
        {nowMissing && slots.length ? (
          <p className="text-meta text-ink-soft">
            {props.theirName} is free now, but nothing fits right now in hours you've both marked free. The
            earliest is below.
          </p>
        ) : null}
        {props.note ? <p className="text-meta text-ink-soft">{props.note}</p> : null}
      </div>

      <div className="divider grid gap-4 pt-5">
        <p>
          <span className="tnum font-medium">Cost {cost}</span>
          <span className="text-ink-soft"> · held now, paid after you both confirm</span>
        </p>
        <FormError
          message={
            tooLow
              ? `Not enough hours: booking can take you down to ${formatHours(MEMBER_FLOOR_MIN)} at most. Teach a session to earn more.`
              : error
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-meta text-ink-soft">
            Free to cancel until 12 h before. If it doesn't happen, the hours come back.
          </p>
          <button type="submit" className="btn btn-primary ml-auto" disabled={pending || !slot || tooLow}>
            {pending ? "Holding…" : `Hold ${cost} and book`}
          </button>
        </div>
      </div>
    </form>
  );
}
