import eu from "flag-icons/flags/1x1/eu.svg?url";
import us from "flag-icons/flags/1x1/us.svg?url";
import gb from "flag-icons/flags/1x1/gb.svg?url";
import jp from "flag-icons/flags/1x1/jp.svg?url";
import au from "flag-icons/flags/1x1/au.svg?url";
import nz from "flag-icons/flags/1x1/nz.svg?url";
import ca from "flag-icons/flags/1x1/ca.svg?url";
import ch from "flag-icons/flags/1x1/ch.svg?url";
import hk from "flag-icons/flags/1x1/hk.svg?url";
import sg from "flag-icons/flags/1x1/sg.svg?url";
import cn from "flag-icons/flags/1x1/cn.svg?url";
import za from "flag-icons/flags/1x1/za.svg?url";
import mx from "flag-icons/flags/1x1/mx.svg?url";
import no from "flag-icons/flags/1x1/no.svg?url";
import se from "flag-icons/flags/1x1/se.svg?url";
import dk from "flag-icons/flags/1x1/dk.svg?url";
import pl from "flag-icons/flags/1x1/pl.svg?url";
import tr from "flag-icons/flags/1x1/tr.svg?url";
import hu from "flag-icons/flags/1x1/hu.svg?url";
import cz from "flag-icons/flags/1x1/cz.svg?url";
import il from "flag-icons/flags/1x1/il.svg?url";
import th from "flag-icons/flags/1x1/th.svg?url";
import inFlag from "flag-icons/flags/1x1/in.svg?url";
import kr from "flag-icons/flags/1x1/kr.svg?url";
import tw from "flag-icons/flags/1x1/tw.svg?url";
import br from "flag-icons/flags/1x1/br.svg?url";
import ru from "flag-icons/flags/1x1/ru.svg?url";
import cl from "flag-icons/flags/1x1/cl.svg?url";
import ph from "flag-icons/flags/1x1/ph.svg?url";
import my from "flag-icons/flags/1x1/my.svg?url";
import id from "flag-icons/flags/1x1/id.svg?url";
import sa from "flag-icons/flags/1x1/sa.svg?url";
import ae from "flag-icons/flags/1x1/ae.svg?url";
import qa from "flag-icons/flags/1x1/qa.svg?url";
import kw from "flag-icons/flags/1x1/kw.svg?url";
import eg from "flag-icons/flags/1x1/eg.svg?url";
import ro from "flag-icons/flags/1x1/ro.svg?url";
import bg from "flag-icons/flags/1x1/bg.svg?url";
import is from "flag-icons/flags/1x1/is.svg?url";
import ua from "flag-icons/flags/1x1/ua.svg?url";
import vn from "flag-icons/flags/1x1/vn.svg?url";
import pk from "flag-icons/flags/1x1/pk.svg?url";
import co from "flag-icons/flags/1x1/co.svg?url";
import ar from "flag-icons/flags/1x1/ar.svg?url";
import pe from "flag-icons/flags/1x1/pe.svg?url";
import fr from "flag-icons/flags/1x1/fr.svg?url";
import de from "flag-icons/flags/1x1/de.svg?url";
import es from "flag-icons/flags/1x1/es.svg?url";
import it from "flag-icons/flags/1x1/it.svg?url";
import nl from "flag-icons/flags/1x1/nl.svg?url";

/** ISO 4217 currency code -> flag-icons 1x1 SVG URL. */
export const CURRENCY_FLAG_URL: Record<string, string> = {
  EUR: eu,
  USD: us,
  USDT: us,
  USDC: us,
  GBP: gb,
  JPY: jp,
  AUD: au,
  NZD: nz,
  CAD: ca,
  CHF: ch,
  HKD: hk,
  SGD: sg,
  CNH: cn,
  CNY: cn,
  ZAR: za,
  MXN: mx,
  NOK: no,
  SEK: se,
  DKK: dk,
  PLN: pl,
  TRY: tr,
  HUF: hu,
  CZK: cz,
  ILS: il,
  THB: th,
  INR: inFlag,
  KRW: kr,
  TWD: tw,
  BRL: br,
  RUB: ru,
  CLP: cl,
  PHP: ph,
  MYR: my,
  IDR: id,
  SAR: sa,
  AED: ae,
  QAR: qa,
  KWD: kw,
  EGP: eg,
  RON: ro,
  BGN: bg,
  ISK: is,
  UAH: ua,
  VND: vn,
  PKR: pk,
  COP: co,
  ARS: ar,
  PEN: pe,
};

/** Country / region ISO 3166-1 alpha-2 -> 1x1 flag (indices). */
export const COUNTRY_FLAG_URL: Record<string, string> = {
  EU: eu,
  US: us,
  GB: gb,
  JP: jp,
  AU: au,
  HK: hk,
  CN: cn,
  FR: fr,
  DE: de,
  ES: es,
  IT: it,
  NL: nl,
  CH: ch,
  SG: sg,
  CA: ca,
};
