package net.runelite.cache;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;
import net.runelite.cache.fs.Store;
import net.runelite.cache.region.Location;
import net.runelite.cache.region.Region;
import net.runelite.cache.region.RegionLoader;
import net.runelite.cache.util.XteaKeyManager;

/**
 * KSP Maps region-image exporter.
 *
 * This class intentionally lives in net.runelite.cache so it can be injected
 * into a RuneLite checkout and use RuneLite's MapImageDumper directly.
 * It exports every loaded region on every populated plane, including high-Y
 * world coordinates used by dungeons and other underground maps.
 */
public final class KspRegionDumper
{
    private KspRegionDumper()
    {
    }

    public static void main(String[] args) throws Exception
    {
        String cacheDir = requiredArg(args, "--cachedir");
        String outputDir = requiredArg(args, "--outputdir");
        String xteaPath = optionalArg(args, "--xteapath");

        File output = new File(outputDir);
        if (!output.exists() && !output.mkdirs())
        {
            throw new IOException("Unable to create output directory: " + output);
        }

        XteaKeyManager keys = new XteaKeyManager();
        if (xteaPath != null && !xteaPath.isBlank())
        {
            try (FileInputStream input = new FileInputStream(xteaPath))
            {
                keys.loadKeys(input);
            }
        }

        List<ManifestRegion> manifest = new ArrayList<>();

        try (Store store = new Store(new File(cacheDir)))
        {
            store.load();

            RegionLoader regionLoader = new RegionLoader(store, keys);
            regionLoader.loadRegions();

            // MapImageDumper's terrain colours are primarily 24-bit RGB values.
            // When transparency is enabled those values are written to ARGB with
            // alpha 0, making the actual floor/terrain disappear while walls,
            // doors and icons remain visible. Region images are therefore rendered
            // opaque; dungeon void remains black, matching RuneLite/Explv-style
            // underground maps and allowing neighbouring regions to stitch cleanly.
            MapImageDumper dumper = new MapImageDumper(store, regionLoader)
                .setTransparency(false)
                .setLabelRegions(false)
                .setOutlineRegions(false)
                .setRenderLabels(true)
                .setRenderIcons(true)
                .setRenderObjects(true)
                .setRenderWalls(true)
                .setRenderOverlays(true);
            dumper.load();

            int processed = 0;
            int total = regionLoader.getRegions().size();
            for (Region region : regionLoader.getRegions())
            {
                ManifestRegion item = new ManifestRegion(
                    region.getRegionID(), region.getBaseX(), region.getBaseY());

                for (int plane = 0; plane < Region.Z; plane++)
                {
                    // Plane 0 can contain procedural terrain even with no explicit
                    // overlay/underlay, so always render it. For upper planes, a
                    // quick tile/object scan avoids rendering thousands of known-
                    // empty 256x256 images before the pixel check.
                    if (plane > 0 && !planeLikelyVisible(region, plane))
                    {
                        continue;
                    }

                    BufferedImage image = dumper.drawRegion(region, plane);
                    if (!hasVisiblePixel(image))
                    {
                        continue;
                    }

                    File planeDir = new File(output, Integer.toString(plane));
                    if (!planeDir.exists() && !planeDir.mkdirs())
                    {
                        throw new IOException("Unable to create plane directory: " + planeDir);
                    }

                    File imageFile = new File(planeDir, region.getRegionID() + ".png");
                    ImageIO.write(image, "png", imageFile);
                    item.planes.add(plane);
                }

                if (!item.planes.isEmpty())
                {
                    manifest.add(item);
                }

                processed++;
                if (processed % 100 == 0 || processed == total)
                {
                    System.out.println("KSP Maps: rendered " + processed + "/" + total + " cache regions");
                }
            }
        }

        writeManifest(new File(output, "manifest.json"), manifest);
        System.out.println("KSP Maps: exported " + manifest.size() + " populated regions to " + output);
    }

    private static boolean planeLikelyVisible(Region region, int plane)
    {
        for (int x = 0; x < Region.X; x++)
        {
            for (int y = 0; y < Region.Y; y++)
            {
                if (region.getUnderlayId(plane, x, y) != 0
                    || region.getOverlayId(plane, x, y) != 0
                    || region.getTileSetting(plane, x, y) != 0)
                {
                    return true;
                }
            }
        }

        for (Location location : region.getLocations())
        {
            if (location.getPosition().getZ() == plane)
            {
                return true;
            }
        }

        return false;
    }

    private static boolean hasVisiblePixel(BufferedImage image)
    {
        if (image.getColorModel().hasAlpha())
        {
            for (int y = 0; y < image.getHeight(); y++)
            {
                for (int x = 0; x < image.getWidth(); x++)
                {
                    if (((image.getRGB(x, y) >>> 24) & 0xff) != 0)
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        // Opaque RGB region images are always drawable once RuneLite rendered
        // them. Upper planes have already been filtered by planeLikelyVisible().
        return true;
    }

    private static void writeManifest(File file, List<ManifestRegion> regions) throws IOException
    {
        try (FileWriter writer = new FileWriter(file))
        {
            writer.write("{\n");
            writer.write("  \"version\": 1,\n");
            writer.write("  \"generatedAt\": \"" + Instant.now() + "\",\n");
            writer.write("  \"mapScale\": 4,\n");
            writer.write("  \"regionSize\": 64,\n");
            writer.write("  \"planes\": [0, 1, 2, 3],\n");
            writer.write("  \"regions\": [\n");

            for (int i = 0; i < regions.size(); i++)
            {
                ManifestRegion region = regions.get(i);
                writer.write("    {\"id\":" + region.id
                    + ",\"baseX\":" + region.baseX
                    + ",\"baseY\":" + region.baseY
                    + ",\"planes\":[");
                for (int p = 0; p < region.planes.size(); p++)
                {
                    if (p > 0) writer.write(",");
                    writer.write(Integer.toString(region.planes.get(p)));
                }
                writer.write("]}");
                writer.write(i + 1 < regions.size() ? ",\n" : "\n");
            }

            writer.write("  ]\n");
            writer.write("}\n");
        }
    }

    private static String requiredArg(String[] args, String name)
    {
        String value = optionalArg(args, name);
        if (value == null || value.isBlank())
        {
            throw new IllegalArgumentException("Missing required argument " + name);
        }
        return value;
    }

    private static String optionalArg(String[] args, String name)
    {
        for (int i = 0; i < args.length; i++)
        {
            if (name.equals(args[i]) && i + 1 < args.length)
            {
                return args[i + 1];
            }
        }
        return null;
    }

    private static final class ManifestRegion
    {
        private final int id;
        private final int baseX;
        private final int baseY;
        private final List<Integer> planes = new ArrayList<>();

        private ManifestRegion(int id, int baseX, int baseY)
        {
            this.id = id;
            this.baseX = baseX;
            this.baseY = baseY;
        }
    }
}
