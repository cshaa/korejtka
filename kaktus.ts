import { CookieJar, wrapFetch } from "https://deno.land/x/another_cookiejar@v5.0.2/mod.ts";
import {
  DOMParser,
  Element,
  HTMLDocument,
  NodeList,
} from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts";

import secrets from "./secrets.json" assert { type: "json" };

/** throw expression */
const yeet = (err: any): never => {
  throw err;
};

/** wait for a specified number of milliseconds */
const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const onlyElements = (list: NodeList | undefined): Element[] =>
  [...(list ?? [])].filter((el): el is Element => el instanceof Element);

async function responseToHtml(res: Response): Promise<HTMLDocument> {
  const parser = new DOMParser();
  const dom = parser.parseFromString(await res.text(), "text/html");
  if (!dom) throw new Error("Failed to parse HTML.");
  return dom;
}

function kaktusParseIslandElement(el: Element) {
  const title = el.previousElementSibling?.textContent ?? "";
  const requestId = JSON.parse(el.getAttribute("data-lazy-loading") ?? "{}")?.rk;
  const componentId = el.id;
  return { title, requestId, componentId };
}

async function kaktusLoadLazyIslands(
  cookieJar: CookieJar,
  parentEl: Element
): Promise<Array<{ title: string; el: Element }>> {
  const islandEls = onlyElements(parentEl.querySelectorAll("[data-lazy-loading]"));

  const islands = islandEls.map(kaktusParseIslandElement);
  const awaitedIslands = await Promise.all(
    islands.map(({ title, requestId, componentId }) =>
      kaktusFetchIsland(cookieJar, requestId, componentId).then((el) => ({ title, el }))
    )
  );

  return awaitedIslands;
}

async function kaktusFetchIsland(
  cookieJar: CookieJar,
  requestId: string,
  componentId: string,
  attempts = 10
): Promise<Element> {
  if (attempts <= 0) throw "Could not load lazy-loaded islands in the specified number of attempts.";
  const fetch = wrapFetch({ cookieJar });

  const lazyLoadingURLs =
    "https://www.mujkaktus.cz/moje-sluzby" +
    "?p_p_id=rkaktusvcc_WAR_vcc&p_p_lifecycle=0" +
    "&p_p_state=exclusive&p_p_mode=view" +
    "&p_p_col_id=column-1&p_p_col_count=1" +
    "&_rkaktusvcc_WAR_vcc_moduleCode=dashboard" +
    "&_rkaktusvcc_WAR_vcc_lazyLoading=true" +
    "&_rkaktusvcc_WAR_vcc_componentIds=" +
    `${requestId}.${componentId}`;

  const islandsResponse = await fetch(lazyLoadingURLs);
  const islandsDom = await responseToHtml(islandsResponse);

  const loadingEl = islandsDom.querySelector("[data-lazy-loading]");

  if (loadingEl) {
    await delay(50); // wait 50ms before asking again

    const { requestId, componentId } = kaktusParseIslandElement(loadingEl);
    return await kaktusFetchIsland(cookieJar, requestId, componentId, attempts - 1);
  }

  return islandsDom.getElementById(componentId)!;
}

export interface KaktusStatus {
  credit: {
    total: number;
    standard: {
      amount: number;
      expires: Date;
    };
    bonus: {
      amount: number;
      expires: Date;
    };
  };

  tariff: {
    autoSubscription: boolean;
    tariffName: string;
    renewalDate: Date;

    gigsLeft: number;
    minutesLeft: number;
    secondsLeft: number;
    smsLeft: number;
  };
}

function findElementByTextContent(parent: Element | undefined, selector: string, pattern: string): Element | undefined {
  return onlyElements(parent?.querySelectorAll(selector)).find((el) =>
    el.textContent.toLocaleLowerCase().includes(pattern)
  );
}

function parseDate(dateString: string): Date {
  const [_, day, month, year] = dateString.match(/(\d{1,2}).(\d{1,2}).(\d{4})/) ?? [];
  return new Date(+year, +month - 1, +day);
}

function parseDecimal(decimalString: string): number {
  return parseFloat(decimalString.replace(",", "."));
}

export async function kaktusCheckStatus(): Promise<KaktusStatus> {
  const cookieJar = new CookieJar();

  const fetch = wrapFetch({ cookieJar });
  const { username, password } = secrets.kaktus;

  // retrieve the session cookies and log in
  await fetch(`https://www.mujkaktus.cz/moje-sluzby`);
  await fetch(`https://www.mujkaktus.cz/delegate/recdef`);
  await fetch(`https://www.mujkaktus.cz/.gang/login?username=${username}&password=${password}`);

  // initiate lazy loading
  const skeletonResponse = await fetch(`https://www.mujkaktus.cz/moje-sluzby`);
  const skeletonDOM = await responseToHtml(skeletonResponse);

  // find the lazy-loaded islands and finish loading
  const portletRoot = skeletonDOM.querySelector(".portlet-body") ?? yeet("Portlet root not found in HTML.");
  const islands = await kaktusLoadLazyIslands(cookieJar, portletRoot);

  // extract the stats

  const creditIsland = islands.find(({ title }) => title.includes("kredit"))?.el;
  const standardCredit = findElementByTextContent(creditIsland, "p.font-size-xs", "standard")?.textContent ?? "";
  const bonusCredit = findElementByTextContent(creditIsland, "p.font-size-xs", "bonus")?.textContent ?? "";

  const tariffIsland = islands.find(({ title }) => title.toLowerCase().includes("balíč"))?.el;
  const findLabeledEl = (label: string) =>
    findElementByTextContent(tariffIsland, "p", label)?.previousElementSibling?.textContent;
  const data = findLabeledEl("data");
  const calls = findLabeledEl("minut");
  const sms = findLabeledEl("sms");

  const name =
    findElementByTextContent(tariffIsland, "p", "balíček:")?.querySelector("strong");
  const autoSubscription = !!findElementByTextContent(tariffIsland, "span.badge", "samoobnovující");
  const renewal = findElementByTextContent(tariffIsland, "p", "obnoví se")?.querySelector("strong");

  return {
    credit: {
      total: parseInt(creditIsland?.querySelector(".price")?.textContent!),
      standard: {
        amount: parseInt(standardCredit.match(/\d[\d\s]+/)?.[0]!),
        expires: parseDate(standardCredit),
      },
      bonus: {
        amount: parseInt(bonusCredit.match(/\d[\d\s]+/)?.[0]!),
        expires: parseDate(bonusCredit),
      },
    },
    tariff: {
      tariffName: name?.textContent ?? "",
      autoSubscription,
      renewalDate: parseDate(renewal?.textContent!),

      gigsLeft: parseDecimal(data!),
      minutesLeft: parseDecimal(calls!),
      secondsLeft: parseDecimal(calls?.split(":")[1]!),
      smsLeft: parseDecimal(sms!),
    },
  };
}
