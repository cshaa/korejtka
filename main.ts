import { CookieJar, wrapFetch } from "https://deno.land/x/another_cookiejar@v5.0.2/mod.ts";
import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

import secrets from "./secrets.json" assert { type: "json" };

/** throw expression */
const yeet = (err: any): never => {
  throw err;
};

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
  const skeletonDOM =
    new DOMParser().parseFromString(await skeletonResponse.text(), "text/html") ?? yeet("Failed to parse HTML.");

  // find the lazy-loaded islands
  const portletRoot = skeletonDOM.querySelector(".portlet-body") ?? yeet("Portlet root not found in HTML.");
  const islandNodes = [...portletRoot.querySelectorAll("[data-lazy-loading]")];
  const islandEls = islandNodes.filter((el): el is Element => el instanceof Element);

  const islands = islandEls.map((el) => {
    const text = el.previousElementSibling?.textContent ?? "";
    const mainId = JSON.parse(el.getAttribute("data-lazy-loading") ?? "{}")?.rk;
    const subId = el.id;
    return { text, mainId, subId };
  });

  console.log(islands);

  // load islands
  const lazyLoadingURLs =
    "https://www.mujkaktus.cz/moje-sluzby" +
    "?p_p_id=rkaktusvcc_WAR_vcc&p_p_lifecycle=0" +
    "&p_p_state=exclusive&p_p_mode=view" +
    "&p_p_col_id=column-1&p_p_col_count=1" +
    "&_rkaktusvcc_WAR_vcc_moduleCode=dashboard" +
    "&_rkaktusvcc_WAR_vcc_lazyLoading=true" +
    "&_rkaktusvcc_WAR_vcc_componentIds=" +
    islands.map(({ mainId, subId }) => [mainId, subId].join(".")).join("|");
    
  const islandsText = await (await fetch(lazyLoadingURLs)).text();

  console.log(islandsText);
  return islandsText;
}

await checkMobileData();
