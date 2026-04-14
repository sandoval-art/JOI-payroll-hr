import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Pencil, ArrowUp, ArrowDown, X, Save } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

type FieldType = 'number' | 'boolean' | 'text' | 'dropdown';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Number',
  boolean: 'Yes / No',
  text: 'Text',
  dropdown: 'Dropdown',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface KPIField {
  id: string;
  campaign_id: string;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  min_target: number | null;
  display_order: number;
  is_active: boolean;
  dropdown_options: string[] | null;
  is_required: boolean;
}

interface ShiftSetting {
  id: string | null;
  campaign_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  days_of_week: number[];
}

const emptyField = (): Omit<KPIField, 'id' | 'campaign_id' | 'display_order'> => ({
  field_name: '',
  field_label: '',
  field_type: 'number',
  min_target: null,
  is_active: true,
  dropdown_options: null,
  is_required: false,
});

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLeadership, isOwner, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();

  // Campaign info
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [subtitleVal, setSubtitleVal] = useState('');

  // Shift state
  const [shift, setShift] = useState<Partial<ShiftSetting>>({
    shift_name: '',
    start_time: '08:00',
    end_time: '17:00',
    grace_minutes: 10,
    days_of_week: [1, 2, 3, 4, 5],
  });
  const [shiftDirty, setShiftDirty] = useState(false);

  // KPI field dialog
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<KPIField | null>(null);
  const [fieldForm, setFieldForm] = useState(emptyField());
  const [dropdownInput, setDropdownInput] = useState('');

  if (loading) return null;
  if (!isLeadership) return <Navigate to="/" replace />;

  const invalidateCampaign = () => {
    queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
  };

  // Fetch campaign
  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, subtitle')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; subtitle: string | null };
    },
    enabled: !!id,
  });

  // Populate name/subtitle fields when campaign loads
  useEffect(() => {
    if (campaign) {
      setNameVal(campaign.name);
      setSubtitleVal(campaign.subtitle ?? '');
    }
  }, [campaign]);

  // Fetch shift settings for this campaign
  const { data: existingShift } = useQuery({
    queryKey: ['campaign-shift', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('shift_settings')
        .select('*')
        .eq('campaign_id', id!)
        .order('shift_name')
        .limit(1)
        .single();
      return data as ShiftSetting | null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (existingShift) {
      setShift({
        id: existingShift.id,
        shift_name: existingShift.shift_name,
        start_time: existingShift.start_time,
        end_time: existingShift.end_time,
        grace_minutes: existingShift.grace_minutes ?? 10,
        days_of_week: existingShift.days_of_week ?? [1, 2, 3, 4, 5],
      });
    }
  }, [existingShift]);

  // Fetch KPI fields
  const { data: kpiFields = [] } = useQuery({
    queryKey: ['kpi-config', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_kpi_config')
        .select('*')
        .eq('campaign_id', id!)
        .order('display_order');
      if (error) throw error;
      return data as KPIField[];
    },
    enabled: !!id,
  });

  // Fetch agent count
  const { data: agentCount = 0 } = useQuery({
    queryKey: ['campaign-agents', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id!);
      return count ?? 0;
    },
    enabled: !!id,
  });

  // Save campaign name/subtitle
  const saveCampaignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .update({ name: nameVal.trim(), subtitle: subtitleVal.trim() || null })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCampaign();
      setEditingName(false);
      toast.success('Campaign updated');
    },
  });

  // Save shift
  const saveShiftMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        campaign_id: id!,
        shift_name: shift.shift_name || nameVal,
        start_time: shift.start_time!,
        end_time: shift.end_time!,
        grace_minutes: shift.grace_minutes ?? 10,
        days_of_week: shift.days_of_week,
        updated_at: new Date().toISOString(),
      };

      if (shift.id) {
        const { error } = await supabase
          .from('shift_settings')
          .update(payload)
          .eq('id', shift.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('shift_settings')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        setShift((prev) => ({ ...prev, id: data.id }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-shift', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      setShiftDirty(false);
      toast.success('Shift saved');
    },
  });

  // KPI mutations
  const invalidateKpi = () => queryClient.invalidateQueries({ queryKey: ['kpi-config', id] });

  const saveKpiMutation = useMutation({
    mutationFn: async () => {
      const fieldName =
        fieldForm.field_name ||
        fieldForm.field_label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

      const payload = {
        field_name: fieldName,
        field_label: fieldForm.field_label,
        field_type: fieldForm.field_type,
        min_target: fieldForm.field_type === 'number' ? fieldForm.min_target : null,
        dropdown_options: fieldForm.field_type === 'dropdown' ? fieldForm.dropdown_options : null,
        is_active: fieldForm.is_active,
        is_required: fieldForm.is_required,
      };

      if (editingField) {
        const { error } = await supabase.from('campaign_kpi_config').update(payload).eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('campaign_kpi_config').insert({
          ...payload,
          campaign_id: id!,
          display_order: kpiFields.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateKpi(); closeKpiDialog(); },
  });

  const toggleKpiMutation = useMutation({
    mutationFn: async ({ fieldId, is_active }: { fieldId: string; is_active: boolean }) => {
      const { error } = await supabase.from('campaign_kpi_config').update({ is_active }).eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: invalidateKpi,
  });

  const reorderKpiMutation = useMutation({
    mutationFn: async ({ fieldId, direction }: { fieldId: string; direction: 'up' | 'down' }) => {
      const idx = kpiFields.findIndex((f) => f.id === fieldId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= kpiFields.length) return;
      const a = kpiFields[idx];
      const b = kpiFields[swapIdx];
      const { error } = await supabase.from('campaign_kpi_config').upsert([
        { id: a.id, display_order: b.display_order },
        { id: b.id, display_order: a.display_order },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidateKpi,
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const { error } = await supabase.from('campaign_kpi_config').delete().eq('id', fieldId);
      if (error) throw error;
    },
    onSuccess: invalidateKpi,
  });

  function openAddKpi() {
    setEditingField(null);
    setFieldForm(emptyField());
    setDropdownInput('');
    setKpiDialogOpen(true);
  }

  function openEditKpi(field: KPIField) {
    setEditingField(field);
    setFieldForm({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      min_target: field.min_target,
      is_active: field.is_active,
      dropdown_options: field.dropdown_options,
      is_required: field.is_required,
    });
    setDropdownInput('');
    setKpiDialogOpen(true);
  }

  function closeKpiDialog() {
    setKpiDialogOpen(false);
    setEditingField(null);
    setFieldForm(emptyField());
    setDropdownInput('');
  }

  function toggleDay(day: number) {
    setShift((prev) => {
      const days = prev.days_of_week ?? [];
      const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
      return { ...prev, days_of_week: next };
    });
    setShiftDirty(true);
  }

  const canSaveKpi =
    fieldForm.field_label.trim() &&
    (fieldForm.field_type !== 'dropdown' ||
      (fieldForm.dropdown_options && fieldForm.dropdown_options.length >= 2));

  if (isLoading) return <div className="py-20 text-center text-muted-foreground">Loading...</div>;
  if (!campaign) return <Navigate to="/campaigns" replace />;

  const displayName = campaign.subtitle ? `${campaign.name} – ${campaign.subtitle}` : campaign.name;

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate('/campaigns')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Campaigns
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {editingName ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Name (e.g. Torro)"
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  className="w-48"
                />
                <Input
                  placeholder="Subtitle (e.g. SLOC Weekday)"
                  value={subtitleVal}
                  onChange={(e) => setSubtitleVal(e.target.value)}
                  className="w-56"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveCampaignMutation.mutate()} disabled={!nameVal.trim() || saveCampaignMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNameVal(campaign.name); setSubtitleVal(campaign.subtitle ?? ''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{displayName}</h1>
                <p className="text-muted-foreground mt-1">{agentCount} agent{agentCount !== 1 ? 's' : ''} assigned</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingName(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Shift */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Shift Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Days of week */}
          <div className="space-y-2">
            <Label>Days</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    (shift.days_of_week ?? []).includes(i)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={shift.start_time ?? '08:00'}
                onChange={(e) => { setShift((p) => ({ ...p, start_time: e.target.value })); setShiftDirty(true); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={shift.end_time ?? '17:00'}
                onChange={(e) => { setShift((p) => ({ ...p, end_time: e.target.value })); setShiftDirty(true); }}
              />
            </div>
          </div>

          {/* Grace period */}
          <div className="space-y-1.5 w-40">
            <Label htmlFor="grace">Grace Period (minutes)</Label>
            <Input
              id="grace"
              type="number"
              min="0"
              max="60"
              value={shift.grace_minutes ?? 10}
              onChange={(e) => { setShift((p) => ({ ...p, grace_minutes: parseInt(e.target.value) || 0 })); setShiftDirty(true); }}
            />
          </div>

          {shiftDirty && (
            <Button onClick={() => saveShiftMutation.mutate()} disabled={saveShiftMutation.isPending}>
              {saveShiftMutation.isPending ? 'Saving...' : 'Save Shift'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* EOD / KPI Fields */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">EOD Metrics & Daily Targets</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              What agents report at end of day and what targets they're measured against
            </p>
          </div>
          <Button size="sm" onClick={openAddKpi}>
            <Plus className="h-4 w-4 mr-1" />
            Add Metric
          </Button>
        </CardHeader>
        <CardContent>
          {kpiFields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No metrics yet. Add one to define what agents report.
            </p>
          ) : (
            <div className="space-y-2">
              {kpiFields.map((field, idx) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    field.is_active ? 'bg-background' : 'bg-muted/40 opacity-60'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0}
                      onClick={() => reorderKpiMutation.mutate({ fieldId: field.id, direction: 'up' })}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === kpiFields.length - 1}
                      onClick={() => reorderKpiMutation.mutate({ fieldId: field.id, direction: 'down' })}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{field.field_label}</span>
                      <Badge variant="outline" className="text-xs">{FIELD_TYPE_LABELS[field.field_type]}</Badge>
                      {field.is_required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                      {field.field_type === 'number' && field.min_target != null && (
                        <span className="text-xs text-muted-foreground">Target: {field.min_target}/day</span>
                      )}
                      {field.field_type === 'dropdown' && field.dropdown_options && (
                        <span className="text-xs text-muted-foreground">{field.dropdown_options.length} options</span>
                      )}
                    </div>
                  </div>
                  <Switch checked={field.is_active}
                    onCheckedChange={(val) => toggleKpiMutation.mutate({ fieldId: field.id, is_active: val })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditKpi(field)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {(isOwner || isAdmin) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`Delete "${field.field_label}"?`)) deleteKpiMutation.mutate(field.id); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI field dialog */}
      <Dialog open={kpiDialogOpen} onOpenChange={(open) => !open && closeKpiDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Metric' : 'Add Metric'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Question / Label</Label>
              <Input placeholder="e.g. Calls Handled" value={fieldForm.field_label}
                onChange={(e) => setFieldForm((p) => ({ ...p, field_label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Field Type</Label>
              <Select value={fieldForm.field_type}
                onValueChange={(v) => setFieldForm((p) => ({ ...p, field_type: v as FieldType, min_target: null, dropdown_options: null }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                    <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldForm.field_type === 'number' && (
              <div className="space-y-1.5">
                <Label>Daily Target (optional)</Label>
                <Input type="number" min="0" placeholder="e.g. 300"
                  value={fieldForm.min_target ?? ''}
                  onChange={(e) => setFieldForm((p) => ({ ...p, min_target: e.target.value === '' ? null : Number(e.target.value) }))} />
              </div>
            )}
            {fieldForm.field_type === 'dropdown' && (
              <div className="space-y-1.5">
                <Label>Options (min. 2)</Label>
                <div className="flex gap-2">
                  <Input placeholder="Add option..." value={dropdownInput}
                    onChange={(e) => setDropdownInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = dropdownInput.trim();
                        if (val) { setFieldForm((p) => ({ ...p, dropdown_options: [...(p.dropdown_options ?? []), val] })); setDropdownInput(''); }
                      }
                    }} />
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => { const val = dropdownInput.trim(); if (val) { setFieldForm((p) => ({ ...p, dropdown_options: [...(p.dropdown_options ?? []), val] })); setDropdownInput(''); } }}>
                    Add
                  </Button>
                </div>
                {fieldForm.dropdown_options && fieldForm.dropdown_options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {fieldForm.dropdown_options.map((opt) => (
                      <Badge key={opt} variant="secondary" className="gap-1 pr-1">
                        {opt}
                        <button onClick={() => setFieldForm((p) => ({ ...p, dropdown_options: (p.dropdown_options ?? []).filter((o) => o !== opt) }))}
                          className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Required</Label>
              <Switch checked={fieldForm.is_required}
                onCheckedChange={(v) => setFieldForm((p) => ({ ...p, is_required: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={fieldForm.is_active}
                onCheckedChange={(v) => setFieldForm((p) => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeKpiDialog}>Cancel</Button>
            <Button onClick={() => saveKpiMutation.mutate()} disabled={!canSaveKpi || saveKpiMutation.isPending}>
              {saveKpiMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
