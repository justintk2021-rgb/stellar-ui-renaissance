import btc from "cryptocurrency-icons/svg/color/btc.svg?url";
import eth from "cryptocurrency-icons/svg/color/eth.svg?url";
import sol from "cryptocurrency-icons/svg/color/sol.svg?url";
import xrp from "cryptocurrency-icons/svg/color/xrp.svg?url";
import ada from "cryptocurrency-icons/svg/color/ada.svg?url";
import doge from "cryptocurrency-icons/svg/color/doge.svg?url";
import dot from "cryptocurrency-icons/svg/color/dot.svg?url";
import avax from "cryptocurrency-icons/svg/color/avax.svg?url";
import matic from "cryptocurrency-icons/svg/color/matic.svg?url";
import link from "cryptocurrency-icons/svg/color/link.svg?url";
import ltc from "cryptocurrency-icons/svg/color/ltc.svg?url";
import bnb from "cryptocurrency-icons/svg/color/bnb.svg?url";
import uni from "cryptocurrency-icons/svg/color/uni.svg?url";
import atom from "cryptocurrency-icons/svg/color/atom.svg?url";
import fil from "cryptocurrency-icons/svg/color/fil.svg?url";
import aave from "cryptocurrency-icons/svg/color/aave.svg?url";
import mkr from "cryptocurrency-icons/svg/color/mkr.svg?url";
import bch from "cryptocurrency-icons/svg/color/bch.svg?url";
import xlm from "cryptocurrency-icons/svg/color/xlm.svg?url";
import trx from "cryptocurrency-icons/svg/color/trx.svg?url";
import etc from "cryptocurrency-icons/svg/color/etc.svg?url";
import xmr from "cryptocurrency-icons/svg/color/xmr.svg?url";
import ape from "cryptocurrency-icons/svg/color/ape.svg?url";
import crv from "cryptocurrency-icons/svg/color/crv.svg?url";
import sand from "cryptocurrency-icons/svg/color/sand.svg?url";
import mana from "cryptocurrency-icons/svg/color/mana.svg?url";
import algo from "cryptocurrency-icons/svg/color/algo.svg?url";
import icp from "cryptocurrency-icons/svg/color/icp.svg?url";
import vet from "cryptocurrency-icons/svg/color/vet.svg?url";
import eos from "cryptocurrency-icons/svg/color/eos.svg?url";
import xtz from "cryptocurrency-icons/svg/color/xtz.svg?url";
import theta from "cryptocurrency-icons/svg/color/theta.svg?url";
import enj from "cryptocurrency-icons/svg/color/enj.svg?url";
import chz from "cryptocurrency-icons/svg/color/chz.svg?url";
import dash from "cryptocurrency-icons/svg/color/dash.svg?url";
import zec from "cryptocurrency-icons/svg/color/zec.svg?url";
import comp from "cryptocurrency-icons/svg/color/comp.svg?url";
import snx from "cryptocurrency-icons/svg/color/snx.svg?url";
import grt from "cryptocurrency-icons/svg/color/grt.svg?url";

export const CRYPTO_ICON_URL: Record<string, string> = {
  BTC: btc,
  ETH: eth,
  SOL: sol,
  XRP: xrp,
  ADA: ada,
  DOGE: doge,
  DOT: dot,
  AVAX: avax,
  MATIC: matic,
  POL: matic,
  LINK: link,
  LTC: ltc,
  BNB: bnb,
  UNI: uni,
  ATOM: atom,
  FIL: fil,
  AAVE: aave,
  MKR: mkr,
  BCH: bch,
  XLM: xlm,
  TRX: trx,
  ETC: etc,
  XMR: xmr,
  APE: ape,
  CRV: crv,
  SAND: sand,
  MANA: mana,
  ALGO: algo,
  ICP: icp,
  VET: vet,
  EOS: eos,
  XTZ: xtz,
  THETA: theta,
  ENJ: enj,
  CHZ: chz,
  DASH: dash,
  ZEC: zec,
  COMP: comp,
  SNX: snx,
  GRT: grt,
};

/** Known crypto tickers even when the package has no SVG — used for classification. */
export const CRYPTO_TICKERS = new Set([
  ...Object.keys(CRYPTO_ICON_URL),
  "NEAR", "APT", "ARB", "OP", "SUI", "TON", "SHIB", "PEPE", "WIF", "BONK",
  "SEI", "TIA", "INJ", "FET", "RNDR", "RENDER", "HBAR", "STX", "IMX",
]);
