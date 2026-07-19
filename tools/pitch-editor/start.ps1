param(
    [ValidateRange(1, 65535)]
    [int]$Port = 4173,

    [string]$PitchFile = 'runz\pitch\index.html',

    [switch]$NoBrowser,

    [switch]$AllowShutdown
)

$ErrorActionPreference = 'Stop'
$editorRoot = $PSScriptRoot
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $editorRoot '..\..'))
$pitchPath = if ([System.IO.Path]::IsPathRooted($PitchFile)) {
    [System.IO.Path]::GetFullPath($PitchFile)
}
else {
    [System.IO.Path]::GetFullPath((Join-Path $repoRoot $PitchFile))
}
$backupRoot = Join-Path $editorRoot '.backups'
$url = "http://127.0.0.1:$Port/"

if (-not $pitchPath.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'The pitch editor can only save files inside this repository.'
}

if (-not (Test-Path -LiteralPath $pitchPath -PathType Leaf)) {
    throw "Pitch file not found: $pitchPath"
}

function Send-Bytes {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [byte[]]$Bytes,
        [string]$ContentType
    )

    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentLength64 = $Bytes.Length
    $Response.Headers['Cache-Control'] = 'no-store'
    $Response.Headers['X-Content-Type-Options'] = 'nosniff'
    $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    $Response.OutputStream.Close()
}

function Send-Text {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [string]$Text,
        [string]$ContentType = 'text/plain; charset=utf-8'
    )

    Send-Bytes -Response $Response -StatusCode $StatusCode -Bytes ([System.Text.Encoding]::UTF8.GetBytes($Text)) -ContentType $ContentType
}

function Send-Json {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [object]$Value
    )

    Send-Text -Response $Response -StatusCode $StatusCode -Text ($Value | ConvertTo-Json -Compress -Depth 6) -ContentType 'application/json; charset=utf-8'
}

function Send-File {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$Path,
        [string]$ContentType
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Send-Json -Response $Response -StatusCode 404 -Value @{ error = 'File not found' }
        return
    }

    Send-Bytes -Response $Response -StatusCode 200 -Bytes ([System.IO.File]::ReadAllBytes($Path)) -ContentType $ContentType
}

function Read-RequestText {
    param([System.Net.HttpListenerRequest]$Request)

    if ($Request.ContentLength64 -gt 16MB) {
        throw 'The pitch file is unexpectedly large.'
    }

    $encoding = if ($Request.ContentEncoding) { $Request.ContentEncoding } else { [System.Text.Encoding]::UTF8 }
    $reader = [System.IO.StreamReader]::new($Request.InputStream, $encoding)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }
}

function Save-Pitch {
    param([System.Net.HttpListenerContext]$Context)

    $origin = $Context.Request.Headers['Origin']
    $allowedOrigins = @("http://127.0.0.1:$Port", "http://localhost:$Port")
    if ($origin -and $origin -notin $allowedOrigins) {
        Send-Json -Response $Context.Response -StatusCode 403 -Value @{ error = 'The pitch editor only accepts local save requests.' }
        return
    }

    $payload = Read-RequestText -Request $Context.Request | ConvertFrom-Json
    $html = [string]$payload.html

    if ($html.Length -lt 100000) {
        Send-Json -Response $Context.Response -StatusCode 400 -Value @{ error = 'The saved document is too small to be the pitch.' }
        return
    }
    if (-not $html.Contains('RUNZ: Publisher Pitch')) {
        Send-Json -Response $Context.Response -StatusCode 400 -Value @{ error = 'The pitch title is missing.' }
        return
    }
    if (-not $html.Contains('class="deck"')) {
        Send-Json -Response $Context.Response -StatusCode 400 -Value @{ error = 'The pitch deck is missing.' }
        return
    }
    if (-not $html.Contains('data:image/')) {
        Send-Json -Response $Context.Response -StatusCode 400 -Value @{ error = 'The embedded pitch images are missing.' }
        return
    }
    if ($html.Contains('pitch-editor-runtime-style') -or $html.Contains('pitch-editor-selected')) {
        Send-Json -Response $Context.Response -StatusCode 400 -Value @{ error = 'Editor-only markup was found in the saved pitch.' }
        return
    }

    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupName = (Get-Date -Format 'yyyy-MM-ddTHH-mm-ss-fff') + '-index.html'
    $backupPath = Join-Path $backupRoot $backupName
    Copy-Item -LiteralPath $pitchPath -Destination $backupPath
    [System.IO.File]::WriteAllText($pitchPath, $html, [System.Text.UTF8Encoding]::new($false))

    $oldBackups = @(Get-ChildItem -LiteralPath $backupRoot -Filter '*-index.html' -File | Sort-Object Name -Descending | Select-Object -Skip 20)
    foreach ($oldBackup in $oldBackups) {
        Remove-Item -LiteralPath $oldBackup.FullName -Force
    }

    $repoUri = [System.Uri]::new(($repoRoot.TrimEnd('\') + '\'))
    $backupUri = [System.Uri]::new($backupPath)
    $relativeBackup = [System.Uri]::UnescapeDataString($repoUri.MakeRelativeUri($backupUri).ToString())
    Send-Json -Response $Context.Response -StatusCode 200 -Value @{
        ok = $true
        bytes = (Get-Item -LiteralPath $pitchPath).Length
        backup = $relativeBackup
    }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "RUNZ Pitch Editor: $url"
    Write-Host "Editing: $pitchPath"
    Write-Host 'Press Ctrl+C to stop.'

    if (-not $NoBrowser) {
        Start-Process $url
    }

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $path = $context.Request.Url.AbsolutePath
            $method = $context.Request.HttpMethod

            if ($method -eq 'GET' -and $path -eq '/') {
                Send-File -Response $context.Response -Path (Join-Path $editorRoot 'index.html') -ContentType 'text/html; charset=utf-8'
            }
            elseif ($method -eq 'GET' -and $path -eq '/editor.css') {
                Send-File -Response $context.Response -Path (Join-Path $editorRoot 'editor.css') -ContentType 'text/css; charset=utf-8'
            }
            elseif ($method -eq 'GET' -and $path -eq '/editor.js') {
                Send-File -Response $context.Response -Path (Join-Path $editorRoot 'editor.js') -ContentType 'text/javascript; charset=utf-8'
            }
            elseif ($method -eq 'GET' -and $path -eq '/pitch') {
                Send-File -Response $context.Response -Path $pitchPath -ContentType 'text/html; charset=utf-8'
            }
            elseif ($method -eq 'GET' -and $path -eq '/api/status') {
                $pitch = Get-Item -LiteralPath $pitchPath
                Send-Json -Response $context.Response -StatusCode 200 -Value @{
                    ok = $true
                    file = $PitchFile.Replace('\', '/')
                    bytes = $pitch.Length
                    modified = $pitch.LastWriteTimeUtc.ToString('o')
                }
            }
            elseif ($method -eq 'POST' -and $path -eq '/api/save') {
                Save-Pitch -Context $context
            }
            elseif ($AllowShutdown -and $method -eq 'POST' -and $path -eq '/api/shutdown') {
                Send-Json -Response $context.Response -StatusCode 200 -Value @{ ok = $true }
                $listener.Stop()
            }
            else {
                Send-Json -Response $context.Response -StatusCode 404 -Value @{ error = 'Not found' }
            }
        }
        catch {
            if ($context.Response.OutputStream.CanWrite) {
                Send-Json -Response $context.Response -StatusCode 500 -Value @{ error = $_.Exception.Message }
            }
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
