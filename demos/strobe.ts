import { TPLSmartDevice } from "../src/tplink-lightbulb";

console.log("RGB Cycle Demo");

//#region Args
var _ip: string | undefined;
if (process.argv.indexOf("--ip") != -1 && process.argv.indexOf("--ip") + 1 != -1)
{
    //For a basic demo I won't be doing any IP validation checks.
    _ip = process.argv[process.argv.indexOf("--ip") + 1];
}

var _cycleTime: number;
if (process.argv.indexOf("--cycleTime") != -1 && process.argv.indexOf("--cycleTime") + 1 != -1)
{
    var argInt = parseInt(process.argv[process.argv.indexOf("--cycleTime") + 1]);
    _cycleTime = !isNaN(argInt) ? argInt : 10;
}
else { _cycleTime = 10; }
//#endregion

if (_ip != undefined)
{
    const light = new TPLSmartDevice(_ip, 9999);
    light.Info().then(data => { console.log(data); });
    BeginStrobe(light, _cycleTime);
}
else
{
    console.log("Scanning for lights...");
    const scan = TPLSmartDevice.Scan();
    scan.emitter.on("light", (light: TPLSmartDevice) =>
    {
        console.log("Found light:", light);
        scan.client.close();
        BeginStrobe(light, _cycleTime);
    });
}
//#endregion

async function BeginStrobe(light: TPLSmartDevice, cycleTime: number): Promise<void>
{
    console.log("Starting Strobe");

    const sleepTime = cycleTime / 2;

    while (true)
    {
        try
        {
            console.log(await light.Power(true, 0,
            {
                hue: 0,
                saturation: 0,
                brightness: 100,
                color_temp: 5260
            }));
            await Sleep(sleepTime);
            console.log(await light.Power(false));
            await Sleep(sleepTime);
        }
        catch (ex)
        {
            console.log(ex);
        }
    }
}

//https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function Sleep(ms: number)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}