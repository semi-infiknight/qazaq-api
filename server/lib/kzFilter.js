import { isCommercialCatalogueEntry, isLegitimateKzCommercial } from "./kzCommercial.js";

/** Providers that belong in the Kazakhstan catalogue (non-commercial open data & gov). */
const KZ_PROVIDERS = new Set([
  "2GIS",
  "Air Astana",
  "Aladhan",
  "Alatau City Bank",
  "ApiPay.kz",
  "AsiaPay",
  "Aviata.kz",
  "Bank RBK",
  "Beeline Kazakhstan",
  "Bereke Bank",
  "Bureau of National Statistics",
  "CDEK",
  "Chocofamily",
  "eGov",
  "Eurasian Bank",
  "ForteBank",
  "FlyArystan",
  "Freedom Pay KZ",
  "Glovo",
  "Halyk Bank",
  "Halyk ePay",
  "Kaspi.kz",
  "Kazhydromet",
  "Kazpost",
  "Kazpost / MoD",
  "Kcell",
  "KGD",
  "KTZ",
  "MoD RK",
  "MoE RK",
  "MoH RK",
  "NBK",
  "NPCK",
  "Ozon",
  "Paybox",
  "PayBot.kz",
  "PS Cloud",
  "Qiwi Kazakhstan",
  "SCAT Airlines",
  "SIGEX",
  "Tickets.kz",
  "Tele2 Kazakhstan",
  "Wildberries",
  "Wooppay",
  "Wolt",
  "Woopkassa",
  "Yandex",
  "Yandex Go",
  "Yandex Market",
  "inDriver",
]);

/** Open-data / portal rows rebadged as KZ but clearly foreign sources. */
const KZ_OPEN_DATA_BLOCKLIST = new Set([
  "population_malaysia",
  "hies_malaysia_percentile",
  "my-bnm-kijang-emas",
  "my-bnm-exchange-rate",
  "my-bnm-interest-rate",
  "sgid-singpass",
  "onemap-sg",
  "lta-datamall",
  "data-gov-sg",
  "satu-data-indonesia",
  "ura-api",
  "data-go-th",
  "air4thai",
  "mas-data-api",
  "prasarana",
  "mybas-johor",
  "ktmb",
  "thailand-geography-json",
  "thailandformats-holidays",
  "emsifa-wilayah-indonesia",
  "kodepos-indonesia",
  "libur-indonesia",
  "equran-id",
  "opendosm",
]);

const FOREIGN_URL_MARKERS = [
  /\.gov\.sg\b/i,
  /\.go\.id\b/i,
  /\.gov\.my\b/i,
  /\.gov\.th\b/i,
  /ura\.gov\.sg/i,
  /mytransport\.sg/i,
  /data\.go\.id/i,
  /datamall\.lta\.gov\.sg/i,
  /eservice\.ura\.gov\.sg/i,
];

const FOREIGN_ID_MARKERS = /malaysia|singpass|singapore|indonesia|thailand|ura-api|onemap-sg|lta-datamall|data-gov-sg|data-go-th|mybas-johor|prasarana|my-bnm/i;

function entryUrls(entry) {
  return [entry.endpoint, entry.docs, entry.sourceUrl, entry.baseUrl].filter(Boolean);
}

function hasForeignOfficialUrl(entry) {
  return entryUrls(entry).some((url) => FOREIGN_URL_MARKERS.some((re) => re.test(url)));
}

function hasForeignIdentity(entry) {
  const id = entry.id || entry.slug || "";
  if (KZ_OPEN_DATA_BLOCKLIST.has(id)) return true;
  if (FOREIGN_ID_MARKERS.test(id)) return true;
  const note = entry.note || "";
  if (/\b(NRIC|Singpass|URA Singapore|data\.go\.id|LTA DataMall)\b/i.test(note)) return true;
  return false;
}

/**
 * Kazakhstan catalogue = allowlisted providers, data.egov dataset ids, kz-* / yandex-* modules.
 * Commercial entries must come from curated kz-* or yandex-* ids (blocks Malaysia→KZ rebrand junk).
 */
export function isKzCatalogueEntry(entry) {
  const countries = entry.country || [];
  if (!countries.includes("KZ")) return false;

  if (hasForeignOfficialUrl(entry) || hasForeignIdentity(entry)) return false;

  if (isCommercialCatalogueEntry(entry)) {
    return isLegitimateKzCommercial(entry);
  }

  if (entry.id?.startsWith("d_")) return true;
  if (entry.id?.startsWith("kz-")) return true;
  if (entry.id?.startsWith("yandex-") || entry.id?.startsWith("yandex_")) return true;
  if (KZ_PROVIDERS.has(entry.provider)) return true;

  return false;
}

export function filterKzCatalogue(apis) {
  return apis.filter(isKzCatalogueEntry);
}
