import { useState, useEffect } from "react";
import { Moon, Sun, User, Mail, Key, Calendar, LogOut, Palette, Save, Check, Trash2, Download, Link2, Pipette, RotateCcw, Settings, ChevronRight, FileText, Database, Sparkles } from "lucide-react";
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
import { motion, AnimatePresence } from "framer-motion";

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

const accentColors: { name: AccentColor; label: string; color: string; darkColor: string; hex: string }[] = [
  { name: 'emerald', label: 'Emerald', color: 'bg-emerald-500', darkColor: 'bg-emerald-400', hex: '#10b981' },
  { name: 'blue', label: 'Blue', color: 'bg-blue-500', darkColor: 'bg-blue-400', hex: '#3b82f6' },
  { name: 'purple', label: 'Purple', color: 'bg-purple-500', darkColor: 'bg-purple-400', hex: '#a855f7' },
  { name: 'pink', label: 'Pink', color: 'bg-pink-500', darkColor: 'bg-pink-400', hex: '#ec4899' },
  { name: 'red', label: 'Red', color: 'bg-red-500', darkColor: 'bg-red-400', hex: '#ef4444' },
  { name: 'orange', label: 'Orange', color: 'bg-orange-500', darkColor: 'bg-orange-400', hex: '#f97316' },
  { name: 'yellow', label: 'Yellow', color: 'bg-yellow-500', darkColor: 'bg-yellow-400', hex: '#eab308' },
  { name: 'cyan', label: 'Cyan', color: 'bg-cyan-500', darkColor: 'bg-cyan-400', hex: '#06b6d4' },
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

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 20,
    },
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 20,
    },
  },
  tap: {
    scale: 0.98,
  },
};

