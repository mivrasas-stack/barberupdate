Add-Type -AssemblyName System.Drawing

function Resize-Logo([string]$srcPath, [string]$dstPath, [int]$w, [int]$h) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap $w, $h
    $graphics = [System.Drawing.Graphics]::FromImage($dest)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($src, 0, 0, $w, $h)
    $dest.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $dest.Dispose()
    $src.Dispose()
}

$newLogo = 'C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792002966603_9e773da5.png'

Copy-Item $newLogo "$PSScriptRoot\..\public\images\logo.png" -Force
Copy-Item $newLogo "$PSScriptRoot\..\public\logo.png" -Force
Copy-Item $newLogo "$PSScriptRoot\..\landing\public\logo.png" -Force

Resize-Logo $newLogo "$PSScriptRoot\..\public\favicon-32x32.png" 32 32
Resize-Logo $newLogo "$PSScriptRoot\..\public\apple-touch-icon.png" 180 180
Resize-Logo $newLogo "$PSScriptRoot\..\public\icon-192.png" 192 192
Copy-Item "$PSScriptRoot\..\public\favicon-32x32.png" "$PSScriptRoot\..\public\favicon.ico" -Force

Resize-Logo $newLogo "$PSScriptRoot\..\landing\public\favicon-32x32.png" 32 32
Resize-Logo $newLogo "$PSScriptRoot\..\landing\public\apple-touch-icon.png" 180 180
Copy-Item "$PSScriptRoot\..\landing\public\favicon-32x32.png" "$PSScriptRoot\..\landing\public\favicon.ico" -Force

Write-Output "TRANSPARENT_LOGO_AND_FAVICONS_UPDATED"
