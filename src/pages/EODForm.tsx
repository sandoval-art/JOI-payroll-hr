import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function EODForm() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">End of Day Report</h1>
        <p className="text-muted-foreground mt-2">Submit your daily performance report</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>EOD Form</CardTitle>
          <CardDescription>This page is coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Próximamente...</p>
        </CardContent>
      </Card>
    </div>
  );
}
