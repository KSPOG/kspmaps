param(
    [Parameter(Mandatory = $true)]
    [string]$CacheDir,

    [string]$XteaPath = "",

    [string]$RuneLiteDir = "$PSScriptRoot\runelite",

    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $repoRoot "data\regions"
}

$CacheDir = (Resolve-Path $CacheDir).Path
if ($XteaPath) {
    $XteaPath = (Resolve-Path $XteaPath).Path
}

if (-not (Test-Path $RuneLiteDir)) {
    Write-Host "Cloning RuneLite into $RuneLiteDir ..."
    git clone --depth 1 https://github.com/runelite/runelite.git $RuneLiteDir
    if ($LASTEXITCODE -ne 0) { throw "RuneLite clone failed." }
}

$RuneLiteDir = (Resolve-Path $RuneLiteDir).Path
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$OutputDir = (Resolve-Path $OutputDir).Path

$source = Join-Path $PSScriptRoot "KspRegionDumper.java"
$cacheProjectDir = Join-Path $RuneLiteDir "cache"
$targetDir = Join-Path $cacheProjectDir "src\main\java\net\runelite\cache"
$target = Join-Path $targetDir "KspRegionDumper.java"
$initScript = Join-Path $RuneLiteDir ".ksp-region-dumper.init.gradle"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item $source $target -Force

@'
gradle.afterProject { p, state ->
    if (p.path == ':') {
        p.tasks.register('kspDumpRegions', JavaExec) {
            group = 'ksp maps'
            description = 'Exports RuneLite cache regions for KSP Maps'
            dependsOn p.tasks.named('classes')
            classpath = p.sourceSets.main.runtimeClasspath
            mainClass.set('net.runelite.cache.KspRegionDumper')

            def cacheDir = System.getProperty('ksp.cacheDir')
            def outputDir = System.getProperty('ksp.outputDir')
            def xteaPath = System.getProperty('ksp.xteaPath')

            args '--cachedir', cacheDir, '--outputdir', outputDir
            if (xteaPath != null && !xteaPath.trim().isEmpty()) {
                args '--xteapath', xteaPath
            }
        }
    }
}
'@ | Set-Content -Path $initScript -Encoding UTF8

try {
    $gradlew = Join-Path $RuneLiteDir "gradlew.bat"
    $gradleArgs = @(
        "-p", $cacheProjectDir,
        "-I", $initScript,
        "-Dksp.cacheDir=$CacheDir",
        "-Dksp.outputDir=$OutputDir"
    )
    if ($XteaPath) {
        $gradleArgs += "-Dksp.xteaPath=$XteaPath"
    }
    $gradleArgs += "kspDumpRegions"

    & $gradlew @gradleArgs
    if ($LASTEXITCODE -ne 0) {
        throw "RuneLite region export failed with exit code $LASTEXITCODE"
    }
}
finally {
    Remove-Item $target -Force -ErrorAction SilentlyContinue
    Remove-Item $initScript -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "KSP Maps region export complete."
Write-Host "Output: $OutputDir"
Write-Host "Dungeon/high-Y regions are included automatically."
