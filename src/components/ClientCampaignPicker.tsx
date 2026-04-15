import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useClients } from "@/hooks/useInvoices";
import { useCampaigns } from "@/hooks/useCampaigns";

interface ClientCampaignPickerProps {
  value: { clientId: string | null; campaignId: string | null };
  onChange: (value: { clientId: string | null; campaignId: string | null }) => void;
  disabled?: boolean;
  allowUnassigned?: boolean;
}

export function ClientCampaignPicker({
  value,
  onChange,
  disabled = false,
  allowUnassigned = true,
}: ClientCampaignPickerProps) {
  const { data: clients = [] } = useClients();
  const { data: campaigns = [] } = useCampaigns(value.clientId ?? undefined);

  const handleClientChange = (selected: string) => {
    const clientId = selected === "none" ? null : selected;
    onChange({ clientId, campaignId: null });
  };

  const handleCampaignChange = (selected: string) => {
    const campaignId = selected === "none" ? null : selected;
    onChange({ clientId: value.clientId, campaignId });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Client</Label>
        <Select
          value={value.clientId ?? "none"}
          onValueChange={handleClientChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {allowUnassigned && <SelectItem value="none">None</SelectItem>}
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Campaign</Label>
        <Select
          value={value.campaignId ?? "none"}
          onValueChange={handleCampaignChange}
          disabled={disabled || !value.clientId}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select campaign" />
          </SelectTrigger>
          <SelectContent>
            {allowUnassigned && <SelectItem value="none">None</SelectItem>}
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
