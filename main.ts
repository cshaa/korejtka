import secrets from "./secrets.json" assert { type: "json" };

async function checkMobileData() {
  const { username, password } = secrets.kaktus;

  // retrieve the session token cookie
  const setCookie = (
    await fetch(`https://www.mujkaktus.cz/homepage`)
  ).headers.get("Set-Cookie");
  // const [cookieName, cookieValue] = headers
  //   .get("Set-Cookie")
  //   ?.split(";")[0]
  //   ?.split("=") ?? [undefined, undefined];

  const response = await fetch(
    `https://www.mujkaktus.cz/.gang/login?username=${username}&password=${password}`,
    {
      headers: new Headers({
        Cookie: "A=B",
      }),
    }
  );

  return await response.text();
}

await checkMobileData();
