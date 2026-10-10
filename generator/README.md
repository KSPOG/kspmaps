# KSP Maps RuneLite Region Generator

This generator turns a local Old School RuneScape cache into KSP Maps region imagery using RuneLite's `MapImageDumper`.

It exports **every populated region on planes 0-3**. There is deliberately no surface-only Y filter, so high-Y coordinate spaces used by dungeons, caves and other underground maps are included automatically.

## Windows

Run from PowerShell:

```powershell
.\generator\generate-regions.ps1 `
  -CacheDir "C:\path\to\oldschool\cache" `
  -XteaPath "C:\path\to\xteas.json"
```

`-XteaPath` is optional, but encrypted regions cannot be rendered unless their XTEA keys are available.

The script clones RuneLite on first use, injects `KspRegionDumper` into the RuneLite cache module, runs it with RuneLite's real cache classes, then removes the injected source again.

## Output

```text
data/regions/
  manifest.json
  0/
    <regionId>.png
  1/
    <regionId>.png
  2/
    <regionId>.png
  3/
    <regionId>.png
```

Each PNG is a 64x64 OSRS region rendered at RuneLite's native map-dump scale of 4 pixels per game tile (256x256 pixels per region image).

The manifest records `regionId`, `baseX`, `baseY` and the planes that contain visible map data. A region whose base Y is in an underground/high-Y coordinate band is treated exactly like any other world region.

## Why region images

KSP Maps can load region images directly before a full TMS pyramid exists. This lets us add or refresh one missing dungeon/region without rebuilding the whole world map. The same files are consumed by the web viewer and the AIO Fighter picker.

## Updating coverage

1. Update/launch the OSRS client so the local cache is current.
2. Run the generator.
3. Review `data/regions/manifest.json` and generated PNGs.
4. Commit the generated region images and manifest to `KSPOG/kspmaps`.
5. AIO Fighter will begin using those KSP region images automatically; Explv remains only a fallback for regions that KSP Maps has not generated yet.