const glowVariants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: [0.4, 0.8, 0.4],
    scale: [0.8, 1.1, 0.8],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const pulseVariants = {
  initial: { scale: 1, opacity: 1 },
  animate: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <User className="w-5 h-5 text-primary" />
          </motion.div>
          Account Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-2 ml-[52px]">Manage your profile and account preferences</p>
      </motion.div>

      {userProfile ? (
        <div className="space-y-4">
          {/* User Info Card */}
          <motion.div
            variants={cardVariants}
            whileHover="hover"
            whileTap="tap"
            className="relative p-6 rounded-2xl overflow-hidden"
          >
            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
              variants={glowVariants}
              initial="initial"
              animate="animate"
            />
            <motion.div
              className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            
            <div className="relative flex items-center gap-5">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 10 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                {userProfile.avatar_url ? (
                  <img 
                    src={userProfile.avatar_url} 
                    alt="Avatar" 
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-primary/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/30">
                    {getInitials()}
                  </div>
                )}
                <motion.div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-4 border-background"
                  variants={pulseVariants}
                  initial="initial"
                  animate="animate"
                />
              </motion.div>
              <div>
                <h3 className="text-xl font-bold">{getDisplayName()}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <Mail className="w-3.5 h-3.5" />
                  {userProfile.email}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Account Details */}
          {[
            { icon: Mail, label: 'Email Address', value: userProfile.email },
            { icon: Calendar, label: 'Member Since', value: formatDate(userProfile.created_at) },
            { icon: Key, label: 'Data Backup', value: 'Cloud synced', action: true },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              variants={itemVariants}
              whileHover={{ scale: 1.01, x: 4 }}
              className="flex items-center justify-between p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors"
                  whileHover={{ rotate: 10 }}
                >
                  <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
              </div>
              {item.action && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  Export
                </motion.button>
              )}
            </motion.div>
          ))}

          {/* Logout Button */}
          <motion.div variants={itemVariants}>
            <ConfirmDialog
              trigger={
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50 transition-all"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </motion.div>
              }
              title="Sign Out"
              description="Are you sure you want to sign out? Your data will remain saved."
              confirmLabel="Sign Out"
              variant="destructive"
              onConfirm={onLogout}
            />
          </motion.div>
        </div>
      ) : (
        <motion.div variants={cardVariants} className="space-y-4">
          <div className="p-8 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 text-center">
            <motion.div
              className="w-20 h-20 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center"
              whileHover={{ scale: 1.1, rotate: 10 }}
            >
              <User className="w-10 h-10 text-muted-foreground" />
            </motion.div>
            <p className="text-muted-foreground mb-6">Sign in to sync your settings across devices</p>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-full">Sign In</Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  // Render Appearance Section
  const renderAppearanceSection = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Palette className="w-5 h-5 text-primary" />
          </motion.div>
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground mt-2 ml-[52px]">Customize the look and feel of your dashboard</p>
      </motion.div>

      {/* Theme Selection */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Theme</h3>
            <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
          </div>
          <AnimatePresence>
            {isSaved && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <Check className="w-3 h-3" />
                </motion.div>
                <span>Auto-saved</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Light Theme Card */}
          <motion.button
            variants={cardVariants}
            whileHover="hover"
            whileTap="tap"
            onClick={() => onThemeChange('light')}
            className={cn(
              "relative p-5 rounded-2xl border-2 transition-all duration-300 group overflow-hidden",
              theme === 'light'
                ? "border-primary bg-primary/5"
                : "border-border/50 bg-card/30 hover:border-border"
            )}
          >
            {/* Decorative glow */}
            {theme === 'light' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            
            <div className="relative flex flex-col items-center gap-4">
              <div className={cn(
                "w-full h-24 rounded-xl border overflow-hidden shadow-lg",
                theme === 'light' ? "border-primary/30 shadow-primary/10" : "border-border/50"
              )}>
                <div className="w-full h-5 bg-gray-100 flex items-center gap-1.5 px-3">
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-red-400" />
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-yellow-400" />
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="p-3 bg-white h-[calc(100%-1.25rem)]">
                  <div className="w-1/2 h-2.5 bg-gray-200 rounded-full mb-2" />
                  <div className="w-3/4 h-2 bg-gray-100 rounded-full" />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Sun className={cn(
                  "w-4 h-4 transition-colors",
                  theme === 'light' ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-semibold transition-colors",
                  theme === 'light' ? "text-foreground" : "text-muted-foreground"
                )}>
                  Light Mode
                </span>
              </div>
            </div>
            
            {theme === 'light' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500 }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
              >
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>

          {/* Dark Theme Card */}
          <motion.button
            variants={cardVariants}
            whileHover="hover"
            whileTap="tap"
            onClick={() => onThemeChange('dark')}
            className={cn(
              "relative p-5 rounded-2xl border-2 transition-all duration-300 group overflow-hidden",
              theme === 'dark'
                ? "border-primary bg-primary/5"
                : "border-border/50 bg-card/30 hover:border-border"
            )}
          >
            {theme === 'dark' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              />
            )}
            
            <div className="relative flex flex-col items-center gap-4">
              <div className={cn(
                "w-full h-24 rounded-xl border overflow-hidden shadow-lg",
                theme === 'dark' ? "border-primary/30 shadow-primary/10" : "border-border/50"
              )}>
                <div className="w-full h-5 bg-gray-800 flex items-center gap-1.5 px-3">
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-red-400" />
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-yellow-400" />
                  <motion.div whileHover={{ scale: 1.3 }} className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="p-3 bg-gray-900 h-[calc(100%-1.25rem)]">
                  <div className="w-1/2 h-2.5 bg-gray-700 rounded-full mb-2" />
                  <div className="w-3/4 h-2 bg-gray-800 rounded-full" />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Moon className={cn(
                  "w-4 h-4 transition-colors",
                  theme === 'dark' ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-semibold transition-colors",
                  theme === 'dark' ? "text-foreground" : "text-muted-foreground"
                )}>
                  Dark Mode
                </span>
              </div>
            </div>
            
            {theme === 'dark' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500 }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
              >
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Accent Color Settings */}
      <motion.div variants={itemVariants} className="space-y-5 pt-6 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Accent Colors
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </h3>
            <p className="text-xs text-muted-foreground">Use system or custom accent colors</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Quick Color Preview */}
            <div className="flex items-center gap-1.5">
              {accentColors.slice(0, 5).map((color, index) => (
                <motion.button
                  key={color.name}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.3, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setAccentEnabled(true);
                    setGradientEnabled(false);
                    onAccentColorChange(color.name);
                  }}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all shadow-lg",
                    accentColor === color.name && accentEnabled && !gradientEnabled 
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/50" 
                      : ""
                  )}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
            <div className="h-6 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <motion.label
                whileHover={{ scale: 1.05 }}
                className="relative cursor-pointer"
              >
                <input
                  type="color"
                  value={localCustomColor}
                  onChange={(e) => handleCustomColorChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-7 h-7 rounded-lg border-2 border-border/50 shadow-inner"
                  style={{ backgroundColor: localCustomColor }}
                />
              </motion.label>
            </div>
            <Switch
              checked={accentEnabled}
              onCheckedChange={handleAccentToggle}
            />
          </div>
        </div>

        <div className={cn(
          "grid grid-cols-4 gap-3 transition-all duration-300",
          !accentEnabled && "opacity-40 pointer-events-none blur-[1px]"
        )}>
          {accentColors.map((color, index) => (
            <motion.button
              key={color.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAccentEnabled(true);
                setGradientEnabled(false);
                onAccentColorChange(color.name);
              }}
              className={cn(
                "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-300 overflow-hidden",
                accentColor === color.name && accentEnabled && !gradientEnabled
                  ? "border-primary bg-primary/10"
                  : "border-border/30 bg-card/30 hover:border-border/50"
              )}
            >
              {accentColor === color.name && accentEnabled && !gradientEnabled && (
                <motion.div
                  layoutId="accentGlow"
                  className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                />
              )}
              
              <motion.div
                className="relative w-10 h-10 rounded-xl shadow-lg"
                style={{ backgroundColor: color.hex }}
                whileHover={{ rotate: 10 }}
              >
                {accentColor === color.name && accentEnabled && !gradientEnabled && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Check className="w-5 h-5 text-white drop-shadow-lg" />
                  </motion.div>
                )}
              </motion.div>
              
              <span className={cn(
                "text-xs font-medium transition-colors relative z-10",
                accentColor === color.name && accentEnabled && !gradientEnabled ? "text-foreground" : "text-muted-foreground"
              )}>
                {color.label}
              </span>
            </motion.button>
          ))}
        </div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetColors}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </motion.div>
      </motion.div>

      {/* Gradient Section */}
      <motion.div variants={itemVariants} className="space-y-5 pt-6 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Gradient Colors
              <motion.div
                className="w-4 h-4 rounded-full"
                style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />
            </h3>
            <p className="text-xs text-muted-foreground">Use gradient colors for accent</p>
          </div>
          <Switch
            checked={gradientEnabled}
            onCheckedChange={handleGradientToggle}
          />
        </div>

        <div className={cn(
          "space-y-5 transition-all duration-300",
          !gradientEnabled && "opacity-40 pointer-events-none blur-[1px]"
        )}>
          <div className="grid grid-cols-3 gap-3">
            {gradientPresets.map((gradient, index) => (
              <motion.button
                key={gradient.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleGradientSelect(gradient)}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all duration-300 overflow-hidden",
                  selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to && gradientEnabled
                    ? "border-primary"
                    : "border-border/30 hover:border-border/50"
                )}
              >
                <motion.div 
                  className="w-full h-10 rounded-lg mb-3 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}
                  whileHover={{ scale: 1.05 }}
                />
                <span className="text-xs font-medium text-muted-foreground">{gradient.name}</span>
                
                {selectedGradient?.from === gradient.from && selectedGradient?.to === gradient.to && gradientEnabled && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </motion.div>
                )}
              </motion.button>
            ))}
          </div>

          {/* Custom Gradient Creator */}
          <motion.div
            variants={cardVariants}
            className="p-5 rounded-xl bg-card/30 backdrop-blur-sm border border-border/30 space-y-5"
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Create Custom Gradient</span>
            
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</label>
                <div className="flex items-center gap-3">
                  <motion.label
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="color"
                      value={customGradientFrom}
                      onChange={(e) => setCustomGradientFrom(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-border/30 shadow-lg cursor-pointer"
                      style={{ backgroundColor: customGradientFrom }}
                    />
                  </motion.label>
                  <Input
                    type="text"
                    value={customGradientFrom}
                    onChange={(e) => setCustomGradientFrom(e.target.value)}
                    className="font-mono text-xs bg-background/50 h-9"
                  />
                </div>
              </div>
              
              <motion.div
                className="text-muted-foreground pt-5 text-lg"
                animate={{ x: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.div>
              
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</label>
                <div className="flex items-center gap-3">
                  <motion.label
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="color"
                      value={customGradientTo}
                      onChange={(e) => setCustomGradientTo(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-border/30 shadow-lg cursor-pointer"
                      style={{ backgroundColor: customGradientTo }}
                    />
                  </motion.label>
                  <Input
                    type="text"
                    value={customGradientTo}
                    onChange={(e) => setCustomGradientTo(e.target.value)}
                    className="font-mono text-xs bg-background/50 h-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <motion.div 
                className="flex-1 h-12 rounded-xl border border-border/30 shadow-lg overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${customGradientFrom}, ${customGradientTo})` }}
                whileHover={{ scale: 1.02 }}
              />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  size="sm" 
                  onClick={handleCustomGradientApply}
                  className="shrink-0 shadow-lg shadow-primary/20"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Apply
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Save Presets Section */}
      <motion.div variants={itemVariants} className="space-y-4 pt-6 border-t border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Saved Presets
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
            </h3>
            <p className="text-xs text-muted-foreground">Save and load your custom themes</p>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {showSaveInput ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2"
              >
                <Input
                  placeholder="Enter preset name..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="bg-background/50 border-border/50"
                  onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  autoFocus
                />
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button onClick={savePreset} size="sm" className="shrink-0">
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setShowSaveInput(false); setPresetName(""); }}
                    className="shrink-0"
                  >
                    Cancel
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button 
                  onClick={() => setShowSaveInput(true)}
                  variant="outline"
                  className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Current Settings as Preset
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {presets.length > 0 && (
          <motion.div 
            variants={containerVariants}
            className="space-y-2"
          >
            {presets.map((preset, index) => {
              const presetAccent = accentColors.find(c => c.name === preset.accentColor);
              return (
                <motion.div 
                  key={preset.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-card/30 backdrop-blur-sm border border-border/30 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-8 h-8 rounded-lg shadow-lg"
                      style={{ backgroundColor: presetAccent?.hex }}
                      whileHover={{ rotate: 15 }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {preset.theme === 'dark' ? '🌙 Dark' : '☀️ Light'} • {presetAccent?.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadPreset(preset)}
                        className="text-primary hover:bg-primary/10"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Load
                      </Button>
                    </motion.div>
                    <ConfirmDialog
                      trigger={
                        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      }
                      title="Delete Preset"
                      description={`Are you sure you want to delete "${preset.name}"?`}
                      confirmLabel="Delete"
                      variant="destructive"
                      onConfirm={() => deletePreset(preset.id)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {presets.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-muted-foreground text-center py-6"
          >
            No presets saved yet. Save your current settings to create a preset.
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );

  // Render Broker Section
  const renderBrokerSection = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link2 className="w-5 h-5 text-primary" />
          </motion.div>
          Broker Management
        </h2>
        <p className="text-sm text-muted-foreground mt-2 ml-[52px]">Connect and manage your trading accounts</p>
      </motion.div>
      <motion.div variants={itemVariants}>
        <BrokerManagement userId={userProfile?.user_id} />
      </motion.div>
    </motion.div>
  );

  // Render Data Section
  const renderDataSection = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Database className="w-5 h-5 text-primary" />
          </motion.div>
          Data & Import
        </h2>
        <p className="text-sm text-muted-foreground mt-2 ml-[52px]">Import trades from CSV files or export your data</p>
      </motion.div>
      <motion.div variants={itemVariants}>
        <CSVImportWrapper userId={userProfile?.user_id} />
      </motion.div>
    </motion.div>
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
    <div className="flex gap-8 max-w-5xl mx-auto">
      {/* Sidebar Navigation */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-64 shrink-0"
      >
        <div className="sticky top-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30"
                whileHover={{ scale: 1.1, rotate: -10 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings className="w-5 h-5 text-primary-foreground" />
              </motion.div>
              Settings
            </h1>
          </motion.div>
          
          <nav className="space-y-2">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ x: isActive ? 0 : 6 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group text-left relative overflow-hidden",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {/* Active background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavBg"
                      className="absolute inset-0 bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 rounded-xl"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  
                  <motion.div
                    className={cn(
                      "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0",
                      isActive 
                        ? "bg-primary/20 shadow-lg shadow-primary/20" 
                        : "bg-muted/30 group-hover:bg-muted/50"
                    )}
                    whileHover={{ rotate: 5 }}
                  >
                    <Icon className={cn(
                      "w-5 h-5 transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                  </motion.div>
                  
                  <div className="relative flex-1 min-w-0">
                    <span className={cn(
                      "text-sm font-semibold block truncate transition-colors",
                      isActive ? "text-primary" : ""
                    )}>
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {item.description}
                    </span>
                  </div>
                  
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="relative"
                    >
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="flex-1 max-w-2xl"
      >
        <div className="relative rounded-2xl overflow-hidden">
          {/* Glass background with animated gradient */}
          <div className="absolute inset-0 bg-card/40 backdrop-blur-xl" />
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-secondary/5 blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          />
          
          {/* Content */}
          <div className="relative border border-border/30 rounded-2xl">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSection}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {renderContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
