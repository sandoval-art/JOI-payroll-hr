import { useNavigate } from "react-router-dom";
import { Building2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import { useClientCampaigns, useClientEmployees } from "@/hooks/useClientPortal";

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { data: campaigns = [], isLoading: campaignsLoading } = useClientCampaigns();
  const { data: employees = [], isLoading: employeesLoading } = useClientEmployees();

  const isLoading = campaignsLoading || employeesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LogoLoadingIndicator size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Your Campaigns</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Select a campaign to view agent roster and this-week performance.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No campaigns found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => {
            const campaignEmployees = employees.filter(
              (e) => e.campaign_id === campaign.id,
            );
            const total = campaignEmployees.length;
            const active = campaignEmployees.filter((e) => e.is_active).length;

            return (
              <Card
                key={campaign.id}
                className="cursor-pointer transition-shadow hover:shadow-md hover:border-primary/40"
                onClick={() => navigate(`/client/campaign/${campaign.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {campaign.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{total} agents</span>
                    {active < total && (
                      <Badge variant="secondary" className="text-xs">
                        {active} active
                      </Badge>
                    )}
                    {active === total && total > 0 && (
                      <Badge variant="outline" className="text-xs">
                        All active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
