import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { ClipboardList, Plus, Pencil, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';

type FieldType = 'number' | 'boolean' | 'text' | 'dropdown';

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

interface Client {
  id: string;
  name: string;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Number',
  boolean: 'Yes / No',
  text: 'Text',
  dropdown: 'Dropdown',
};

const emptyField = (): Omit<KPIField, 'id' | 'campaign_id' | 'display_order'> => ({
  field_name: '',
  field_label: '',
  field_type: 'number',
  min_target: null,
  is_active: true,
  dropdown_options: null,
  is_required: false,
});

export default function EODFormBuilder() {
  const { isLeadership, isAdmin, isOwner } = useAuth();
  const queryClient = useQueryClient();

  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<KPIField | null>(null);
  const [form, setForm] = useState(emptyField());
  const [dropdownInput, setDropdownInput] = useState('');

  // Only leadership can access this page
  if (!isLeadership) return <Navigate to="/" replace />;

  // Fetch all campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
  });

  // Fetch fields for selected campaign
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['kpi-config', selectedCampaign],
    queryFn: async () => {
      if (!selectedCampaign) return [];
      const { data, error } = await supabase
        .from('campaign_kpi_config')
        .select('*')
        .eq('campaign_id', selectedCampaign)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as KPIField[];
    },
    enabled: !!selectedCampaign,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['kpi-config', selectedCampaign] });

  // Save field (insert or update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Auto-generate field_name from label if not set
      const fieldName =
        form.field_name ||
        form.field_label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');

      const payload = {
        field_name: fieldName,
        field_label: form.field_label,
        field_type: form.field_type,
        min_target: form.field_type === 'number' ? form.min_target : null,
        dropdown_options:
          form.field_type === 'dropdown' ? form.dropdown_options : null,
        is_active: form.is_active,
        is_required: form.is_required,
      };

      if (editingField) {
        const { error } = await supabase
          .from('campaign_kpi_config')
          .update(payload)
          .eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('campaign_kpi_config')
          .insert({
            ...payload,
            campaign_id: selectedCampaign,
            display_order: fields.length,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      closeDialog();
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('campaign_kpi_config')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Reorder — swap display_order with adjacent field
  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const idx = fields.findIndex((f) => f.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= fields.length) return;

      const a = fields[idx];
      const b = fields[swapIdx];

      const { error } = await supabase.from('campaign_kpi_config').upsert([
        { id: a.id, display_order: b.display_order },
        { id: b.id, display_order: a.display_order },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Delete field
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaign_kpi_config')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  function openAdd() {
    setEditingField(null);
    setForm(emptyField());
    setDropdownInput('');
    setDialogOpen(true);
  }

  function openEdit(field: KPIField) {
    setEditingField(field);
    setForm({
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      min_target: field.min_target,
      is_active: field.is_active,
      dropdown_options: field.dropdown_options,
      is_required: field.is_required,
    });
    setDropdownInput('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingField(null);
    setForm(emptyField());
    setDropdownInput('');
  }

  function addDropdownOption() {
    const val = dropdownInput.trim();
    if (!val) return;
    setForm((prev) => ({
      ...prev,
      dropdown_options: [...(prev.dropdown_options ?? []), val],
    }));
    setDropdownInput('');
  }

  function removeDropdownOption(opt: string) {
    setForm((prev) => ({
      ...prev,
      dropdown_options: (prev.dropdown_options ?? []).filter((o) => o !== opt),
    }));
  }

  const canSave =
    form.field_label.trim() &&
    (form.field_type !== 'dropdown' ||
      (form.dropdown_options && form.dropdown_options.length >= 2));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">EOD Form Builder</h1>
        <p className="text-muted-foreground mt-1">
          Define the questions each campaign answers at end of day
        </p>
      </div>

      {/* Campaign picker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" />
            Select Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a campaign..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Fields list */}
      {selectedCampaign && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Fields
              {fields.length > 0 && (
                <span className="ml-2 text-muted-foreground font-normal text-sm">
                  ({fields.length})
                </span>
              )}
            </CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" />
              Add Field
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : fields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No fields yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      field.is_active ? 'bg-background' : 'bg-muted/40 opacity-60'
                    }`}
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === 0}
                        onClick={() =>
                          reorderMutation.mutate({ id: field.id, direction: 'up' })
                        }
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === fields.length - 1}
                        onClick={() =>
                          reorderMutation.mutate({ id: field.id, direction: 'down' })
                        }
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Field info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{field.field_label}</span>
                        <Badge variant="outline" className="text-xs">
                          {FIELD_TYPE_LABELS[field.field_type]}
                        </Badge>
                        {field.is_required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                        {field.field_type === 'number' && field.min_target != null && (
                          <span className="text-xs text-muted-foreground">
                            Target: {field.min_target}
                          </span>
                        )}
                        {field.field_type === 'dropdown' && field.dropdown_options && (
                          <span className="text-xs text-muted-foreground">
                            {field.dropdown_options.length} options
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {field.field_name}
                      </p>
                    </div>

                    {/* Active toggle */}
                    <Switch
                      checked={field.is_active}
                      onCheckedChange={(val) =>
                        toggleMutation.mutate({ id: field.id, is_active: val })
                      }
                    />

                    {/* Edit */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(field)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {/* Delete — only owner/admin */}
                    {(isOwner || isAdmin) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${field.field_label}"?`))
                            deleteMutation.mutate(field.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingField ? 'Edit Field' : 'Add Field'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="field_label">Question / Label</Label>
              <Input
                id="field_label"
                placeholder="e.g. Calls Handled"
                value={form.field_label}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, field_label: e.target.value }))
                }
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Field Type</Label>
              <Select
                value={form.field_type}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    field_type: val as FieldType,
                    min_target: null,
                    dropdown_options: null,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {FIELD_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Number target */}
            {form.field_type === 'number' && (
              <div className="space-y-1.5">
                <Label htmlFor="min_target">Minimum Target (optional)</Label>
                <Input
                  id="min_target"
                  type="number"
                  min="0"
                  placeholder="e.g. 50"
                  value={form.min_target ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      min_target: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            )}

            {/* Dropdown options */}
            {form.field_type === 'dropdown' && (
              <div className="space-y-1.5">
                <Label>Options (min. 2)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add option..."
                    value={dropdownInput}
                    onChange={(e) => setDropdownInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDropdownOption())}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>
                    Add
                  </Button>
                </div>
                {form.dropdown_options && form.dropdown_options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.dropdown_options.map((opt) => (
                      <Badge key={opt} variant="secondary" className="gap-1 pr-1">
                        {opt}
                        <button
                          onClick={() => removeDropdownOption(opt)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Required toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is_required">Required</Label>
              <Switch
                id="is_required"
                checked={form.is_required}
                onCheckedChange={(val) =>
                  setForm((prev) => ({ ...prev, is_required: val }))
                }
              />
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={(val) =>
                  setForm((prev) => ({ ...prev, is_active: val }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
