$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Hashtable of broken sequences => correct characters
$map = @{
    'Ã±' = 'ñ';
    'Ã¡' = 'á';
    'Ã©' = 'é';
    'Ã­' = 'í';
    'Ã³' = 'ó';
    'Ãº' = 'ú';
    'Â¿' = '¿';
    'Â¡' = '¡';
    'â–¾' = '➔';
    'â–»' = '→';
    'â€“' = '–';
    'â—' = '—';
    'â€¦' = '…';
    'â€œ' = '“';
    'â€�' = '”';
    'â€˜' = '‘';
    'â€™' = '’';
    'â€¢' = '•';
    'Ã¼' = 'ü';
    'Ã§' = 'ç';
    'ÃÑ' = 'Ñ';
    'Ãµ' = 'õ'
}

Get-ChildItem -Path $projectRoot -Recurse -Include *.html,*.css,*.js | ForEach-Object {
    $filePath = $_.FullName
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    foreach ($key in $map.Keys) {
        $escaped = [regex]::Escape($key)
        $content = $content -replace $escaped, $map[$key]
    }
    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Processed $filePath"
}

# Specific fix for broken menu link in apps.html
$appsPath = Join-Path $projectRoot 'apps.html'
if (Test-Path $appsPath) {
    $c = Get-Content -Path $appsPath -Raw -Encoding UTF8
    $fixed = $c -replace 'Servicios â–¾', 'Servicios ➔'
    if ($fixed -ne $c) {
        Set-Content -Path $appsPath -Value $fixed -Encoding UTF8
        Write-Host "Fixed menu link in apps.html"
    }
}
