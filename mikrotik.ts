import { MikroClient } from "npm:mikro-client@0.5.3";
import secrets from "./secrets.json" assert { type: "json" };

const PARAM_REGEX = /^=([^=]*)=(.*)$/;

function parseResponse(response: unknown): Record<string, string> & { _: string[] } {
  const result: Record<string, string> = {};
  const rest: string[] = [];

  if (!Array.isArray(response)) throw new TypeError(`Expected array of strings, got ${typeof response}`);

  for (const line of response) {
    if (typeof line !== "string") throw new TypeError(`Expected array of strings, got array of ${typeof line}`);
    if (["", "!re"].includes(line)) continue;

    const [match, key, value] = line.match(PARAM_REGEX) ?? [];
    if (match) {
      result[key] = value;
    } else {
      rest.push(line);
    }
  }

  return { ...result, _: rest as any };
}

export class MikrotikConnection {
  private client = new MikroClient({ ...secrets.mikrotik, timeout: 5000 });

  async lteInfo() {
    return parseResponse(await this.client.talk(["/interface/lte/info", "=number=0"]));
  }

  async smsInbox() {
    return parseResponse(await this.client.talk(["/tool/sms/inbox/print"]));
  }

  sendSms() {}
}

console.log(await new MikrotikConnection().smsInbox());
