$output = "project_context.txt"
$exclude = @("node_modules", ".expo", ".git", "android", "ios", "build", "dist")

function Write-FileContent($path) {
    $relativePath = $path.Replace((Get-Location).Path + "\", "")
    Add-Content $output "`n`n========================================"
    Add-Content $output "FILE: $relativePath"
    Add-Content $output "========================================"
    Get-Content $path | Add-Content $output
}

Clear-Content $output -ErrorAction SilentlyContinue
New-Item -Force -Path $output -ItemType File | Out-Null
Add-Content $output "=== RidnGo Mobile - Project Context Scan ==="
Add-Content $output "Date: $(Get-Date)"

$extensions = @("*.ts", "*.tsx", "*.js", "*.json")

Get-ChildItem -Recurse -Include $extensions | Where-Object {
    $file = $_.FullName
    $skip = $false
    foreach ($ex in $exclude) {
        if ($file -match [regex]::Escape($ex)) { $skip = $true; break }
    }
    -not $skip
} | ForEach-Object { Write-FileContent $_.FullName }

Write-Host "Scan termine : $output"
