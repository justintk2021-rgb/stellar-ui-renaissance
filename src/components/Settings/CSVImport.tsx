import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, FileText, Check, X, AlertCircle, Loader2, Download, Info } from 'lucide-react';

interface ParsedTrade {
  date: string;
  pair: string;
  direction: string;
  result: number;
  session?: string;
  strategy?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

interface CSVImportProps {
  onImport: (trades: Omit<ParsedTrade, 'isValid' | 'errors'>[]) => Promise<void>;
}

const COLUMN_MAPPINGS = {
  date: ['date', 'trade_date', 'open_time', 'close_time', 'time', 'datetime', 'entry_date', 'exit_date'],
  pair: ['pair', 'symbol', 'instrument', 'asset', 'ticker', 'market'],
  direction: ['direction', 'type', 'side', 'action', 'buy_sell', 'position', 'trade_type'],
  result: ['result', 'profit', 'pnl', 'p&l', 'net_profit', 'realized_pnl', 'gross_profit', 'return'],
  session: ['session', 'trading_session', 'market_session'],
  strategy: ['strategy', 'setup', 'pattern', 'trade_setup', 'system'],
  notes: ['notes', 'comment', 'comments', 'description', 'remarks'],
};

export function CSVImport({ onImport }: CSVImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    date: '',
    pair: '',
    direction: '',
    result: '',
    session: '',
    strategy: '',
    notes: '',
  });
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');

  const resetState = () => {
    setCsvData([]);
    setHeaders([]);
    setParsedTrades([]);
    setColumnMap({
      date: '',
      pair: '',
      direction: '',
      result: '',
      session: '',
      strategy: '',
      notes: '',
    });
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const autoMapColumns = (headerRow: string[]) => {
    const newMap: Record<string, string> = {
      date: '',
      pair: '',
      direction: '',
      result: '',
      session: '',
      strategy: '',
      notes: '',
    };

    headerRow.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
        if (aliases.some(alias => normalizedHeader.includes(alias) || alias.includes(normalizedHeader))) {
          if (!newMap[field]) {
            newMap[field] = index.toString();
          }
        }
      }
    });

    return newMap;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      
      if (parsed.length < 2) {
        toast.error('CSV file must have at least a header row and one data row');
        return;
      }

      const headerRow = parsed[0];
      const dataRows = parsed.slice(1);
      
      setHeaders(headerRow);
      setCsvData(dataRows);
      setColumnMap(autoMapColumns(headerRow));
      setStep('map');
      
      toast.success(`Loaded ${dataRows.length} rows from CSV`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const normalizeDirection = (value: string): string => {
    const lower = value.toLowerCase().trim();
    if (['buy', 'long', 'b', 'l'].includes(lower)) return 'Long';
    if (['sell', 'short', 's', 'sh'].includes(lower)) return 'Short';
    return value;
  };

  const parseDate = (value: string): string | null => {
    // Try various date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = value.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [a, b, c] = parts.map(p => parseInt(p));
      // Try different orders
      const attempts = [
        new Date(c, b - 1, a), // DD/MM/YYYY
        new Date(c, a - 1, b), // MM/DD/YYYY
        new Date(a, b - 1, c), // YYYY/MM/DD
      ];
      
      for (const attempt of attempts) {
        if (!isNaN(attempt.getTime()) && attempt.getFullYear() > 1900) {
          return attempt.toISOString().split('T')[0];
        }
      }
    }
    
    return null;
  };

  const parseResult = (value: string): number | null => {
    const cleaned = value.replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  const handlePreview = () => {
    if (!columnMap.date || !columnMap.pair || !columnMap.direction || !columnMap.result) {
      toast.error('Please map all required fields (Date, Pair, Direction, Result)');
      return;
    }

    const trades: ParsedTrade[] = csvData.map((row, index) => {
      const errors: string[] = [];
      
      const dateVal = row[parseInt(columnMap.date)] || '';
      const pairVal = row[parseInt(columnMap.pair)] || '';
      const directionVal = row[parseInt(columnMap.direction)] || '';
      const resultVal = row[parseInt(columnMap.result)] || '';
      
      const parsedDate = parseDate(dateVal);
      const parsedResult = parseResult(resultVal);
      const normalizedDirection = normalizeDirection(directionVal);
      
      if (!parsedDate) errors.push('Invalid date');
      if (!pairVal.trim()) errors.push('Missing pair');
      if (!['Long', 'Short'].includes(normalizedDirection)) errors.push('Invalid direction');
      if (parsedResult === null) errors.push('Invalid result');
      
      return {
        date: parsedDate || dateVal,
        pair: pairVal.toUpperCase().trim(),
        direction: normalizedDirection,
        result: parsedResult || 0,
        session: columnMap.session ? row[parseInt(columnMap.session)]?.trim() : undefined,
        strategy: columnMap.strategy ? row[parseInt(columnMap.strategy)]?.trim() : undefined,
        notes: columnMap.notes ? row[parseInt(columnMap.notes)]?.trim() : undefined,
        isValid: errors.length === 0,
        errors,
      };
    });

    setParsedTrades(trades);
    setStep('preview');
  };

  const handleImport = async () => {
    const validTrades = parsedTrades.filter(t => t.isValid);
    
    if (validTrades.length === 0) {
      toast.error('No valid trades to import');
      return;
    }

    setIsLoading(true);
    try {
      await onImport(validTrades.map(({ isValid, errors, ...trade }) => trade));
      toast.success(`Successfully imported ${validTrades.length} trades`);
      resetState();
      setDialogOpen(false);
    } catch (error) {
      toast.error('Failed to import trades');
    } finally {
      setIsLoading(false);
    }
  };

  const validCount = parsedTrades.filter(t => t.isValid).length;
  const invalidCount = parsedTrades.filter(t => !t.isValid).length;

  const downloadTemplate = () => {
    const template = 'date,pair,direction,result,session,strategy,notes\n2024-01-15,EURUSD,Long,150.50,London,Breakout,Good setup\n2024-01-16,GBPUSD,Short,-75.00,New York,Reversal,Stopped out';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trade_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              CSV Import
            </CardTitle>
            <CardDescription className="mt-1">
              Import trades from any broker's CSV export
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetState(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {step === 'upload' && 'Upload CSV File'}
                  {step === 'map' && 'Map Columns'}
                  {step === 'preview' && 'Preview & Import'}
                </DialogTitle>
                <DialogDescription>
                  {step === 'upload' && 'Select a CSV file exported from your broker'}
                  {step === 'map' && 'Match your CSV columns to trade fields'}
                  {step === 'preview' && 'Review parsed trades before importing'}
                </DialogDescription>
              </DialogHeader>

              {/* Step 1: Upload */}
              {step === 'upload' && (
                <div className="space-y-4 py-4">
                  <div 
                    className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">Click to select CSV file</p>
                    <p className="text-sm text-muted-foreground mt-1">or drag and drop</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Supported formats: MT4/MT5 history, TradeLocker exports, or any CSV with date, pair, direction, and P&L columns.
                    </p>
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                </div>
              )}

              {/* Step 2: Map Columns */}
              {step === 'map' && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Date <span className="text-destructive">*</span>
                      </Label>
                      <Select value={columnMap.date} onValueChange={(v) => setColumnMap(m => ({ ...m, date: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Pair/Symbol <span className="text-destructive">*</span>
                      </Label>
                      <Select value={columnMap.pair} onValueChange={(v) => setColumnMap(m => ({ ...m, pair: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Direction <span className="text-destructive">*</span>
                      </Label>
                      <Select value={columnMap.direction} onValueChange={(v) => setColumnMap(m => ({ ...m, direction: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Result/P&L <span className="text-destructive">*</span>
                      </Label>
                      <Select value={columnMap.result} onValueChange={(v) => setColumnMap(m => ({ ...m, result: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Session (optional)</Label>
                      <Select value={columnMap.session} onValueChange={(v) => setColumnMap(m => ({ ...m, session: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Strategy (optional)</Label>
                      <Select value={columnMap.strategy} onValueChange={(v) => setColumnMap(m => ({ ...m, strategy: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {headers.map((h, i) => (
                            <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Preview of first row:</p>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {columnMap.date && (
                        <div><span className="text-muted-foreground">Date:</span> {csvData[0]?.[parseInt(columnMap.date)]}</div>
                      )}
                      {columnMap.pair && (
                        <div><span className="text-muted-foreground">Pair:</span> {csvData[0]?.[parseInt(columnMap.pair)]}</div>
                      )}
                      {columnMap.direction && (
                        <div><span className="text-muted-foreground">Direction:</span> {csvData[0]?.[parseInt(columnMap.direction)]}</div>
                      )}
                      {columnMap.result && (
                        <div><span className="text-muted-foreground">Result:</span> {csvData[0]?.[parseInt(columnMap.result)]}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                    <Button onClick={handlePreview} className="flex-1">Preview Trades</Button>
                  </div>
                </div>
              )}

              {/* Step 3: Preview */}
              {step === 'preview' && (
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="gap-1">
                      <Check className="w-3 h-3 text-green-500" />
                      {validCount} Valid
                    </Badge>
                    {invalidCount > 0 && (
                      <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                        <X className="w-3 h-3" />
                        {invalidCount} Invalid
                      </Badge>
                    )}
                  </div>

                  <div className="border rounded-lg max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Pair</TableHead>
                          <TableHead>Direction</TableHead>
                          <TableHead>Result</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedTrades.slice(0, 50).map((trade, i) => (
                          <TableRow key={i} className={!trade.isValid ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              {trade.isValid ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{trade.date}</TableCell>
                            <TableCell className="text-sm font-medium">{trade.pair}</TableCell>
                            <TableCell>
                              <Badge variant={trade.direction === 'Long' ? 'default' : 'secondary'} className="text-xs">
                                {trade.direction}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-sm font-medium ${trade.result >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {trade.result >= 0 ? '+' : ''}{trade.result.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {!trade.isValid && (
                                <span className="text-xs text-destructive">{trade.errors.join(', ')}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {parsedTrades.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Showing first 50 of {parsedTrades.length} trades
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
                    <Button 
                      onClick={handleImport} 
                      className="flex-1" 
                      disabled={isLoading || validCount === 0}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Import {validCount} Trades
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Import trades from broker CSV exports</p>
          <p className="text-xs mt-1">Supports MT4, MT5, TradeLocker, and custom formats</p>
        </div>
      </CardContent>
    </Card>
  );
}
