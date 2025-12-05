import { Moon, Sun, User, Mail, Key } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export function SettingsView({ theme, onThemeChange }: SettingsViewProps) {
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

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">Not connected</p>
              </div>
            </div>
            <button className="px-4 py-2 text-xs font-medium rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
              Connect
            </button>
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
        </div>
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
