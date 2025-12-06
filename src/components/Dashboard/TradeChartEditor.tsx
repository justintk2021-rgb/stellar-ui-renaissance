import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas as FabricCanvas, Line, Rect, FabricText } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpFromLine, 
  ArrowDownFromLine, 
  Target, 
  XCircle, 
  Save, 
  Trash2, 
  Download,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TradeChartEditorProps {
  pair: string;
  direction: 'Long' | 'Short';
  onSaveImage: (imageDataUrl: string) => void;
  existingImage?: string;
}

type LevelType = 'entry' | 'tp' | 'sl';

interface PriceLevel {
  type: LevelType;
  price: number;
  y: number;
}

const LEVEL_COLORS = {
  entry: { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.1)', label: 'Entry' },
  tp: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)', label: 'Take Profit' },
  sl: { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.1)', label: 'Stop Loss' },
};

export function TradeChartEditor({ pair, direction, onSaveImage, existingImage }: TradeChartEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<LevelType | null>(null);
  const [levels, setLevels] = useState<PriceLevel[]>([]);
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [tpPrice, setTpPrice] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const canvas = new FabricCanvas(canvasRef.current, {
      width: containerWidth,
      height: 300,
      backgroundColor: 'hsl(220, 20%, 6%)',
      selection: false,
    });

    // Draw grid
    drawGrid(canvas, containerWidth, 300);
    
    // Draw candlestick-like pattern
    drawCandlePattern(canvas, containerWidth, 300, direction);

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [direction]);

  // Resize handler
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const handleResize = () => {
      const containerWidth = containerRef.current?.offsetWidth || 400;
      fabricCanvas.setWidth(containerWidth);
      fabricCanvas.renderAll();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fabricCanvas]);

  const drawGrid = (canvas: FabricCanvas, width: number, height: number) => {
    const gridColor = 'rgba(255, 255, 255, 0.05)';
    const gridSpacing = 30;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSpacing) {
      const line = new Line([x, 0, x, height], {
        stroke: gridColor,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(line);
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSpacing) {
      const line = new Line([0, y, width, y], {
        stroke: gridColor,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(line);
    }
  };

  const drawCandlePattern = (canvas: FabricCanvas, width: number, height: number, dir: 'Long' | 'Short') => {
    const candleWidth = 12;
    const candleGap = 6;
    const startX = 40;
    const centerY = height / 2;
    
    // Generate a realistic-looking pattern based on direction
    const isLong = dir === 'Long';
    const baseY = isLong ? centerY + 40 : centerY - 40;
    const trend = isLong ? -1 : 1; // -1 means going up, 1 means going down
    
    for (let i = 0; i < Math.floor((width - 80) / (candleWidth + candleGap)); i++) {
      const x = startX + i * (candleWidth + candleGap);
      const volatility = Math.random() * 30 + 10;
      const moveY = trend * (i * 2 + Math.random() * 10 - 5);
      const candleY = baseY + moveY;
      
      const isGreen = Math.random() > (isLong ? 0.35 : 0.65);
      const bodyHeight = Math.random() * 15 + 5;
      const wickTop = Math.random() * 10 + 3;
      const wickBottom = Math.random() * 10 + 3;
      
      const color = isGreen ? '#22c55e' : '#ef4444';
      
      // Wick
      const wick = new Line([x + candleWidth / 2, candleY - wickTop, x + candleWidth / 2, candleY + bodyHeight + wickBottom], {
        stroke: color,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(wick);
      
      // Body
      const body = new Rect({
        left: x,
        top: candleY,
        width: candleWidth,
        height: bodyHeight,
        fill: isGreen ? color : 'transparent',
        stroke: color,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(body);
    }
  };

  const addPriceLevel = useCallback((type: LevelType, price: number) => {
    if (!fabricCanvas) return;

    const height = fabricCanvas.getHeight();
    const width = fabricCanvas.getWidth();
    
    // Convert price to Y position (simple linear mapping for demo)
    const minPrice = 0.5;
    const maxPrice = 2.0;
    const y = height - ((price - minPrice) / (maxPrice - minPrice)) * height;
    
    const config = LEVEL_COLORS[type];
    
    // Remove existing level of same type
    const existingObjects = fabricCanvas.getObjects().filter((obj: any) => obj.levelType === type);
    existingObjects.forEach(obj => fabricCanvas.remove(obj));
    
    // Add line
    const line = new Line([0, y, width, y], {
      stroke: config.stroke,
      strokeWidth: 2,
      strokeDashArray: type === 'entry' ? undefined : [8, 4],
      selectable: false,
      evented: false,
    });
    (line as any).levelType = type;
    fabricCanvas.add(line);
    
    // Add label background
    const labelBg = new Rect({
      left: width - 90,
      top: y - 12,
      width: 85,
      height: 24,
      fill: config.stroke,
      rx: 4,
      ry: 4,
      selectable: false,
      evented: false,
    });
    (labelBg as any).levelType = type;
    fabricCanvas.add(labelBg);
    
    // Add label text
    const labelText = new FabricText(`${config.label}: ${price.toFixed(4)}`, {
      left: width - 85,
      top: y - 8,
      fontSize: 11,
      fill: '#fff',
      fontFamily: 'JetBrains Mono, monospace',
      selectable: false,
      evented: false,
    });
    (labelText as any).levelType = type;
    fabricCanvas.add(labelText);
    
    // Add zone highlight
    const zoneHeight = 20;
    const zone = new Rect({
      left: 0,
      top: y - zoneHeight / 2,
      width: width - 95,
      height: zoneHeight,
      fill: config.fill,
      selectable: false,
      evented: false,
    });
    (zone as any).levelType = type;
    fabricCanvas.add(zone);
    
    fabricCanvas.renderAll();
    
    setLevels(prev => {
      const filtered = prev.filter(l => l.type !== type);
      return [...filtered, { type, price, y }];
    });
    
    toast.success(`${config.label} set at ${price.toFixed(4)}`);
  }, [fabricCanvas]);

  const handleAddLevel = (type: LevelType) => {
    const priceStr = type === 'entry' ? entryPrice : type === 'tp' ? tpPrice : slPrice;
    const price = parseFloat(priceStr);
    
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    
    addPriceLevel(type, price);
  };

  const clearLevel = (type: LevelType) => {
    if (!fabricCanvas) return;
    
    const existingObjects = fabricCanvas.getObjects().filter((obj: any) => obj.levelType === type);
    existingObjects.forEach(obj => fabricCanvas.remove(obj));
    fabricCanvas.renderAll();
    
    setLevels(prev => prev.filter(l => l.type !== type));
    
    if (type === 'entry') setEntryPrice('');
    if (type === 'tp') setTpPrice('');
    if (type === 'sl') setSlPrice('');
  };

  const clearAllLevels = () => {
    if (!fabricCanvas) return;
    
    ['entry', 'tp', 'sl'].forEach(type => {
      const existingObjects = fabricCanvas.getObjects().filter((obj: any) => obj.levelType === type);
      existingObjects.forEach(obj => fabricCanvas.remove(obj));
    });
    fabricCanvas.renderAll();
    
    setLevels([]);
    setEntryPrice('');
    setTpPrice('');
    setSlPrice('');
  };

  const saveAsImage = () => {
    if (!fabricCanvas) return;
    
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    onSaveImage(dataUrl);
    toast.success('Chart saved to notes!');
  };

  const downloadImage = () => {
    if (!fabricCanvas) return;
    
    const dataUrl = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    
    const link = document.createElement('a');
    link.download = `${pair}-trade-chart.png`;
    link.href = dataUrl;
    link.click();
    
    toast.success('Chart downloaded!');
  };

  // Calculate R:R if all levels set
  const entryLevel = levels.find(l => l.type === 'entry');
  const tpLevel = levels.find(l => l.type === 'tp');
  const slLevel = levels.find(l => l.type === 'sl');
  
  let riskReward = null;
  if (entryLevel && tpLevel && slLevel) {
    const risk = Math.abs(entryLevel.price - slLevel.price);
    const reward = Math.abs(tpLevel.price - entryLevel.price);
    riskReward = risk > 0 ? (reward / risk).toFixed(2) : null;
  }

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            direction === 'Long' ? "bg-primary/20" : "bg-destructive/20"
          )}>
            {direction === 'Long' ? (
              <TrendingUp className="w-5 h-5 text-primary" />
            ) : (
              <TrendingDown className="w-5 h-5 text-destructive" />
            )}
          </div>
          <div>
            <h4 className="font-semibold">{pair}</h4>
            <Badge variant="outline" className={cn(
              "text-[10px]",
              direction === 'Long' ? "border-primary/50 text-primary" : "border-destructive/50 text-destructive"
            )}>
              {direction}
            </Badge>
          </div>
        </div>
        
        {riskReward && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono font-bold text-primary">R:R {riskReward}</span>
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="rounded-xl overflow-hidden border border-border/50">
        <canvas ref={canvasRef} />
      </div>

      {/* Price Level Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Entry */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-2">
            <ArrowUpFromLine className="w-3 h-3 text-primary" />
            Entry Price
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.0001"
              placeholder="1.2345"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleAddLevel('entry')}
              className="h-9 px-3 border-primary/50 hover:bg-primary/10"
            >
              Set
            </Button>
          </div>
        </div>

        {/* Take Profit */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-2">
            <Target className="w-3 h-3 text-blue-500" />
            Take Profit
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.0001"
              placeholder="1.2500"
              value={tpPrice}
              onChange={(e) => setTpPrice(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleAddLevel('tp')}
              className="h-9 px-3 border-blue-500/50 hover:bg-blue-500/10"
            >
              Set
            </Button>
          </div>
        </div>

        {/* Stop Loss */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-2">
            <XCircle className="w-3 h-3 text-destructive" />
            Stop Loss
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.0001"
              placeholder="1.2300"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              className="font-mono text-sm h-9"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleAddLevel('sl')}
              className="h-9 px-3 border-destructive/50 hover:bg-destructive/10"
            >
              Set
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllLevels}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear All
        </Button>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImage}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button
            size="sm"
            onClick={saveAsImage}
            className="bg-primary hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Save to Notes
          </Button>
        </div>
      </div>
    </div>
  );
}