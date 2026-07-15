$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Hashtable of broken sequences -> correct characters
$replacements = @{
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
    'â€”' = '—';
    'â€¦' = '…';
    'â€œ' = '“';
    'â€�' = '”';
    'â€˜' = '‘';
    'â€™' = '’';
    'â€¢' = '•';
    'Ã¼' = 'ü';
    'Ã§' = 'ç';
    'Ã‘' = 'Ñ';
    'Ãµ' = 'õ'
}

Get-ChildItem -Path $projectRoot -Recurse -Include *.html,*.css,*.js | ForEach-Object {
    $filePath = $_.FullName
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    foreach ($kvp in $replacements.GetEnumerator()) {
        $content = $content -replace [regex]::Escape($kvp.Key), $kvp.Value
    }
    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Processed $filePath"
}

# Explicit fix for known broken menu link in apps.html
$appsPath = Join-Path $projectRoot 'apps.html'
if (Test-Path $appsPath) {
    $content = Get-Content -Path $appsPath -Raw -Encoding UTF8
    $fixed = $content -replace 'Servicios â–¾', 'Servicios ➔'
    if ($fixed -ne $content) {
        Set-Content -Path $appsPath -Value $fixed -Encoding UTF8
        Write-Host "Fixed menu link in apps.html"
    }
}
