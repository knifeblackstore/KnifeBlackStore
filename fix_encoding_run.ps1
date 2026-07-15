$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Replacement pairs: broken -> correct
$pairs = @(
    'Ã±','ñ',
    'Ã¡','á',
    'Ã©','é',
    'Ã­','í',
    'Ã³','ó',
    'Ãº','ú',
    'Â¿','¿',
    'Â¡','¡',
    'â–¾','➔',
    'â–»','→',
    'â€“','–',
    'â—','—',
    'â€¦','…',
    'â€œ','“',
    'â€�','”',
    'â€˜','‘',
    'â€™','’',
    'â€¢','•',
    'Ã¼','ü',
    'Ã§','ç',
    'Ãñ','ñ',
    'Ã‘','Ñ',
    'Ãµ','õ'
)

Get-ChildItem -Path $projectRoot -Recurse -Include *.html,*.css,*.js | ForEach-Object {
    $filePath = $_.FullName
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    for ($i = 0; $i -lt $pairs.Length; $i += 2) {
        $old = [regex]::Escape($pairs[$i])
        $new = $pairs[$i + 1]
        $content = $content -replace $old, $new
    }
    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Processed $filePath"
}

# Specific fix for broken menu link in apps.html
$appsPath = Join-Path $projectRoot 'apps.html'
if (Test-Path $appsPath) {
    $content = Get-Content -Path $appsPath -Raw -Encoding UTF8
    $fixed = $content -replace 'Servicios â–¾', 'Servicios ➔'
    if ($fixed -ne $content) {
        Set-Content -Path $appsPath -Value $fixed -Encoding UTF8
        Write-Host "Fixed menu link in apps.html"
    }
}
