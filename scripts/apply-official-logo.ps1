Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792021277452_77c7e56d.png'

# Copy raw transparent PNG to public paths
Copy-Item $srcPath "$PSScriptRoot\..\public\images\logo.png" -Force
Copy-Item $srcPath "$PSScriptRoot\..\public\logo.png" -Force
Copy-Item $srcPath "$PSScriptRoot\..\landing\public\logo.png" -Force

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$origW = $src.Width
$origH = $src.Height

# Function to generate square favicon with preserved aspect ratio
function Create-Square-Icon([System.Drawing.Bitmap]$source, [string]$dstPath, [int]$size) {
    $canvas = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Calculate aspect-ratio preserving dimensions
    $ratio = [Math]::Min([double]$size / $source.Width, [double]$size / $source.Height)
    $targetW = [int]($source.Width * $ratio)
    $targetH = [int]($source.Height * $ratio)
    $offsetX = [int](($size - $targetW) / 2)
    $offsetY = [int](($size - $targetH) / 2)
    
    $g.DrawImage($source, $offsetX, $offsetY, $targetW, $targetH)
    $canvas.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $canvas.Dispose()
}

# Generate in public/
Create-Square-Icon $src "$PSScriptRoot\..\public\favicon-32x32.png" 32
Create-Square-Icon $src "$PSScriptRoot\..\public\apple-touch-icon.png" 180
Create-Square-Icon $src "$PSScriptRoot\..\public\icon-192.png" 192
Copy-Item "$PSScriptRoot\..\public\favicon-32x32.png" "$PSScriptRoot\..\public\favicon.ico" -Force

# Generate in landing/public/
Create-Square-Icon $src "$PSScriptRoot\..\landing\public\favicon-32x32.png" 32
Create-Square-Icon $src "$PSScriptRoot\..\landing\public\apple-touch-icon.png" 180
Copy-Item "$PSScriptRoot\..\landing\public\favicon-32x32.png" "$PSScriptRoot\..\landing\public\favicon.ico" -Force

$src.Dispose()
Write-Output "OFFICIAL_LOGO_AND_FAVICON_APPLIED"
