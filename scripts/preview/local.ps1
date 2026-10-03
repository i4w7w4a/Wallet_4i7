#requires -Version 7.4
<#
.SYNOPSIS
One local MONO dev preview on the existing 127.0.0.1:3184 origin.
.EXAMPLE
pwsh -NoProfile -File scripts/preview/local.ps1 start
.EXAMPLE
pwsh -NoProfile -File scripts/preview/local.ps1 status
.EXAMPLE
pwsh -NoProfile -File scripts/preview/local.ps1 stop
#>
[CmdletBinding()]
param([Parameter(Position = 0)][ValidateSet('start', 'status', 'stop')][string]$Action = 'status')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This local launcher requires Windows and PowerShell 7.4+.' }
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$AppRoot = Join-Path $ProjectRoot 'apps/miniapp'
$NodeExecutable = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
$NextCli = Join-Path $AppRoot 'node_modules/next/dist/bin/next'
$PreviewPort = 3184
$Origin = "http://127.0.0.1:$PreviewPort"
$OpsRoot = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.novex-ops/preview/mono-showcase-3184'
$StatePath = Join-Path $OpsRoot 'state.json'

function Get-PortOwners {
    @(Get-NetTCPConnection -State Listen -LocalPort $PreviewPort -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-ProcessRecord([int]$ProcessId) {
    Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Test-ProjectProcess($Process) {
    if (-not $Process -or -not $Process.CommandLine -or -not $Process.ExecutablePath) { return $false }
    $command = $Process.CommandLine.Replace('/', '\')
    $prefix = $ProjectRoot.TrimEnd('\') + '\'
    return $Process.ExecutablePath.Equals($NodeExecutable, [StringComparison]::OrdinalIgnoreCase) -and
        $command.IndexOf($prefix, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $command.IndexOf('\next\dist\', [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-Stamp($Process) {
    [pscustomobject]@{ pid = [int]$Process.ProcessId; createdAt = $Process.CreationDate.ToUniversalTime().ToString('o') }
}

function Test-SavedProcess($Record, $Process) {
    (Test-ProjectProcess $Process) -and ([DateTime]$Record.createdAt).ToUniversalTime().Ticks -eq $Process.CreationDate.ToUniversalTime().Ticks
}

function Read-State {
    if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
    $saved = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    if ($saved.schemaVersion -ne 1 -or $saved.projectRoot -ne $ProjectRoot -or $saved.port -ne $PreviewPort) {
        throw "Preview metadata belongs to another checkout or schema: $StatePath"
    }
    return $saved
}

function Write-State($State) {
    $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $StatePath -Encoding utf8
}

function Get-ManagedProcesses($State) {
    if (-not $State) { return @() }
    $all = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'")
    $managed = [Collections.Generic.List[object]]::new()
    foreach ($record in $State.processes) {
        $process = $all | Where-Object ProcessId -EQ $record.pid | Select-Object -First 1
        if (Test-SavedProcess $record $process) { $managed.Add($process) }
    }
    if (-not $managed.Count) { return @() }
    # Next dev has a CLI parent and a server child. Only verified project descendants belong to this instance.
    do {
        $added = $false
        foreach ($process in $all) {
            $managedIds = @($managed | ForEach-Object { $_.ProcessId })
            if ($process.ProcessId -in $managedIds -or $process.ParentProcessId -notin $managedIds) { continue }
            if (Test-ProjectProcess $process) { $managed.Add($process); $added = $true }
        }
    } while ($added)
    return @($managed.ToArray())
}

function Show-Status([string]$Status, $State, $Managed, $Owners) {
    [pscustomobject]@{
        status = $Status; origin = $Origin; port = $PreviewPort
        launchId = $(if ($State) { $State.launchId } else { $null })
        sourceAtLaunch = $(if ($State) { $State.sourceAtLaunch } else { $null })
        verifiedProcessIds = @($Managed | ForEach-Object { [int]$_.ProcessId })
        listenerProcessIds = @($Owners); metadata = $StatePath
        stdoutLog = $(if ($State) { $State.stdoutLog } else { $null })
        stderrLog = $(if ($State) { $State.stderrLog } else { $null })
    } | ConvertTo-Json -Depth 4
}

$launcherMutex = [Threading.Mutex]::new($false, 'Local\NovexMonoPreview3184')
if (-not $launcherMutex.WaitOne(0)) { $launcherMutex.Dispose(); throw 'Another preview launcher action is in progress.' }
try {
$state = Read-State
$owners = @(Get-PortOwners)
$managed = @(Get-ManagedProcesses $state)
if (@($owners | Where-Object { $_ -notin @($managed | ForEach-Object { $_.ProcessId }) }).Count) {
    throw "Port $PreviewPort is occupied by an unverified process. No process was stopped or adopted."
}

if ($Action -eq 'status') {
    $status = if ($owners.Count) { 'RUNNING' } elseif ($managed.Count) { 'STARTING' } else { 'STOPPED' }
    Show-Status $status $state $managed $owners
    exit 0
}

if ($Action -eq 'stop') {
    # Recheck PID creation time and exact project/Next path immediately before stopping each saved instance member.
    foreach ($process in ($managed | Sort-Object { if ($_.ProcessId -eq $state.rootPid) { 0 } else { 1 } })) {
        $current = Get-ProcessRecord $process.ProcessId
        if (-not $current) { continue }
        if (-not (Test-SavedProcess (Get-Stamp $process) $current)) { throw 'Process identity changed; stop aborted.' }
        try { Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop }
        catch { if (Get-ProcessRecord $current.ProcessId) { throw } }
    }
    if ($state) { $state.processes = @(); Write-State $state }
    Show-Status 'STOPPED' $state @() @(Get-PortOwners)
    exit 0
}

if ($managed.Count) {
    Show-Status $(if ($owners.Count) { 'RUNNING' } else { 'STARTING' }) $state $managed $owners
    exit 0
}
if (@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { Test-ProjectProcess $_ }).Count) {
    throw 'An unmanaged Next process already exists for this checkout. No second preview was started.'
}
if (-not (Test-Path -LiteralPath $NextCli)) { throw 'Next is not installed in this checkout. No install was attempted.' }
$source = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $source -notmatch '^[0-9a-f]{40}$') { throw 'Cannot identify the source commit.' }
if ($ProjectRoot.Contains('"')) { throw 'A quote in the checkout path is unsupported.' }
New-Item -ItemType Directory -Path $OpsRoot -Force | Out-Null
$launchId = [guid]::NewGuid().ToString('N')
$startedAt = [DateTime]::UtcNow.ToString('o')
$stdoutLog = Join-Path $OpsRoot "$launchId.stdout.log"
$stderrLog = Join-Path $OpsRoot "$launchId.stderr.log"
$childEnvironment = @{
    NOVEX_LOCAL_PREVIEW = '1'; NOVEX_PREVIEW_LAUNCH_ID = $launchId; NOVEX_PREVIEW_STARTED_AT = $startedAt
    NOVEX_PREVIEW_SOURCE_ID = $source; NOVEX_PREVIEW_PROJECT_ROOT = $ProjectRoot
    NOVEX_NEXT_DIST_DIR = '.next'; NEXT_TELEMETRY_DISABLED = '1'
}
$arguments = @(('"' + $NextCli + '"'), 'dev', ('"' + $AppRoot + '"'), '--hostname', '127.0.0.1', '--port', "$PreviewPort")
$started = Start-Process -FilePath $NodeExecutable -ArgumentList $arguments -WorkingDirectory $AppRoot -WindowStyle Hidden `
    -Environment $childEnvironment -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
$root = Get-ProcessRecord $started.Id
if (-not (Test-ProjectProcess $root)) { throw "Launched process exited or failed identity check. See $stderrLog" }
$state = [pscustomobject]@{
    schemaVersion = 1; projectRoot = $ProjectRoot; port = $PreviewPort; mode = 'development'
    launchId = $launchId; sourceAtLaunch = $source; startedAt = $startedAt; rootPid = [int]$root.ProcessId
    processes = @((Get-Stamp $root)); stdoutLog = $stdoutLog; stderrLog = $stderrLog
}
Write-State $state
Write-Host "STARTING $Origin launch=$launchId source=$source"
$deadline = [DateTime]::UtcNow.AddSeconds(30)
do {
    $owners = @(Get-PortOwners)
    if ($owners.Count) { break }
    if ($started.HasExited) { throw "Next exited before listening. See $stderrLog" }
    Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $deadline)
$managed = @(Get-ManagedProcesses $state)
if (-not $owners.Count -or @($owners | Where-Object { $_ -notin @($managed | ForEach-Object { $_.ProcessId }) }).Count) {
    throw "Preview has not acquired its verified port. Use status and inspect $stderrLog"
}
$state.processes = @($managed | ForEach-Object { Get-Stamp $_ })
Write-State $state
# One bounded source/readiness check, not a background monitor.
$infoResponse = Invoke-WebRequest "$Origin/api/preview-info" -Headers @{ 'Cache-Control' = 'no-store' } -TimeoutSec 45
$info = $infoResponse.Content | ConvertFrom-Json
if ($info.kind -ne 'novex-local-preview' -or $info.launchId -ne $launchId -or
    $infoResponse.Headers['Cache-Control'] -notmatch 'no-store') { throw 'Preview source identity does not match this launch.' }
$page = Invoke-WebRequest "$Origin/mono" -Headers @{ 'Cache-Control' = 'no-store' } -TimeoutSec 45
if ($page.StatusCode -ne 200) { throw 'The MONO route did not become ready.' }
Show-Status 'READY' $state $managed $owners
} finally {
    $launcherMutex.ReleaseMutex()
    $launcherMutex.Dispose()
}
