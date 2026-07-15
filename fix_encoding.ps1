$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$pairs = @(
    @('Ã±','ñ')
    @('Ã¡','á')
    @('Ã©','é')
    @('Ã­','í')
    @('Ã³','ó')
    @('Ãº','ú')
    @('Â¿','¿')
    @('Â¡','¡')
    @('â–¾','➔')
    @('â–»','→')
    @('â€“','–')
    @('â—','—')
    @('â€¦','…')
    @('â€œ','“')
    @('â€�','”')
    @('â€˜','‘')
    @('â€™','’')
    @('â€¢','•')
    @('Ã¼','ü')
    @('Ã§','ç')
    @('Ã‘','Ñ')
    @('Ãµ','õ')
)

Get-ChildItem -Path $projectRoot -Recurse -Include *.html,*.css,*.js | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content -Path $file -Raw -Encoding UTF8
    foreach ($pair in $pairs) {
        $old = [regex]::Escape($pair[0])
        $new = $pair[1]
        $content = $content -replace $old, $new
    }
    Set-Content -Path $file -Value $content -Encoding UTF8
    Write-Host "Processed $file"
}

# Fix specific broken menu link
$appsPath = Join-Path $projectRoot 'apps.html'
if (Test-Path $appsPath) {
    $content = Get-Content -Path $appsPath -Raw -Encoding UTF8
    $fixed = $content -replace 'Servicios â–¾', 'Servicios ➔'
    if ($fixed -ne $content) {
        Set-Content -Path $appsPath -Value $fixed -Encoding UTF8
        Write-Host "Fixed menu link in apps.html"
    }
}
