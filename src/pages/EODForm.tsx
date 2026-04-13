'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, AlertTriangle, CheckCircle } from 'lucide-react';

interface KPIField {
  id: string;
  campaign_id: string;
  field_name: string;
  field_label: string;
  field_type: 'number' | 'boolean';
  min_target: number | null;
  display_order: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  client_id: string;
}

interface Client {
  id: string;
  name: string;
}

interface FormValues {
  [key: string]: string | number | boolean;
}

interface EODLog {
  id: string;
  metrics: FormValues;
  notes: string;
  created_at: string;
}

export default function EODForm() {
  const { employeeId } = useAuth();
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<FormValues>({});
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<EODLog | null>(null);

  // Get employee info
  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();
      if (error) throw error;
      return data as Employee;
    },
    enabled: !!employeeId,
  });

  // Get client/campaign info
  const { data: client } = useQuery({
    queryKey: ['client', employee?.client_id],
    queryFn: async () => {
      if (!employee?.client_id) return null;
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', employee.client_id)
        .single();
      if (error) throw error;
      return data as Client;
    },
    enabled: !!employee?.client_id,
  });

  // Get KPI config for campaign
  const { data: kpiFields, isLoading: kpiLoading } = useQuery({
    queryKey: ['kpi-config', employee?.client_id],
    queryFn: async () => {
      if (!employee?.client_id) return [];
      const { data, error } = await supabase
        .from('campaign_kpi_config')
        .select('*')
        .eq('campaign_id', employee.client_id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as KPIField[];
    },
    enabled: !!employee?.client_id,
  });

  // Check if already submitted today
  const { data: todaySubmission } = useQuery({
    queryKey: ['eod-today', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('eod_logs')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as EODLog | null;
    },
    enabled: !!employeeId,
  });

  // Initialize form values from KPI fields
  useEffect(() => {
    if (kpiFields && kpiFields.length > 0) {
      const initial: FormValues = {};
      kpiFields.forEach((field) => {
        initial[field.field_name] = field.field_type === 'boolean' ? false : '';
      });
      setFormValues(initial);
    }
  }, [kpiFields]);

  // Populate from existing submission
  useEffect(() => {
    if (todaySubmission) {
      setExistingSubmission(todaySubmission);
      setFormValues(todaySubmission.metrics);
      setNotes(todaySubmission.notes || '');
      setSubmitted(true);
    }
  }, [todaySubmission]);

  // Submit form
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId || !employee) throw new Error('No employee');
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase.from('eod_logs').insert({
        employee_id: employeeId,
        date: today,
        campaign_id: employee.client_id,
        metrics: formValues,
        notes: notes || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['eod-today', employeeId] });
    },
  });

  const handleInputChange = (fieldName: string, value: string | number | boolean) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  // Error state
  if (!employeeId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End of Day Report</h1>
          <p className="text-muted-foreground mt-2">Submit your daily performance report</p>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Account Not Linked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">Your account is not linked to an employee.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (employeeLoading || kpiLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End of Day Report</h1>
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">End of Day Report</h1>
        <p className="text-muted-foreground mt-2">Submit your daily performance report</p>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {employee?.full_name}
            </CardTitle>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Campaign</p>
                <Badge variant="outline">{client?.name || 'Loading...'}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium capitalize">{dateFormatter.format(today)}</p>
              </div>
              {submitted && (
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Submitted
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {submitted && existingSubmission && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                You already submitted today's report
              </p>
              <p className="text-green-600 text-sm mt-1">
                Submitted at {new Date(existingSubmission.created_at).toLocaleTimeString('en-US')}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* KPI Fields */}
            <div className="space-y-4">
              {kpiFields && kpiFields.length > 0 ? (
                kpiFields.map((field) => {
                  const value = formValues[field.field_name];
                  const isBelowTarget =
                    field.min_target !== null &&
                    typeof value === 'number' &&
                    value < field.min_target;

                  return (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.field_name} className="font-medium">
                        {field.field_label}
                        {field.min_target !== null && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            (Target: {field.min_target})
                          </span>
                        )}
                      </Label>

                      {field.field_type === 'number' ? (
                        <Input
                          id={field.field_name}
                          type="number"
                          min="0"
                          placeholder={
                            field.min_target !== null
                              ? `Target: ${field.min_target}`
                              : 'Enter value'
                          }
                          value={value === '' ? '' : value}
                          onChange={(e) =>
                            handleInputChange(
                              field.field_name,
                              e.target.value === '' ? '' : parseInt(e.target.value, 10)
                            )
                          }
                          disabled={submitted}
                          className={isBelowTarget ? 'bg-yellow-50 border-yellow-300' : ''}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <Switch
                            id={field.field_name}
                            checked={value === true}
                            onCheckedChange={(checked) =>
                              handleInputChange(field.field_name, checked)
                            }
                            disabled={submitted}
                          />
                          <Label
                            htmlFor={field.field_name}
                            className="font-normal cursor-pointer"
                          >
                            {value === true ? 'Yes' : 'No'}
                          </Label>
                        </div>
                      )}

                      {isBelowTarget && (
                        <p className="text-sm text-yellow-700 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          You're below target
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground">No fields configured for this campaign</p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="font-medium">
                Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any comments or additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitted}
                className="min-h-24"
              />
            </div>

            {/* Submit Button */}
            {!submitted && (
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full h-10 text-base font-medium"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            )}

            {submitted && (
              <Button disabled className="w-full h-10 text-base font-medium bg-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Report Submitted
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
