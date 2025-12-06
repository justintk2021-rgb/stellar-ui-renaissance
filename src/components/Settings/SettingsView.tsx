import { useState, useEffect } from "react";
import { Moon, Sun, User, Mail, Key, Calendar, LogOut, Palette, Save, Check, Trash2, Download, Link2, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Helper function to convert hex to HSL string
function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '158 64% 51%';
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Helper function to adjust lightness of HSL string
function adjustLightness(hsl: string, amount: number): string {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return hsl;
  const l = parseInt(parts[2]);
  return `${parts[0]} ${parts[1]} ${Math.min(100, l + amount)}%`;
}

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

export type AccentColor = 'emerald' | 'red' | 'pink' | 'purple' | 'blue' | 'orange' | 'yellow' | 'cyan' | 'custom';

interface SettingsPreset {
  id: string;
  name: string;
  theme: 'dark' | 'light';
  accentColor: AccentColor;
  customColor?: string;
  createdAt: string;
}

interface SettingsViewProps {
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
  accentColor: AccentColor;
  onAccentColorChange: (color: AccentColor) => void;
  userProfile: UserProfile | null;
  onLogout: () => void;
  customColor?: string;
  onCustomColorChange?: (color: string) => void;
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

// Gradient presets
const gradientPresets = [
  { name: 'Sunset', from: '#ff6b6b', to: '#feca57' },
  { name: 'Ocean', from: '#0abde3', to: '#10ac84' },
  { name: 'Purple Haze', from: '#a55eea', to: '#5f27cd' },
  { name: 'Flamingo', from: '#ff6b81', to: '#a55eea' },
  { name: 'Northern Lights', from: '#0be881', to: '#00d2d3' },
  { name: 'Fire', from: '#ff4757', to: '#ff6348' },
];

export function SettingsView({ theme, onThemeChange, accentColor, onAccentColorChange, userProfile, onLogout, customColor, onCustomColorChange }: SettingsViewProps) {
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localCustomColor, setLocalCustomColor] = useState(customColor || '#10b981');
  const [selectedGradient, setSelectedGradient] = useState<{ from: string; to: string } | null>(() => {
    const saved = localStorage.getItem('atp_custom_gradient');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [customGradientFrom, setCustomGradientFrom] = useState(() => {
    const saved = localStorage.getItem('atp_custom_gradient');
    if (saved) {
      try {
        return JSON.parse(saved).from || '#10b981';
      } catch {
        return '#10b981';
      }
    }
    return '#10b981';
  });
  const [customGradientTo, setCustomGradientTo] = useState(() => {
    const saved = localStorage.getItem('atp_custom_gradient');
    if (saved) {
      try {
        return JSON.parse(saved).to || '#06b6d4';
      } catch {
        return '#06b6d4';
      }
    }
    return '#06b6d4';
  });

  // Load and apply saved gradient on mount
  useEffect(() => {
    const savedGradient = localStorage.getItem('atp_custom_gradient');
    if (savedGradient && accentColor === 'custom') {
      try {
        const gradient = JSON.parse(savedGradient);
        setSelectedGradient(gradient);
      } catch {
        // ignore
      }
    }
  }, []);

  // Apply custom color to CSS variables
  useEffect(() => {
    if (accentColor === 'custom' && localCustomColor && !selectedGradient) {
      const hsl = hexToHsl(localCustomColor);
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--primary-glow', adjustLightness(hsl, 5));
      document.documentElement.style.setProperty('--ring', hsl);
      document.documentElement.style.setProperty('--sidebar-primary', hsl);
      document.documentElement.style.setProperty('--sidebar-ring', hsl);
    }
  }, [accentColor, localCustomColor, selectedGradient]);

  // Apply gradient colors and save to localStorage
  useEffect(() => {
    if (selectedGradient) {
      const fromHsl = hexToHsl(selectedGradient.from);
      const toHsl = hexToHsl(selectedGradient.to);
      document.documentElement.style.setProperty('--primary', fromHsl);
      document.documentElement.style.setProperty('--primary-glow', toHsl);
      document.documentElement.style.setProperty('--ring', fromHsl);
      document.documentElement.style.setProperty('--sidebar-primary', fromHsl);
      document.documentElement.style.setProperty('--sidebar-ring', fromHsl);
      // Save to localStorage
      localStorage.setItem('atp_custom_gradient', JSON.stringify(selectedGradient));
    }
  }, [selectedGradient]);

  const handleCustomColorChange = (color: string) => {
    setLocalCustomColor(color);
    setSelectedGradient(null);
    onAccentColorChange('custom');
    onCustomColorChange?.(color);
  };

  const handleGradientSelect = (gradient: { from: string; to: string }) => {
    setSelectedGradient(gradient);
    onAccentColorChange('custom');
  };

  const handleCustomGradientApply = () => {
    const gradient = { from: customGradientFrom, to: customGradientTo };
    setSelectedGradient(gradient);
    onAccentColorChange('custom');
  };

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

        {/* Custom Color Picker */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <Pipette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Custom Color</span>
          </div>
          
          {/* Color Wheel Input */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="color"
                value={localCustomColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="w-12 h-12 rounded-full cursor-pointer border-2 border-border/50 hover:border-primary transition-colors"
                style={{ 
                  WebkitAppearance: 'none',
                  padding: 0,
                  background: 'transparent'
                }}
              />
              <div 
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ 
                  background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                  opacity: 0.1
                }}
              />
            </div>
            <div className="flex-1">
              <Input
                type="text"
                value={localCustomColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                placeholder="#10b981"
                className="font-mono text-sm bg-background/50"
              />
            </div>
            <div 
              className="w-10 h-10 rounded-lg border border-border/50"
              style={{ backgroundColor: localCustomColor }}
            />
          </div>
        </div>

        {/* Gradient Presets */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Gradient Presets</span>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {gradientPresets.map((gradient) => (
              <button
                key={gradient.name}
                onClick={() => handleGradientSelect(gradient)}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all duration-300",
                  selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to
                    ? "border-primary"
                    : "border-border/50 hover:border-border"
                )}
              >
                <div 
                  className="w-full h-8 rounded-lg mb-2"
                  style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                />
                <span className="text-xs font-medium text-muted-foreground">{gradient.name}</span>
                {selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to && (
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Gradient Creator */}
          <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
            <span className="text-xs font-medium text-muted-foreground">Create Custom Gradient</span>
            
            <div className="flex items-center gap-4">
              {/* From Color */}
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customGradientFrom}
                    onChange={(e) => setCustomGradientFrom(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border/50"
                    style={{ padding: 0 }}
                  />
                  <Input
                    type="text"
                    value={customGradientFrom}
                    onChange={(e) => setCustomGradientFrom(e.target.value)}
                    className="font-mono text-xs bg-background/50 h-8"
                  />
                </div>
              </div>

              {/* Arrow */}
              <div className="text-muted-foreground pt-5">→</div>

              {/* To Color */}
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customGradientTo}
                    onChange={(e) => setCustomGradientTo(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-border/50"
                    style={{ padding: 0 }}
                  />
                  <Input
                    type="text"
                    value={customGradientTo}
                    onChange={(e) => setCustomGradientTo(e.target.value)}
                    className="font-mono text-xs bg-background/50 h-8"
                  />
                </div>
              </div>
            </div>

            {/* Preview & Apply */}
            <div className="flex items-center gap-3">
              <div 
                className="flex-1 h-10 rounded-lg border border-border/50"
                style={{ background: `linear-gradient(135deg, ${customGradientFrom}, ${customGradientTo})` }}
              />
              <Button 
                size="sm" 
                onClick={handleCustomGradientApply}
                className="shrink-0"
              >
                <Check className="w-4 h-4 mr-1" />
                Apply
              </Button>
            </div>
          </div>
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

      {/* Broker Management */}
      <section className="glass rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Broker Management</h2>
            <p className="text-sm text-muted-foreground">Connect and manage your broker accounts</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Link2 className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-medium text-muted-foreground">Coming Soon</p>
          <p className="text-sm text-muted-foreground/70 text-center max-w-xs">
            Broker integration is currently in development. Stay tuned for automatic trade syncing!
          </p>
        </div>
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
