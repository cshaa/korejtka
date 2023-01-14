import { CookieJar, wrapFetch } from "https://deno.land/x/another_cookiejar@v5.0.2/mod.ts";
import { DOMParser, Element, HTMLDocument } from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts";

import secrets from "./secrets.json" assert { type: "json" };

/** throw expression */
const yeet = (err: any): never => {
  throw err;
};

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
  const islandNodes = [...parentEl.querySelectorAll("[data-lazy-loading]")];
  const islandEls = islandNodes.filter((el): el is Element => el instanceof Element);

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
    const { requestId, componentId } = kaktusParseIslandElement(loadingEl);
    return kaktusFetchIsland(cookieJar, requestId, componentId, attempts - 1);
  }

  return islandsDom.getElementById(componentId)!;
}

export async function checkMobileData() {
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

  // find the lazy-loaded islands
  const portletRoot = skeletonDOM.querySelector(".portlet-body") ?? yeet("Portlet root not found in HTML.");

  const islands = await kaktusLoadLazyIslands(cookieJar, portletRoot);
  console.log(islands.map(({ title, el }) => ({ title, content: el.textContent.trim() })));

  return islands;
}

await checkMobileData();
