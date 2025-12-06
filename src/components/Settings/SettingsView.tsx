import { useState, useEffect } from "react";
import { Moon, Sun, User, Mail, Key, Calendar, LogOut, Palette, Save, Check, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type AccentColor = 'emerald' | 'red' | 'pink' | 'purple' | 'blue' | 'orange' | 'yellow' | 'cyan';

interface SettingsPreset {
  id: string;
  name: string;
  theme: 'dark' | 'light';
  accentColor: AccentColor;
  createdAt: string;
}

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  accentColor: AccentColor;
  onAccentColorChange: (color: AccentColor) => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

const accentColors: { name: AccentColor; label: string; color: string; darkColor: string }[] = [
  { name: 'emerald', label: 'Emerald', color: 'bg-emerald-500', darkColor: 'bg-emerald-400' },
  { name: 'blue', label: 'Blue', color: 'bg-blue-500', darkColor: 'bg-blue-400' },
  { name: 'purple', label: 'Purple', color: 'bg-purple-500', darkColor: 'bg-purple-400' },
  { name: 'pink', label: 'Pink', color: 'bg-pink-500', darkColor: 'bg-pink-400' },
  { name: 'red', label: 'Red', color: 'bg-red-500', darkColor: 'bg-red-400' },
  { name: 'orange', label: 'Orange', color: 'bg-orange-500', darkColor: 'bg-orange-400' },
  { name: 'yellow', label: 'Yellow', color: 'bg-yellow-500', darkColor: 'bg-yellow-400' },
  { name: 'cyan', label: 'Cyan', color: 'bg-cyan-500', darkColor: 'bg-cyan-400' },
];

export function SettingsView({ theme, onThemeChange, accentColor, onAccentColorChange, userProfile, onLogout }: SettingsViewProps) {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load presets from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem('atp_settings_presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to parse presets:', e);
      }
    }
  }, []);

  // Show saved indicator when theme or accent changes
  useEffect(() => {
    setIsSaved(true);
    const timer = setTimeout(() => setIsSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [theme, accentColor]);

  const savePreset = () => {
    if (!presetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const newPreset: SettingsPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      theme,
      accentColor,
      createdAt: new Date().toISOString(),
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem('atp_settings_presets', JSON.stringify(updatedPresets));
    setPresetName("");
    setShowSaveInput(false);
    toast.success(`Preset "${newPreset.name}" saved!`);
  };

  const loadPreset = (preset: SettingsPreset) => {
    onThemeChange(preset.theme);
    onAccentColorChange(preset.accentColor);
    toast.success(`Preset "${preset.name}" loaded!`);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    setPresets(updatedPresets);
    localStorage.setItem('atp_settings_presets', JSON.stringify(updatedPresets));
    toast.success("Preset deleted");
  };

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
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground">Choose light or dark mode</p>
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

      {/* Accent Color Settings */}
      <section className="glass rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Accent Color</h2>
            <p className="text-sm text-muted-foreground">Personalize your theme color</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {accentColors.map((color) => (
            <button
              key={color.name}
              onClick={() => onAccentColorChange(color.name)}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300",
                accentColor === color.name
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-muted/30 hover:border-border"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full transition-transform",
                theme === 'dark' ? color.darkColor : color.color,
                accentColor === color.name && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                accentColor === color.name ? "text-foreground" : "text-muted-foreground"
              )}>
                {color.label}
              </span>
              {accentColor === color.name && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Save Presets Section */}
      <section className="glass rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Save className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Save Presets</h2>
              <p className="text-sm text-muted-foreground">Save and load your custom themes</p>
            </div>
          </div>
          {isSaved && (
            <div className="flex items-center gap-2 text-primary text-sm animate-fade-in">
              <Check className="w-4 h-4" />
              <span>Auto-saved</span>
            </div>
          )}
        </div>

        {/* Save New Preset */}
        <div className="space-y-3">
          {showSaveInput ? (
            <div className="flex gap-2">
              <Input
                placeholder="Enter preset name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="bg-background/50 border-border/50"
                onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                autoFocus
              />
              <Button onClick={savePreset} size="sm" className="shrink-0">
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setShowSaveInput(false); setPresetName(""); }}
                className="shrink-0"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => setShowSaveInput(true)}
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Current Settings as Preset
            </Button>
          )}
        </div>

        {/* Saved Presets List */}
        {presets.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Saved Presets</p>
            <div className="space-y-2">
              {presets.map((preset) => {
                const presetAccent = accentColors.find(c => c.name === preset.accentColor);
                return (
                  <div 
                    key={preset.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full",
                        theme === 'dark' ? presetAccent?.darkColor : presetAccent?.color
                      )} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.theme === 'dark' ? 'Dark' : 'Light'} • {presetAccent?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadPreset(preset)}
                        className="text-primary hover:bg-primary/10"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Load
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        }
                        title="Delete Preset"
                        description={`Are you sure you want to delete "${preset.name}"?`}
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => deletePreset(preset.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {presets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No presets saved yet. Save your current settings to create a preset.
          </p>
        )}
      </section>

      {/* About */}
      <section className="glass rounded-xl p-6">
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">NSYNC Journal v1.0</p>
          <p className="text-xs text-muted-foreground">All data is stored locally in your browser</p>
        </div>
      </section>
    </div>
  );
}
