//I could've tried to modify d.ts files but I was having some issues so I copied and modified the original JS file.
//Besides, TS > JS :).

import dgram = require('dgram');
import EventEmitter = require('events');

export const OldFormat_APName = "smartlife.iot.common.softaponboarding";
export const OldFormat_LightingServiceName = "smartlife.iot.smartbulb.lightingservice";
export const OldFormat_SystemName = "smartlife.iot.common.system";
export const OldFormat_ScheduleName = "smartlife.iot.common.schedule";
export const OldFormat_CloudName = "smartlife.iot.common.cloud";

export class TPLSmartDevice
{
    private ip: string;
    private port: number;
    private _info?: dgram.RemoteInfo;
    private _sysInfo?: any;
    private host?: string;
    private name?: any;
    private deviceID?: any;

    constructor (
        ip: string,
        port: number,
        _info?: dgram.RemoteInfo,
        _sysInfo?: any,
        host?: string,
        name?: any,
        deviceID?: any
    )
    {
        this.ip = ip;
        this.port = port;
        this._info = _info;
        this._sysInfo = _sysInfo;
        this.host = host;
        this.name = name;
        this.deviceID = deviceID;
    }

    public static Scan(filter?: string, broadcast = "255.255.255.255"): { emitter: EventEmitter, client: dgram.Socket }
    {
        const emitter = new EventEmitter();
        const client = dgram.createSocket({ type: "udp4", reuseAddr: true });

        client.bind(9998, undefined, () =>
        {
            client.setBroadcast(true);
            const msgBuf = TPLSmartDevice.Encrypt(Buffer.from('{"system":{"get_sysinfo":{}}}'));
            client.send(msgBuf, 0, msgBuf.length, 9999, broadcast);
        });

        client.on("message", (msg, rinfo) =>
        {
            const decryptedMsg = TPLSmartDevice.Decrypt(msg).toString("ascii");
            const jsonMsg = JSON.parse(decryptedMsg);
            const sysInfo = jsonMsg.system.get_sysinfo;
            if (filter && sysInfo.mic_type !== filter) { return; }

            const light = new TPLSmartDevice(
                rinfo.address,
                rinfo.port,
                rinfo,
                sysInfo,
                rinfo.address,
                sysInfo.alias,
                sysInfo.deviceId
            );
            emitter.emit("light", light);
        });

        return { emitter: emitter, client: client };
    }

    public Send<T>(msg: object): Promise<T>
    {
        return new Promise((resolve, reject) =>
        {
            if (!this.ip) { return reject(new Error("IP not set.")); }
            if (!this.port) { return reject(new Error("Port not set.")); }

            const client = dgram.createSocket("udp4");
            const message = TPLSmartDevice.Encrypt(Buffer.from(JSON.stringify(msg)));

            client.send(message, 0, message.length, this.port, this.ip, (err, bytes) =>
            {
                if (err) { return reject(err); }

                client.on("message", clientMsg =>
                {
                    resolve(JSON.parse(TPLSmartDevice.Decrypt(clientMsg).toString()));
                    client.close();
                });
            });
        });
    }

    public async ListWiFi(): Promise<object>
    {
        const newFormatData: INewFormat =
        {
            netif:
            {
                get_scaninfo:
                {
                    refresh: 1
                }
            }
        }
        const r1 = await this.Send<INewFormat>(newFormatData)
            .catch(err => { throw err; });
        if (r1 != null && r1.netif != null && r1.netif.get_scaninfo != null && r1.netif.get_scaninfo.ap_list != null)
        {
            return r1.netif.get_scaninfo.ap_list;
        }

        //On fail, try the older message-format
        const oldFormatData: IOldFormat =
        {
            [OldFormat_APName]:
            {
                get_scaninfo:
                {
                    refresh: 1
                }
            }
        }
        const r2 = await this.Send<IOldFormat>(oldFormatData)
            .catch(err => { throw err; });
        if (r2 != null && r2[OldFormat_APName] != null && r2[OldFormat_APName]!.get_scaninfo != null && r2[OldFormat_APName]!.get_scaninfo!.ap_list != null)
        {
            return r2[OldFormat_APName]!.get_scaninfo!.ap_list!;
        }

        return [];
    }

