import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { todayLocal } from "@/lib/localDate";

export interface KPIField {
  id: string;
  campaign_id: string;
  field_name: string;
  field_label: string;
  field_type: "number" | "boolean" | "text" | "dropdown";
  min_target: number | null;
  display_order: number;
  is_active: boolean;
  dropdown_options: string[] | null;
  is_required: boolean;
}

export type FormValues = Record<string, string | number | boolean>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  campaignId: string;
  campaignName?: string;
  kpiFields: KPIField[];
  /** Called after EOD submission succeeds — parent should fire the actual clock-out. */
  onSubmitted: () => void;
  /** When set, the dialog submits an EOD for this date instead of today and
   *  marks the time_clock row as eod_completed. No clock-out side-effect. */
  backfillDate?: string;
  /** When set, the dialog edits an existing EOD log row instead of inserting. */
  amendLogId?: string;
  /** Pre-filled metric values for amend mode. */
  initialValues?: FormValues;
  /** Pre-filled notes for amend mode. */
  initialNotes?: string;
}

/**
 * Pre-clock-out dialog. Agent must answer every required campaign KPI field
 * before the clock-out is recorded. The caller is responsible for:
 *  - Only rendering this when kpiFields.length > 0 and no EOD submitted today.
 *  - Firing the actual clock-out mutation in onSubmitted.
 *
 * Also supports amend mode (amendLogId) for editing existing EODs.
 */
export function ClockOutEODDialog({
  open,
  onOpenChange,
  employeeId,
  campaignId,
  campaignName,
  kpiFields,
  onSubmitted,
  backfillDate,
  amendLogId,
  initialValues,
  initialNotes,
}: Props) {
  const [values, setValues] = useState<FormValues>({});
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize defaults (or pre-fill for amend mode)
  useEffect(() => {
    if (amendLogId && initialValues) {
      setValues(initialValues);
      setNotes(initialNotes ?? "");
    } else {
      const initial: FormValues = {};
      kpiFields.forEach((f) => {
        initial[f.field_name] = f.field_type === "boolean" ? false : "";
      });
      setValues(initial);
      setNotes("");
    }
    setErrors({});
  }, [kpiFields, amendLogId, initialValues, initialNotes]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (amendLogId) {
        // Amend mode: update existing row via RPC
        const { error } = await supabase.rpc("amend_eod_log", {
          p_log_id: amendLogId,
          p_metrics: values,
          p_notes: notes || null,
        });
        if (error) throw error;
      } else {
        // Insert mode (backfill uses backfillDate, normal uses today)
        const date = backfillDate ?? todayLocal();
        const { error } = await supabase.from("eod_logs").insert({
          employee_id: employeeId,
          date,
          campaign_id: campaignId,
          metrics: values,
          notes: notes || null,
        });
        if (error) throw error;

        if (backfillDate) {
          const { error: tcErr } = await supabase
            .from("time_clock")
            .update({ eod_completed: true })
            .eq("employee_id", employeeId)
            .eq("date", backfillDate);
          if (tcErr) throw tcErr;
        }
      }
    },
    onSuccess: () => {
      onSubmitted();
    },
  });

  const handleChange = (name: string, value: string | number | boolean) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    kpiFields.forEach((f) => {
      if (!f.is_required) return;
      const v = values[f.field_name];
      if (f.field_type === "boolean") return; // switch always has a value
      if (f.field_type === "number") {
        if (v === "" || v === null || v === undefined || Number.isNaN(v as number)) {
          next[f.field_name] = "Required";
        }
      } else {
        if (typeof v !== "string" || v.trim() === "") {
          next[f.field_name] = "Required";
        }
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    submitMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitMutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{amendLogId ? "Edit EOD Report" : backfillDate ? "Backfill EOD Report" : "End of Day Report"}</DialogTitle>
          <DialogDescription>
            {amendLogId
              ? <>Update your submitted numbers{campaignName ? <> for {campaignName}</> : null}.</>
              : backfillDate
              ? <>Submit your numbers for {new Date(`${backfillDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.</>

              : campaignName ? <>Submit your {campaignName} numbers to clock out.</> : <>Submit your numbers to clock out.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {kpiFields.map((field) => {
            const value = values[field.field_name];
            const hasError = !!errors[field.field_name];
            const numericValue = typeof value === "number" ? value : null;
            const belowTarget =
              field.min_target !== null &&
              numericValue !== null &&
              numericValue < field.min_target;

            return (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.field_name} className="font-medium">
                  {field.field_label}
                  {field.is_required && <span className="text-red-600 ml-1">*</span>}
                  {field.min_target !== null && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      (Target: {field.min_target})
                    </span>
                  )}
                </Label>

                {field.field_type === "number" ? (
                  <Input
                    id={field.field_name}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={value === "" || value === null || value === undefined ? "" : String(value)}
                    onChange={(e) =>
                      handleChange(
                        field.field_name,
                        e.target.value === "" ? "" : parseInt(e.target.value, 10)
                      )
                    }
                    className={hasError ? "border-red-500" : belowTarget ? "bg-yellow-50 border-yellow-300" : ""}
                  />
                ) : field.field_type === "text" ? (
                  <Input
                    id={field.field_name}
                    type="text"
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => handleChange(field.field_name, e.target.value)}
                    className={hasError ? "border-red-500" : ""}
                  />
                ) : field.field_type === "dropdown" ? (
                  <Select
                    value={typeof value === "string" ? value : ""}
                    onValueChange={(v) => handleChange(field.field_name, v)}
                  >
                    <SelectTrigger id={field.field_name} className={hasError ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.dropdown_options ?? []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-3 pt-1">
                    <Switch
                      id={field.field_name}
                      checked={value === true}
                      onCheckedChange={(c) => handleChange(field.field_name, c)}
                    />
                    <span className="text-sm text-muted-foreground">{value === true ? "Yes" : "No"}</span>
                  </div>
                )}

                {hasError && (
                  <p className="text-xs text-red-600">{errors[field.field_name]}</p>
                )}
                {!hasError && belowTarget && (
                  <p className="text-xs text-yellow-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Below target of {field.min_target}
                  </p>
                )}
              </div>
            );
          })}

          <div className="space-y-1.5">
            <Label htmlFor="eod-notes" className="font-medium">
              Notes (optional)
            </Label>
            <Textarea
              id="eod-notes"
              placeholder="Anything worth flagging?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
            />
          </div>

          {submitMutation.error && (
            <p className="text-sm text-red-600">
              {(submitMutation.error as Error).message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "Submitting..." : amendLogId ? "Update EOD" : backfillDate ? "Submit EOD" : "Submit & Clock Out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
