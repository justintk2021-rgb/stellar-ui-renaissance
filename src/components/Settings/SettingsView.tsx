import { Moon, Sun, User, Mail, Key, Calendar, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

export function SettingsView({ theme, onThemeChange, userProfile, onLogout }: SettingsViewProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getInitials = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name.charAt(0)}${userProfile.last_name.charAt(0)}`;
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      return `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
    }
    return userProfile?.email || "User";
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Account Settings */}
      <section className="glass rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Account Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your account preferences</p>
          </div>
        </div>

        {userProfile ? (
          <div className="space-y-4">
            {/* User Info Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex items-center gap-4">
                {userProfile.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Avatar" 
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-xl font-bold">
                    {getInitials()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold">{getDisplayName()}</h3>
                  <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email Address</p>
                  <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Member Since</p>
                  <p className="text-xs text-muted-foreground">{formatDate(userProfile.created_at)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Key className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Data Backup</p>
                  <p className="text-xs text-muted-foreground">Local storage only</p>
                </div>
              </div>
              <button className="px-4 py-2 text-xs font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                Export
              </button>
            </div>

            {/* Logout Button */}
            <ConfirmDialog
              trigger={
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              }
              title="Sign Out"
              description="Are you sure you want to sign out? Your data will remain saved locally."
              confirmLabel="Sign Out"
              variant="destructive"
              onConfirm={onLogout}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Theme Settings */}
      <section className="glass rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-secondary" />
            ) : (
              <Sun className="w-5 h-5 text-secondary" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Theme</h2>
            <p className="text-sm text-muted-foreground">Customize your appearance</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onThemeChange('dark')}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-300 group",
              theme === 'dark'
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-muted/30 hover:border-border"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                theme === 'dark' ? "bg-primary/20" : "bg-muted"
              )}>
                <Moon className={cn(
                  "w-6 h-6 transition-colors",
                  theme === 'dark' ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                theme === 'dark' ? "text-foreground" : "text-muted-foreground"
              )}>
                Dark Mode
              </span>
            </div>
            {theme === 'dark' && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>

          <button
            onClick={() => onThemeChange('light')}
            className={cn(
              "relative p-4 rounded-xl border-2 transition-all duration-300 group",
              theme === 'light'
                ? "border-primary bg-primary/10"
                : "border-border/50 bg-muted/30 hover:border-border"
            )}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                theme === 'light' ? "bg-primary/20" : "bg-muted"
              )}>
                <Sun className={cn(
                  "w-6 h-6 transition-colors",
                  theme === 'light' ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                theme === 'light' ? "text-foreground" : "text-muted-foreground"
              )}>
                Light Mode
              </span>
            </div>
            {theme === 'light' && (
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        </div>
      </section>

      {/* About */}
      <section className="glass rounded-xl p-6">
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">ATP Trades v1.0</p>
          <p className="text-xs text-muted-foreground">All data is stored locally in your browser</p>
        </div>
      </section>
    </div>
  );
}