    public async ConnectWiFi(ssid: string, password: string, keyType = 1, cypherType = 0): Promise<boolean>
    {
        const newFormatData: INewFormat =
        {
            netif:
            {
                set_stainfo:
                {
                    ssid,
                    password,
                    key_type: keyType,
                    cypher_type: cypherType
                }
            }
        }
        const r1 = await this.Send<INewFormat>(newFormatData)
            .catch(err => { throw err; });
        if ((
            r1 == null ? 0 :
            r1.netif == null ? 0 :
            r1.netif!.set_stainfo == null ? 0 :
            r1.netif!.set_stainfo!.err_code
        ) === 0)
        {
            return true;
        }

        //On fail, try the older message-format
        const oldFormatData: IOldFormat =
        {
            [OldFormat_APName]:
            {
                set_stainfo:
                {
                    ssid,
                    password,
                    key_type: keyType,
                    cypher_type: cypherType
                }
            }
        }
        const r2 = await this.Send<IOldFormat>(oldFormatData)
            .catch(err => { throw err; });
        if ((
            r2 == null ? 0 :
            r2[OldFormat_APName] == null ? 0 :
            r2[OldFormat_APName]!.set_stainfo == null ? 0 :
            r2[OldFormat_APName]!.set_stainfo!.err_code
        ) === 0)
        {
            return true;
        }

        return false;
    }

    public async Info(): Promise<IGetSYSInfo | null>
    {
        const data: INewFormat = { system: { get_sysinfo: {} } };
        const r = await this.Send<INewFormat>(data)
            .catch(err => { throw err; });
        if (r != null && r.system != null && r.system.get_sysinfo != null)
        {
            return r.system.get_sysinfo;
        }
        return null;
    }

    public async Power(powerState: boolean, transition: number = 0, options: IPowerOptions = {}): Promise<IInfoResponse | null>
    {
        const info = await this.Info()
            .catch(err => { throw err; });
        if (info?.relay_state != undefined)
        {
            const data: INewFormat =
            {
                system:
                {
                    set_relay_state:
                    {
                        state: powerState ? 1 : 0,
                    }
                }
            };
            return this.Send<IInfoResponse>(data)
                .catch(err => { throw err; });
        }
        else
        {
            var data: IOldFormat =
            {
                [OldFormat_LightingServiceName]:
                {
                    transition_light_state:
                    {
                        ignore_default: 1,
                        on_off: powerState ? 1 : 0,
                        transition_period: transition
                    }
                }
            };
            for (const key of Object.keys(options))
            {
                data[OldFormat_LightingServiceName]!.transition_light_state![key] = (options as any)[key];
            }

            const r = await this.Send<IOldFormat>(data)
                .catch(err => { throw err; });
            if (r != null && r[OldFormat_LightingServiceName] != null && r[OldFormat_LightingServiceName]!.transition_light_state != null)
            {
                //TODO: Find a way to check the response data for the old format.
                return r[OldFormat_LightingServiceName]!.transition_light_state;
            }
        }
        return null;
    }

    public Led(ledState: boolean): Promise<object>
    {
        const data: INewFormat =
        {
            system:
            {
                set_led_off:
                {
                    off: ledState ? 1 : 0
                }
            }
        };
        return this.Send<object>(data)
            .catch(err => { throw err; });
    }

    public async Name(newAlias: string)
    {
        const info = await this.Info()
            .catch(err => { throw err; });
        
        if (info == null || info.dev_name == undefined)
        {
            const data: INewFormat =
            {
                system:
                {
                    set_dev_alias:
                    {
                        alias: newAlias
                    }
                }
            };

            return this.Send<object>(data)
                .catch(err => { throw err; });
        }
        else
        {
            const data: IOldFormat =
            {
                [OldFormat_SystemName]:
                {
                    set_dev_alias:
                    {
                        alias: newAlias
                    }
                }
            };

            return this.Send<object>(data)
                .catch(err => { throw err; });
        }
    }

    public async DayStat(month: number, year: number): Promise<object | null>
    {
        const now = new Date();
        month = month || now.getMonth() + 1;
        year = year || now.getFullYear();
        const data: IOldFormat =
        {
            [OldFormat_ScheduleName]:
            {
                get_daystat:
                {
                    month,
                    year
                }
            }
        };
        const r = await this.Send<IOldFormat>(data)
            .catch(err => { throw err; });
        if (r != null && r[OldFormat_ScheduleName] != null && r[OldFormat_ScheduleName]!.get_daystat != null)
        {
            return r[OldFormat_ScheduleName]!.get_daystat!;
        }
        return null;
    }

    public async Cloud(): Promise<object | null>
    {
        const data: IOldFormat =
        {
            [OldFormat_CloudName]:
            {
                get_info: {}
            }
        };
        const r = await this.Send<IOldFormat>(data)
            .catch(err => { throw err; });
        if (r != null && r[OldFormat_CloudName] != null && r[OldFormat_CloudName]!.get_info != null)
        {
            return r[OldFormat_CloudName]!.get_info;
        }
        return null;
    }

