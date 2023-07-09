// deno-lint-ignore-file no-explicit-any

import { MikroClient } from "npm:mikro-client@0.5.3";
import secrets from "./secrets.json" assert { type: "json" };
import { delay } from "./util.ts";

export interface Options {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
}

export interface LteInfo {
  pinStatus: string;
  registrationStatus: string;
  functionality: string;
  manufacturer: string;
  model: string;
  revision: string;
  currentOperator: string | number;
  lac: number;
  currentCellid: number;
  enbId: number;
  sectorId: number;
  phyCellid: number;
  accessTechnology: string;
  sessionUptime: string;
  imei: number;
  imsi: number;
  uicc: number;
  primaryBand: string;
  primaryBandEarfcn: number;
  primaryBandPhyCellid: number;
  caBand?: string;
  caBandEarfcn: number;
  caBandPhyCellid: number;
  rssi: number;
  rsrp: number;
  rsrq: number;
  sinr: number;
  ri: number;
  cqi?: number
}

export class MikrotikConnection {
  constructor(public options: Options) {
    this.options.timeout ??= 5000;
  }

  async exec<T = Record<string, any>>({
    command,
    args,
    query,
  }: {
    command: string;
    args?: Record<string, string | number>;
    query?: Record<string, string | number>;
  }): Promise<T[]> {
    args ??= {};
    query ??= {};

    const client = new MikroClient({ ...this.options });
    const res = await client.talk([
      command,
      ...Object.entries(args).map(([key, value]) => `=${key}=${value}`),
      ...Object.entries(query).map(([key, value]) => `?${key}=${value}`),
    ]);

    return (client as any).toObj(res);
  }

  async lteInfo(): Promise<LteInfo> {
    const res = (
      await this.exec<LteInfo>({
        command: "/interface/lte/info",
        args: { number: 0 },
      })
    ).at(-1)!;

    const EARFCN = /earfcn:\s*(\d+)/;
    const PHYCELLID = /phy-cellid:\s*(\d+)/;
    const extract = (s: string | undefined, p: RegExp) => parseInt(s?.match(p)?.[1] ?? "");

    const primaryBandEarfcn = extract(res.primaryBand, EARFCN)!;
    const primaryBandPhyCellid = extract(res.primaryBand, PHYCELLID)!;
    const caBandEarfcn = extract(res.caBand, EARFCN);
    const caBandPhyCellid = extract(res.caBand, PHYCELLID);

    return { ...res, primaryBandEarfcn, primaryBandPhyCellid, caBandEarfcn, caBandPhyCellid };
  }

  async lteLock({
    primaryBandEarfcn,
    primaryBandPhyCellid,
  }: {
    primaryBandEarfcn: number;
    primaryBandPhyCellid: number;
  }) {
    return await this.exec({
      command: "/interface/lte/at-chat",
      args: {
        number: 0,
        input: `AT*Cell=2,3,,${primaryBandEarfcn},${primaryBandPhyCellid}`,
      },
    });
  }

  async lteUnlock() {
    return await this.exec({
      command: "/interface/lte/at-chat",
      args: { number: 0, input: `AT*Cell=0` },
    });
  }

  async smsInbox() {
    return await this.exec({ command: "/tool/sms/inbox/print" });
  }

  async sendSms({
    phoneNumber,
    message,
    splitIfTooLong,
  }: {
    phoneNumber: string;
    message: string;
    splitIfTooLong?: boolean;
  }) {
    // FIXME actual SMS limit is 160, but the library is broken
    // for attribute words longer than 127 characters
    if (message.length > 110 && !splitIfTooLong) throw new Error("Message too long!");
    const messages: string[] = message.match(/.{1,110}/g) ?? [];

    for (const m of messages) {
      await this.exec({
        command: "/tool/sms/send",
        args: { "phone-number": phoneNumber, message: m },
      });
    }
  }
}

const conn = new MikrotikConnection(secrets.mikrotik);
// console.log(
//   await conn.sendSms({
//     phoneNumber: "+420737765885",
//     message:
//       "c2=a2+b2",
//   })
// );
// console.log(await conn.smsInbox());
console.log(await conn.lteUnlock());
// console.log(await conn.lteLock({ primaryBandEarfcn: 6200, primaryBandPhyCellid: 287 }));
console.log(await conn.lteInfo());
