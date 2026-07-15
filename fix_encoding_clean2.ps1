$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

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
    $file = $_.FullName
    $content = Get-Content -Path $file -Raw -Encoding UTF8
    foreach ($bad in $map.Keys) {
        $content = $content -replace [regex]::Escape($bad), $map[$bad]
    }
    Set-Content -Path $file -Value $content -Encoding UTF8
    Write-Host "Processed $file"
}

# Fix specific broken link in apps.html
$apps = Join-Path $projectRoot 'apps.html'
if (Test-Path $apps) {
    $c = Get-Content -Path $apps -Raw -Encoding UTF8
    $fixed = $c -replace 'Servicios â–¾', 'Servicios ➔'
    if ($fixed -ne $c) {
        Set-Content -Path $apps -Value $fixed -Encoding UTF8
        Write-Host "Fixed services link in apps.html"
    }
}
