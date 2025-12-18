import { useState, useEffect } from "react";
import { Moon, Sun, User, Mail, Key, Calendar, LogOut, Palette, Save, Check, Trash2, Download, Link2, Pipette, RotateCcw, Settings, ChevronRight, FileText, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BrokerManagement } from "./BrokerManagement";
import { CSVImport } from "./CSVImport";
import { useTrades } from "@/hooks/useTrades";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface CustomGradient {
  from: string;
  to: string;
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
  customGradient?: CustomGradient | null;
  onCustomGradientChange?: (gradient: CustomGradient | null) => void;
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

type SettingsSection = 'account' | 'appearance' | 'broker' | 'data';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  description: string;
}

const navItems: NavItem[] = [
  { id: 'account', label: 'Account', icon: User, description: 'Profile & authentication' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme & colors' },
  { id: 'broker', label: 'Broker Management', icon: Link2, description: 'Connect trading accounts' },
  { id: 'data', label: 'Data & Import', icon: Database, description: 'Import & export data' },
];

// Wrapper component for CSV Import to use the trades hook
function CSVImportWrapper({ userId }: { userId?: string }) {
  const { importTrades } = useTrades(userId);
  
  const handleImport = async (trades: { date: string; pair: string; direction: string; result: number; session?: string; strategy?: string; notes?: string }[]) => {
    await importTrades(trades.map(t => ({
      ...t,
      direction: t.direction as 'Long' | 'Short',
      user_id: userId || '',
    })));
  };
  
  return <CSVImport onImport={handleImport} />;
}

export function SettingsView({ 
  theme, 
  onThemeChange, 
  accentColor, 
  onAccentColorChange, 
  userProfile, 
  onLogout, 
  customColor, 
  onCustomColorChange,
  customGradient: propCustomGradient,
  onCustomGradientChange,
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [presets, setPresets] = useState<SettingsPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [localCustomColor, setLocalCustomColor] = useState(customColor || '#10b981');
  const [accentEnabled, setAccentEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('atp_accent_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [gradientEnabled, setGradientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('atp_gradient_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [selectedGradient, setSelectedGradient] = useState<{ from: string; to: string } | null>(
    propCustomGradient || null
  );
  const [customGradientFrom, setCustomGradientFrom] = useState(
    propCustomGradient?.from || '#10b981'
  );
  const [customGradientTo, setCustomGradientTo] = useState(
    propCustomGradient?.to || '#06b6d4'
  );

  // Sync with prop changes
  useEffect(() => {
    if (propCustomGradient) {
      setSelectedGradient(propCustomGradient);
      setCustomGradientFrom(propCustomGradient.from);
      setCustomGradientTo(propCustomGradient.to);
    }
  }, [propCustomGradient]);

  // Save toggle states to localStorage
  useEffect(() => {
    localStorage.setItem('atp_accent_enabled', JSON.stringify(accentEnabled));
  }, [accentEnabled]);

  useEffect(() => {
    localStorage.setItem('atp_gradient_enabled', JSON.stringify(gradientEnabled));
  }, [gradientEnabled]);

  // Apply custom color to CSS variables
  useEffect(() => {
    if (accentEnabled && !gradientEnabled && localCustomColor && accentColor === 'custom') {
      const hsl = hexToHsl(localCustomColor);
      document.documentElement.style.setProperty('--primary', hsl);
      document.documentElement.style.setProperty('--primary-glow', adjustLightness(hsl, 5));
      document.documentElement.style.setProperty('--ring', hsl);
      document.documentElement.style.setProperty('--sidebar-primary', hsl);
      document.documentElement.style.setProperty('--sidebar-ring', hsl);
    }
  }, [accentEnabled, gradientEnabled, accentColor, localCustomColor]);

  // Apply gradient colors and save to database
  useEffect(() => {
    if (gradientEnabled && selectedGradient) {
      const fromHsl = hexToHsl(selectedGradient.from);
      const toHsl = hexToHsl(selectedGradient.to);
      document.documentElement.style.setProperty('--primary', fromHsl);
      document.documentElement.style.setProperty('--primary-glow', toHsl);
      document.documentElement.style.setProperty('--ring', fromHsl);
      document.documentElement.style.setProperty('--sidebar-primary', fromHsl);
      document.documentElement.style.setProperty('--sidebar-ring', fromHsl);
      onCustomGradientChange?.(selectedGradient);
    } else if (!gradientEnabled && !accentEnabled) {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-glow');
      document.documentElement.style.removeProperty('--ring');
      document.documentElement.style.removeProperty('--sidebar-primary');
      document.documentElement.style.removeProperty('--sidebar-ring');
    }
  }, [gradientEnabled, accentEnabled, selectedGradient]);

  const handleAccentToggle = (enabled: boolean) => {
    setAccentEnabled(enabled);
    if (enabled && !gradientEnabled) {
      onAccentColorChange(accentColor);
    } else if (!enabled && !gradientEnabled) {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--primary-glow');
      document.documentElement.style.removeProperty('--ring');
      document.documentElement.style.removeProperty('--sidebar-primary');
      document.documentElement.style.removeProperty('--sidebar-ring');
    }
  };

  const handleGradientToggle = (enabled: boolean) => {
    setGradientEnabled(enabled);
    if (enabled && selectedGradient) {
      const fromHsl = hexToHsl(selectedGradient.from);
      const toHsl = hexToHsl(selectedGradient.to);
      document.documentElement.style.setProperty('--primary', fromHsl);
      document.documentElement.style.setProperty('--primary-glow', toHsl);
      document.documentElement.style.setProperty('--ring', fromHsl);
      document.documentElement.style.setProperty('--sidebar-primary', fromHsl);
      document.documentElement.style.setProperty('--sidebar-ring', fromHsl);
    } else if (!enabled) {
      if (accentEnabled && accentColor !== 'custom') {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--primary-glow');
        document.documentElement.style.removeProperty('--ring');
        document.documentElement.style.removeProperty('--sidebar-primary');
        document.documentElement.style.removeProperty('--sidebar-ring');
      }
    }
  };

  const handleCustomColorChange = (color: string) => {
    setLocalCustomColor(color);
    setGradientEnabled(false);
    setAccentEnabled(true);
    onAccentColorChange('custom');
    onCustomColorChange?.(color);
  };

  const handleGradientSelect = (gradient: { from: string; to: string }) => {
    setSelectedGradient(gradient);
    setGradientEnabled(true);
    onAccentColorChange('custom');
  };

  const handleResetColors = () => {
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--primary-glow');
    document.documentElement.style.removeProperty('--ring');
    document.documentElement.style.removeProperty('--sidebar-primary');
    document.documentElement.style.removeProperty('--sidebar-ring');
    
    onCustomGradientChange?.(null);
    localStorage.setItem('atp_accent_enabled', 'true');
    localStorage.setItem('atp_gradient_enabled', 'false');
    setSelectedGradient(null);
    setLocalCustomColor('#10b981');
    setCustomGradientFrom('#10b981');
    setCustomGradientTo('#06b6d4');
    setAccentEnabled(true);
    setGradientEnabled(false);
    
    onAccentColorChange('emerald');
    toast.success("Colors reset to default");
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

  // Render Account Section
  const renderAccountSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Account Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and account preferences</p>
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
          <div className="p-6 rounded-xl bg-muted/30 border border-border/50 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Sign in to sync your settings across devices</p>
            <Button className="w-full">Sign In</Button>
          </div>
        </div>
      )}
    </div>
  );

  // Render Appearance Section
  const renderAppearanceSection = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground mt-1">Customize the look and feel of your dashboard</p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Theme</h3>
            <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
          </div>
          {isSaved && (
            <div className="flex items-center gap-2 text-primary text-xs animate-fade-in">
              <Check className="w-3 h-3" />
              <span>Auto-saved</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                "w-full h-20 rounded-lg border overflow-hidden",
                theme === 'light' ? "border-primary/50" : "border-border/50"
              )}>
                <div className="w-full h-4 bg-gray-100 flex items-center gap-1 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                </div>
                <div className="p-2 bg-white h-16">
                  <div className="w-1/2 h-2 bg-gray-200 rounded mb-1" />
                  <div className="w-3/4 h-2 bg-gray-100 rounded" />
                </div>
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                theme === 'light' ? "text-foreground" : "text-muted-foreground"
              )}>
                Light Mode
              </span>
            </div>
            {theme === 'light' && (
              <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </button>

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
                "w-full h-20 rounded-lg border overflow-hidden",
                theme === 'dark' ? "border-primary/50" : "border-border/50"
              )}>
                <div className="w-full h-4 bg-gray-800 flex items-center gap-1 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                </div>
                <div className="p-2 bg-gray-900 h-16">
                  <div className="w-1/2 h-2 bg-gray-700 rounded mb-1" />
                  <div className="w-3/4 h-2 bg-gray-800 rounded" />
                </div>
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                theme === 'dark' ? "text-foreground" : "text-muted-foreground"
              )}>
                Dark Mode
              </span>
            </div>
            {theme === 'dark' && (
              <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Accent Color Settings */}
      <div className="space-y-4 pt-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Accent Colors</h3>
            <p className="text-xs text-muted-foreground">Use system or custom accent colors</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Color Preview */}
            <div className="flex items-center gap-1">
              {accentColors.slice(0, 4).map((color) => (
                <button
                  key={color.name}
                  onClick={() => {
                    setAccentEnabled(true);
                    setGradientEnabled(false);
                    onAccentColorChange(color.name);
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full transition-all",
                    theme === 'dark' ? color.darkColor : color.color,
                    accentColor === color.name && accentEnabled && !gradientEnabled 
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/50 scale-110" 
                      : "hover:scale-110"
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Custom Color</span>
              <input
                type="color"
                value={localCustomColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-border/50"
                style={{ padding: 0 }}
              />
            </div>
            <Switch
              checked={accentEnabled}
              onCheckedChange={handleAccentToggle}
            />
          </div>
        </div>

        <div className={cn(
          "grid grid-cols-4 gap-3 transition-opacity duration-300",
          !accentEnabled && "opacity-50 pointer-events-none"
        )}>
          {accentColors.map((color) => (
            <button
              key={color.name}
              onClick={() => {
                setAccentEnabled(true);
                setGradientEnabled(false);
                onAccentColorChange(color.name);
              }}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-300",
                accentColor === color.name && accentEnabled && !gradientEnabled
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-muted/30 hover:border-border"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full transition-transform",
                theme === 'dark' ? color.darkColor : color.color,
                accentColor === color.name && accentEnabled && !gradientEnabled && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                accentColor === color.name && accentEnabled && !gradientEnabled ? "text-foreground" : "text-muted-foreground"
              )}>
                {color.label}
              </span>
              {accentColor === color.name && accentEnabled && !gradientEnabled && (
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleResetColors}
          className="text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Default
        </Button>
      </div>

      {/* Gradient Section */}
      <div className="space-y-4 pt-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Gradient Colors</h3>
            <p className="text-xs text-muted-foreground">Use gradient colors for accent</p>
          </div>
          <Switch
            checked={gradientEnabled}
            onCheckedChange={handleGradientToggle}
          />
        </div>

        <div className={cn(
          "space-y-4 transition-opacity duration-300",
          !gradientEnabled && "opacity-50 pointer-events-none"
        )}>
          <div className="grid grid-cols-3 gap-3">
            {gradientPresets.map((gradient) => (
              <button
                key={gradient.name}
                onClick={() => handleGradientSelect(gradient)}
                className={cn(
                  "relative p-3 rounded-xl border-2 transition-all duration-300",
                  selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to && gradientEnabled
                    ? "border-primary"
                    : "border-border/50 hover:border-border"
                )}
              >
                <div 
                  className="w-full h-8 rounded-lg mb-2"
                  style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                />
                <span className="text-xs font-medium text-muted-foreground">{gradient.name}</span>
                {selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to && gradientEnabled && (
                  <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Custom Gradient Creator */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
            <span className="text-xs font-medium text-muted-foreground">Create Custom Gradient</span>
            
            <div className="flex items-center gap-4">
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
              <div className="text-muted-foreground pt-5">→</div>
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
      </div>

      {/* Save Presets Section */}
      <div className="space-y-4 pt-6 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">Saved Presets</h3>
            <p className="text-xs text-muted-foreground">Save and load your custom themes</p>
          </div>
        </div>

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

        {presets.length > 0 && (
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
        )}

        {presets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No presets saved yet. Save your current settings to create a preset.
          </p>
        )}
      </div>
    </div>
  );

  // Render Broker Section
  const renderBrokerSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Broker Management</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect and manage your trading accounts</p>
      </div>
      <BrokerManagement userId={userProfile?.user_id} />
    </div>
  );

  // Render Data Section
  const renderDataSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Data & Import</h2>
        <p className="text-sm text-muted-foreground mt-1">Import trades from CSV files or export your data</p>
      </div>
      <CSVImportWrapper userId={userProfile?.user_id} />
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return renderAccountSection();
      case 'appearance':
        return renderAppearanceSection();
      case 'broker':
        return renderBrokerSection();
      case 'data':
        return renderDataSection();
      default:
        return renderAccountSection();
    }
  };

  return (
    <div className="flex gap-8 animate-fade-in min-h-[calc(100vh-200px)]">
      {/* Sidebar Navigation */}
      <div className="w-64 shrink-0">
        <div className="sticky top-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    isActive ? "bg-primary/20" : "bg-muted/50 group-hover:bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isActive ? "text-primary" : ""
                    )}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform shrink-0",
                    isActive ? "text-primary rotate-90" : "text-muted-foreground"
                  )} />
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 glass rounded-xl p-8 overflow-hidden">
        <ScrollArea className="h-full max-h-[calc(100vh-250px)]">
          {renderContent()}
        </ScrollArea>
      </div>
    </div>
  );
}
