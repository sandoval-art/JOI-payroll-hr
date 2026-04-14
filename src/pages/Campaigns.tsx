import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Plus, ChevronRight, Users, Clock } from 'lucide-react';
import { Navigate } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string;
  subtitle: string | null;
}

interface CampaignWithStats extends Campaign {
  agentCount: number;
  shiftName: string | null;
}

export function campaignLabel(c: { name: string; subtitle?: string | null }) {
  return c.subtitle ? `${c.name} – ${c.subtitle}` : c.name;
}

export default function Campaigns() {
  const { isLeadership, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');

  if (loading) return null;
  if (!isLeadership) return <Navigate to="/" replace />;

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: async () => {
      const [{ data: clients }, { data: employees }, { data: shifts }] = await Promise.all([
        supabase.from('clients').select('id, name, subtitle').order('name'),
        supabase.from('employees').select('client_id'),
        supabase.from('shift_settings').select('campaign_id, shift_name'),
      ]);

      return (clients ?? []).map((c) => ({
        ...c,
        agentCount: (employees ?? []).filter((e) => e.client_id === c.id).length,
        shiftName: (shifts ?? []).find((s) => s.campaign_id === c.id)?.shift_name ?? null,
      })) as CampaignWithStats[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .insert({ name: newName.trim(), subtitle: newSubtitle.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns-list'] });
      setDialogOpen(false);
      setNewName('');
      setNewSubtitle('');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Manage shift hours, KPI targets, and EOD questions per campaign
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Campaign
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No campaigns yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    {c.subtitle && (
                      <p className="text-sm text-muted-foreground mt-0.5">{c.subtitle}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="flex gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  {c.agentCount} agent{c.agentCount !== 1 ? 's' : ''}
                </Badge>
                {c.shiftName && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {c.shiftName}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New campaign dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Name</Label>
              <Input
                id="camp-name"
                placeholder="e.g. Torro"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-subtitle">Subtitle (optional)</Label>
              <Input
                id="camp-subtitle"
                placeholder="e.g. SLOC Weekday"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
