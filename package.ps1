# package.ps1
# 水稲生育予測システムの配布用ZIPパッケージを作成するスクリプト

$ErrorActionPreference = "Stop"

$srcDir = Get-Location
$buildDir = "$srcDir\build"
$distDir = "$srcDir\dist"
$appName = "suito-yosoku-portable"
$targetDir = "$distDir\$appName"

Write-Host "Packaging started..."

# 1. Build Vite app
Write-Host "Building application..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# 2. Clean/Create package directory
Write-Host "Creating package directory..."
if (Test-Path $distDir) {
    Remove-Item -Recurse -Force "$distDir\*"
}
if (-Not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

# 3. Copy Application files
Write-Host "Copying application files..."
Copy-Item "$buildDir\index.html" -Destination $targetDir
if (Test-Path "$buildDir\src") {
    Copy-Item -Path "$buildDir\src" -Destination "$targetDir\" -Recurse -Force
}
if (Test-Path "$buildDir\favicon.ico") {
    Copy-Item -Path "$buildDir\favicon.ico" -Destination "$targetDir\" -Force
}

# 4. Copy Data Folder (Template)
Write-Host "Copying data folder..."
if (Test-Path "$srcDir\data_folder") {
    New-Item -ItemType Directory -Force -Path "$targetDir\data_folder" | Out-Null
    Copy-Item -Path "$srcDir\data_folder\*" -Destination "$targetDir\data_folder\" -Recurse -Force
}

# 4.5 Copy DataFetcher (Scripts)
Write-Host "Copying DataFetcher Python scripts..."
if (Test-Path "$srcDir\DataFetcher") {
    # Exclude virtual environments and cache directories to save space
    $fetcherDest = "$targetDir\DataFetcher"
    New-Item -ItemType Directory -Force -Path $fetcherDest | Out-Null
    
    Get-ChildItem -Path "$srcDir\DataFetcher" -Recurse | Where-Object {
        $_.FullName -notmatch '\\\.venv\\' -and
        $_.FullName -notmatch '\\__pycache__\\' -and
        $_.Name -ne '.venv' -and
        $_.Name -ne '__pycache__'
    } | ForEach-Object {
        $destPath = $_.FullName.Replace("$srcDir\DataFetcher", $fetcherDest)
        if ($_.PSIsContainer) {
            if (-Not (Test-Path $destPath)) {
                New-Item -ItemType Directory -Force -Path $destPath | Out-Null
            }
        } else {
            Copy-Item -Path $_.FullName -Destination $destPath -Force
        }
    }
}

# 5. Copy Readme
if (Test-Path "$srcDir\README_FOR_USERS.txt") {
    Copy-Item "$srcDir\README_FOR_USERS.txt" "$targetDir\README_FOR_USERS.txt"
}

# 6. Create Zip Archive
Write-Host "Creating zip archive..."
$zipFile = "$distDir\$appName.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}
Compress-Archive -Path "$targetDir\*" -DestinationPath $zipFile

Write-Host "Packaging complete!" -ForegroundColor Green
Write-Host "Distribution package is located at: $targetDir"
Write-Host "Zip file is located at: $zipFile"