    public async Schedule()
    {
        const data: IOldFormat =
        {
            [OldFormat_ScheduleName]:
            {
                get_rules: {}
            }
        };
        const r = await this.Send<IOldFormat>(data)
            .catch(err => { throw err; });
        if (r != null && r[OldFormat_ScheduleName] != null && r[OldFormat_ScheduleName]!.get_rules != null)
        {
            return r[OldFormat_ScheduleName]!.get_rules;
        }
        return null;
    }

    public Details(): Promise<any>
    {
        const data: IOldFormat =
        {
            [OldFormat_LightingServiceName]:
            {
                get_light_details: {}
            }
        };
        return this.Send<IOldFormat>(data)
            .catch(err => { throw err; });
    }

    public Reboot()
    {
        const data: IOldFormat =
        {
            [OldFormat_SystemName]:
            {
                reboot:
                {
                    delay: 1
                }
            }
        };
        return this.Send<IOldFormat>(data)
            .catch(err => { throw err; });
    }

    public static Encrypt(buf: Buffer, key = 0xAB): Buffer
    {
        for (let i = 0; i < buf.length; i++)
        {
            const char = buf[i];
            buf[i] = char ^ key;
            key = buf[i];
        }
        return buf;
    }

    public static Decrypt(buf: Buffer, key = 0xAB): Buffer
    {
        for (let i = 0; i < buf.length; i++)
        {
            const char = buf[i];
            buf[i] = char ^ key;
            key = char;
        }
        return buf;
    }
}

//#region Interfaces
//I need a full response with every data type and object avaliable so I know what types to put below and not have all of them nullable.
//#region Networking
export interface IGetScanInfo
{
    refresh?: number,
    ap_list?: object
}

export interface ISetSTAInfo
{
    ssid?: string,
    password?: string,
    key_type?: number,
    cypher_type?: number,
    err_code?: number
}

export interface INetRoot
{
    get_scaninfo?: IGetScanInfo,
    set_stainfo?: ISetSTAInfo
}
//#endregion

//#region System
export interface IGetSYSInfo
{
    relay_state?: number,
    dev_name?: string,
}

export interface ISetRelayState
{
    state: 0 | 1
}

export interface ILedState
{
    off: 0 | 1
}

export interface ISetDevAlias
{
    alias: string
}

export interface ISystemNew
{
    get_sysinfo?: IGetSYSInfo,
    set_relay_state?: ISetRelayState,
    set_led_off?: ILedState,
    set_dev_alias?: ISetDevAlias
}

export interface ISystemOld
{
    set_dev_alias?: ISetDevAlias,
    reboot?:
    {
        delay: number
    }
}

export interface ISchedule
{
    get_daystat?: IGetDayStat,
    get_rules?: object
}

export interface IGetDayStat
{
    month: number,
    year: number,
}

export interface ILightingService
{
    transition_light_state?: any,
    get_light_details?: object,
}

export interface IPowerOptions
{
    hue?: number,
    saturation?: number,
    brightness?: number,
    color_temp?: number
}
//#endregion

//#region Cloud
export interface ICloud
{
    get_info: object,
}
//#endregion

//#region Formats
export interface INewFormat
{
    netif?: INetRoot,
    system?: ISystemNew
}

export interface IOldFormat
{
    [OldFormat_APName]?: INetRoot,
    [OldFormat_LightingServiceName]?: ILightingService
    [OldFormat_SystemName]?: ISystemOld,
    [OldFormat_ScheduleName]?: ISchedule,
    [OldFormat_CloudName]?: ICloud
}
//#endregion

//#region Responses
export interface IInfoResponse
{
    sw_ver: string;
    hw_ver: string;
    model: string;
    description: string;
    alias: string;
    mic_type: string;
    dev_state: string;
    mic_mac: string;
    deviceId: string;
    oemId: string;
    hwId: string;
    is_factory: boolean;
    disco_ver: string;
    ctrl_protocols: ICtrlprotocols;
    light_state: ILightstate;
    is_dimmable: number;
    is_color: number;
    is_variable_color_temp: number;
    preferred_state: IPreferredstate[];
    rssi: number;
    active_mode: string;
    heapsize: number;
    err_code: number;
}

export interface IPreferredstate
{
    index: number;
    hue: number;
    saturation: number;
    color_temp: number;
    brightness: number;
}

export interface ILightstate
{
    on_off: number;
    mode: string;
    hue: number;
    saturation: number;
    color_temp: number;
    brightness: number;
}

export interface ICtrlprotocols
{
    name: string;
    version: string;
}
//#endregion
//#endregion