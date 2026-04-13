import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Pencil, Plus, Trash2, Clock, Users } from "lucide-react";

interface Client {
  id: string;
  name: string;
}

interface ShiftSetting {
  id: string;
  campaign_id: string;
  shift_name: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  grace_minutes: number;
  days_of_week: number[] | null; // ISO 1=Mon ... 7=Sun
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

function fmtTime(t: string | undefined): string {
  if (!t) return "—";
  // accept HH:MM:SS or HH:MM
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const display = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${display}:${m} ${ampm}`;
}

function dayChips(days: number[] | null): string {
  if (!days || days.length === 0) return "All days";
  // weekday (1-5) = "Mon-Fri"; weekend (6,7) = "Sat-Sun"; else list
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.join() === "1,2,3,4,5") return "Mon-Fri";
  if (sorted.length === 2 && sorted.join() === "6,7") return "Sat-Sun";
  if (sorted.length === 7) return "All days";
  return sorted.map((d) => DAY_NAMES[d - 1]).join(", ");
}

export default function ShiftSettings() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{
    campaign: Client;
    shift: Partial<ShiftSetting> | null;
  } | null>(null);

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["all-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data || []) as Client[];
    },
  });

  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["all-shift-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_settings")
        .select("*")
        .order("shift_name");
      if (error) throw error;
      return (data || []) as ShiftSetting[];
    },
  });

  // Headcount per campaign so we can show "applies to N employees"
  const { data: headcounts = {} } = useQuery({
    queryKey: ["campaign-headcounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("client_id")
        .eq("status", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        const id = (row as { client_id: string | null }).client_id;
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
      return counts;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["all-shift-settings"] });

  const upsertMutation = useMutation({
    mutationFn: async (shift: Partial<ShiftSetting>) => {
      const payload: Record<string, unknown> = {
        campaign_id: shift.campaign_id,
        shift_name: shift.shift_name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        grace_minutes: shift.grace_minutes ?? 10,
        days_of_week: shift.days_of_week,
      };
      if (shift.id) {
        const { error } = await supabase
          .from("shift_settings")
          .update(payload)
          .eq("id", shift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shift_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_settings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Shift Settings</h2>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              Only administrators can manage shift settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadingClients || loadingShifts) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const shiftsByCampaign = new Map<string, ShiftSetting[]>();
  for (const s of shifts) {
    const arr = shiftsByCampaign.get(s.campaign_id) || [];
    arr.push(s);
    shiftsByCampaign.set(s.campaign_id, arr);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Shift Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure shift times per campaign. The timeclock uses these to
          calculate lateness and auto-clockout.
        </p>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-4 flex items-start gap-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            Shifts are set <strong>per campaign</strong>, not per employee. When
            you change "SLOC Weekday" hours, it applies to{" "}
            <strong>every active employee</strong> on that campaign for the days
            you've selected. Need different hours for someone? Add a second
            shift (e.g. "Weekend") with different days.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {clients.map((c) => {
          const list = shiftsByCampaign.get(c.id) || [];
          const headcount = headcounts[c.id] || 0;
          return (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {c.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Applies to {headcount} active{" "}
                      {headcount === 1 ? "employee" : "employees"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({
                        campaign: c,
                        shift: {
                          campaign_id: c.id,
                          shift_name: "Standard",
                          start_time: "09:00",
                          end_time: "18:00",
                          grace_minutes: 10,
                          days_of_week: [1, 2, 3, 4, 5],
                        },
                      })
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add Shift
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No shifts yet. Click "Add Shift" to set one up.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{s.shift_name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                            <span>
                              {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                            </span>
                            <span className="text-xs">·</span>
                            <Badge variant="outline" className="text-xs">
                              {dayChips(s.days_of_week)}
                            </Badge>
                            <span className="text-xs">·</span>
                            <span className="text-xs">
                              {s.grace_minutes} min grace
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditing({ campaign: c, shift: s })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete "${s.shift_name}"? This affects all ${headcount} ${
                                    headcount === 1 ? "employee" : "employees"
                                  } on ${c.name}.`,
                                )
                              ) {
                                deleteMutation.mutate(s.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <ShiftEditDialog
          campaign={editing.campaign}
          shift={editing.shift}
          headcount={headcounts[editing.campaign.id] || 0}
          onClose={() => setEditing(null)}
          onSave={(s) => upsertMutation.mutate(s)}
          saving={upsertMutation.isPending}
          error={upsertMutation.error as Error | null}
        />
      )}
    </div>
  );
}

function ShiftEditDialog({
  campaign,
  shift,
  headcount,
  onClose,
  onSave,
  saving,
  error,
}: {
  campaign: Client;
  shift: Partial<ShiftSetting> | null;
  headcount: number;
  onClose: () => void;
  onSave: (s: Partial<ShiftSetting>) => void;
  saving: boolean;
  error: Error | null;
}) {
  const [name, setName] = useState(shift?.shift_name || "");
  const [start, setStart] = useState((shift?.start_time || "").slice(0, 5));
  const [end, setEnd] = useState((shift?.end_time || "").slice(0, 5));
  const [grace, setGrace] = useState(shift?.grace_minutes ?? 10);
  const [days, setDays] = useState<number[]>(shift?.days_of_week || [1, 2, 3, 4, 5]);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {shift?.id ? "Edit" : "Add"} Shift — {campaign.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Changes apply to all {headcount} active{" "}
            {headcount === 1 ? "employee" : "employees"} on {campaign.name}.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="shift-name">Shift Name</Label>
            <Input
              id="shift-name"
              placeholder="e.g. Weekday, Weekend, Standard"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start">Start Time</Label>
              <Input
                id="start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end">End Time</Label>
              <Input
                id="end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Days</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DAY_VALUES.map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleDay(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    days.includes(v)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70"
                  }`}
                >
                  {DAY_NAMES[i]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="grace">Grace Period (minutes)</Label>
            <Input
              id="grace"
              type="number"
              min={0}
              max={60}
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many minutes after start time before someone counts as late.
            </p>
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error.message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...shift,
                shift_name: name,
                start_time: start,
                end_time: end,
                grace_minutes: grace,
                days_of_week: days,
              })
            }
            disabled={saving || !name || !start || !end}
          >
            {saving ? "Saving..." : "Save Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
