import { memo, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  ASSET_ICON_PX,
  markStockLogoFailed,
  pairBoxWidth,
  resolveAssetIcon,
  stockLogoFailed,
  type AssetIconSize,
  type ResolvedAssetIcon,
} from "@/lib/assetIcons";

interface AssetIconProps {
  symbol: string;
  size?: AssetIconSize;
  className?: string;
}

function Face({
  src,
  alt,
  px,
  className,
  onError,
}: {
  src: string;
  alt: string;
  px: number;
  className?: string;
  onError?: () => void;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={px}
      height={px}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={onError}
      className={cn("block h-full w-full object-cover", className)}
    />
  );
}

function LetterBadge({ letters, px }: { letters: string; px: number }) {
  return (
    <span
      className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground font-semibold uppercase leading-none"
      style={{ fontSize: Math.max(8, Math.round(px * 0.38)) }}
    >
      {letters}
    </span>
  );
}

function Circle({
  px,
  children,
  className,
  style,
}: {
  px: number;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-background",
        className,
      )}
      style={{ width: px, height: px, ...style }}
    >
      {children}
    </span>
  );
}

function PairStack({
  front,
  back,
  letters,
  size,
  symbol,
}: {
  front: string;
  back: string;
  letters: string;
  size: AssetIconSize;
  symbol: string;
}) {
  const { face, overlap } = ASSET_ICON_PX[size];
  const width = pairBoxWidth(size);
  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width, height: face }}
      title={symbol}
    >
      <Circle
        px={face}
        className="absolute top-0"
        style={{ left: face - overlap, zIndex: 0 }}
      >
        <Face src={back} alt="" px={face} />
      </Circle>
      <Circle
        px={face}
        className="absolute top-0 left-0"
        style={{ zIndex: 1 }}
      >
        <Face src={front} alt={letters} px={face} />
      </Circle>
    </span>
  );
}

function BadgeIcon({
  src,
  letters,
  size,
  symbol,
  onError,
}: {
  src: string;
  letters: string;
  size: AssetIconSize;
  symbol: string;
  onError?: () => void;
}) {
  const { box } = ASSET_ICON_PX[size];
  return (
    <Circle px={box} className="shrink-0">
      <Face src={src} alt={symbol} px={box} onError={onError} />
    </Circle>
  );
}

function AssetIconInner({ symbol, size = "md", className }: AssetIconProps) {
  const resolved = useMemo(() => resolveAssetIcon(symbol), [symbol]);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      aria-hidden={false}
      role="img"
      aria-label={symbol}
    >
      <ResolvedFace resolved={resolved} size={size} symbol={symbol} />
    </span>
  );
}

function ResolvedFace({
  resolved,
  size,
  symbol,
}: {
  resolved: ResolvedAssetIcon;
  size: AssetIconSize;
  symbol: string;
}) {
  const { box } = ASSET_ICON_PX[size];
  const [stockFailed, setStockFailed] = useState(
    resolved.kind === "stock" && stockLogoFailed(resolved.ticker),
  );

  if (resolved.kind === "pair") {
    return (
      <PairStack
        front={resolved.front}
        back={resolved.back}
        letters={resolved.letters}
        size={size}
        symbol={symbol}
      />
    );
  }

  if (resolved.kind === "badge") {
    return <BadgeIcon src={resolved.src} letters={resolved.letters} size={size} symbol={symbol} />;
  }

  if (resolved.kind === "stock" && !stockFailed) {
    return (
      <BadgeIcon
        src={resolved.src}
        letters={resolved.letters}
        size={size}
        symbol={symbol}
        onError={() => {
          markStockLogoFailed(resolved.ticker);
          setStockFailed(true);
        }}
      />
    );
  }

  return (
    <Circle px={box}>
      <LetterBadge letters={resolved.letters} px={box} />
    </Circle>
  );
}

/** TradingView-style asset mark. Sizes are fixed to avoid layout shift. */
export const AssetIcon = memo(AssetIconInner);

/** Icon placed to the left of existing symbol text without changing typography. */
export const SymbolMark = memo(function SymbolMark({
  symbol,
  size = "sm",
  className,
  textClassName,
}: {
  symbol: string;
  size?: AssetIconSize;
  className?: string;
  textClassName?: string;
}) {
  const empty = !symbol || symbol === "—";
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {!empty && <AssetIcon symbol={symbol} size={size} />}
      <span className={cn("truncate", textClassName)}>{symbol || "—"}</span>
    </span>
  );
});
