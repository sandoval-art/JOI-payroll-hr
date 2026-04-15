import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, titleLabel } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

export default function Account() {
  const { user, title } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reset link sent — check your email");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">My Account</h2>
        <p className="text-muted-foreground text-sm">Manage your login and password</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Info</CardTitle>
          <CardDescription>Read-only. Ask an admin if anything needs to change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user?.email ?? "—"}</p>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="text-sm font-medium">{title ? titleLabel(title) : "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
          <CardDescription>At least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" disabled={updating}>
              {updating ? "Updating..." : "Update Password"}
            </Button>
          </form>

          <Separator className="my-6" />

          <div className="space-y-2">
            <p className="text-sm font-medium">Forgot your current password?</p>
            <p className="text-xs text-muted-foreground">
              We'll email you a secure link to set a new one without needing the old password.
            </p>
            <Button variant="outline" onClick={handleSendResetEmail} disabled={sendingReset || !user?.email}>
              {sendingReset ? "Sending..." : "Send me a reset link"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
