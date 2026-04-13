import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimeOff() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time Off Requests</h1>
        <p className="text-muted-foreground mt-2">Request and manage your time off</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Time Off</CardTitle>
          <CardDescription>This page is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Próximamente...</p>
        </CardContent>
      </Card>
    </div>
  );
}
