#requires -Version 7.4
<# Build once after the module handoffs/freeze. Leaves the running .next dev preview intact.
   After READY: local.ps1 stop; local.ps1 start -Mode production (same origin/storage).
#>
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$AppRoot = Join-Path $ProjectRoot 'apps/miniapp'
$OpsRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.novex-ops/preview/mono-showcase-3184'
$BuildStatePath = Join-Path $OpsRoot 'build.json'
$RuntimePaths = @('apps/miniapp/app', 'apps/miniapp/src', 'apps/miniapp/public', 'packages',
    'apps/miniapp/next.config.ts', 'apps/miniapp/package.json', 'package.json', 'pnpm-lock.yaml')
$mutex = [Threading.Mutex]::new($false, 'Local\NovexMonoBuild3184')
if (-not $mutex.WaitOne(0)) { $mutex.Dispose(); throw 'A preview build is already in progress.' }
try {
    $serverStatePath = Join-Path $OpsRoot 'state.json'
    if (Test-Path -LiteralPath $serverStatePath) {
        $serverState = Get-Content -LiteralPath $serverStatePath -Raw | ConvertFrom-Json
        if ($serverState.mode -eq 'production' -and @(Get-NetTCPConnection -State Listen -LocalPort 3184 -ErrorAction SilentlyContinue).Count) {
            throw 'The current production preview uses .next-review. Stop it explicitly before rebuilding that directory.'
        }
    }
    $source = (& git -C $ProjectRoot rev-parse HEAD).Trim()
    $changes = @(& git -C $ProjectRoot status --porcelain=v1 --untracked-files=normal -- @RuntimePaths)
    if ($LASTEXITCODE -ne 0 -or $source -notmatch '^[0-9a-f]{40}$' -or $changes.Count) {
        throw 'Commit the runtime integration before the stable preview build. No build started.'
    }
    New-Item -ItemType Directory -Path $OpsRoot -Force | Out-Null
    $buildRun = [guid]::NewGuid().ToString('N')
    $stdoutLog = Join-Path $OpsRoot "$buildRun.build.stdout.log"
    $stderrLog = Join-Path $OpsRoot "$buildRun.build.stderr.log"
    $record = [ordered]@{ status = 'BUILDING'; projectRoot = $ProjectRoot; sourceId = $source;
        startedAt = [DateTime]::UtcNow.ToString('o'); buildId = $null; stdoutLog = $stdoutLog; stderrLog = $stderrLog }
    $record | ConvertTo-Json | Set-Content -LiteralPath $BuildStatePath -Encoding utf8
    $node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    $next = Join-Path $AppRoot 'node_modules/next/dist/bin/next'
    $build = Start-Process -FilePath $node -ArgumentList @(('"' + $next + '"'), 'build', ('"' + $AppRoot + '"')) `
        -WorkingDirectory $AppRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog `
        -Environment @{ NOVEX_NEXT_DIST_DIR = '.next-review'; NEXT_TELEMETRY_DISABLED = '1' }
    Write-Host "BUILDING source=$source pid=$($build.Id) log=$stdoutLog"
    $build.WaitForExit()
    if ($build.ExitCode -ne 0) {
        $record.status = 'FAILED'; $record | ConvertTo-Json | Set-Content -LiteralPath $BuildStatePath -Encoding utf8
        throw "Preview build failed (exit $($build.ExitCode)). See $stderrLog and $stdoutLog"
    }
    $changedDuringBuild = @(& git -C $ProjectRoot diff --name-only $source -- @RuntimePaths)
    $untracked = @(& git -C $ProjectRoot ls-files --others --exclude-standard -- @RuntimePaths)
    if ($changedDuringBuild.Count -or $untracked.Count) {
        $record.status = 'SOURCE_CHANGED'; $record | ConvertTo-Json | Set-Content -LiteralPath $BuildStatePath -Encoding utf8
        throw 'Runtime source changed during the build. The output has not been marked ready.'
    }
    $record.buildId = (Get-Content -LiteralPath (Join-Path $AppRoot '.next-review/BUILD_ID') -Raw).Trim()
    $record.status = 'READY'
    $record | ConvertTo-Json | Set-Content -LiteralPath $BuildStatePath -Encoding utf8
    $record | ConvertTo-Json
} finally {
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
