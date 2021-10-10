import { TPLSmartDevice } from "../src/tplink-lightbulb";

console.log("RGB Cycle Demo");

//#region Args
var _resolution: number;
if (process.argv.indexOf("--resolution") != -1 && process.argv.indexOf("--resolution") + 1 != -1)
{
    var argInt = parseInt(process.argv[process.argv.indexOf("--cycleTime") + 1]);
    _resolution = !isNaN(argInt) ? argInt : 6;
}
else { _resolution = 6; }

var _cycleTime: number;
if (process.argv.indexOf("--cycleTime") != -1 && process.argv.indexOf("--cycleTime") + 1 != -1)
{
    var argInt = parseInt(process.argv[process.argv.indexOf("--cycleTime") + 1]);
    _cycleTime = !isNaN(argInt) ? argInt : 1000;
}
else { _cycleTime = 1000; }

var _ip: string | undefined;
if (process.argv.indexOf("--ip") != -1 && process.argv.indexOf("--ip") + 1 != -1)
{
    //For a basic demo I won't be doing any IP validation checks.
    _ip = process.argv[process.argv.indexOf("--ip") + 1];
}
//#endregion

if (_ip != undefined)
{
    BeginRGBCycle(new TPLSmartDevice(_ip, 9999), _resolution, _cycleTime);
}
else
{
    console.log("Scanning for lights...");
    const scan = TPLSmartDevice.Scan();
    scan.emitter.on("light", (light: TPLSmartDevice) =>
    {
        console.log("Found light:", light);
        scan.client.close();
        BeginRGBCycle(light, _resolution, _cycleTime);
    });
}
//#endregion

async function BeginRGBCycle(light: TPLSmartDevice, resolution: number = 6, cycleTime = 1000): Promise<void>
{
    console.log("Starting RGB Cycle");

    if (resolution > 360) { resolution = 360; }
    else if (resolution < 1) { resolution = 1; }

    const step = 360 / resolution;
    const sleepTime = cycleTime / resolution;

    while (true)
    {
        for (let i = 0; i < resolution; i+= step)
        {
            SetLightColourFromHex(light, i, 100, 50, sleepTime)
            await Sleep(sleepTime);
        }
    }
}

async function SetLightColourFromHex(light: TPLSmartDevice, h: number, s: number, l: number, transitionTime = 0): Promise<boolean>
{
    const response = await light.Power(true, transitionTime,
    {
        hue: h,
        saturation: s,
        brightness: l
    });

    return response == null;
}

//https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function Sleep(ms: number)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}