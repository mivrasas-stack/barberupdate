Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792004976193_b8cd9c64.jpg'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height

# Create a 32bpp ARGB bitmap with transparency
$dest = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Lock bits for fast processing
$rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
$srcData = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$destData = $dest.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$srcStride = $srcData.Stride
$destStride = $destData.Stride

$srcBytes = New-Object byte[] ($srcStride * $h)
$destBytes = New-Object byte[] ($destStride * $h)

[System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $srcBytes, 0, $srcBytes.Length)

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $sIdx = ($y * $srcStride) + ($x * 3)
        $b = [int]$srcBytes[$sIdx]
        $g = [int]$srcBytes[$sIdx + 1]
        $r = [int]$srcBytes[$sIdx + 2]
        
        $maxC = [Math]::Max($r, [Math]::Max($g, $b))
        
        $dIdx = ($y * $destStride) + ($x * 4)
        
        if ($maxC -le 10) {
            # Fully transparent black
            $destBytes[$dIdx] = 0
            $destBytes[$dIdx + 1] = 0
            $destBytes[$dIdx + 2] = 0
            $destBytes[$dIdx + 3] = 0
        } elseif ($maxC -lt 40) {
            # Smooth transition
            $alpha = [int](($maxC - 10) / 30.0 * 255.0)
            $destBytes[$dIdx] = [byte]$b
            $destBytes[$dIdx + 1] = [byte]$g
            $destBytes[$dIdx + 2] = [byte]$r
            $destBytes[$dIdx + 3] = [byte]$alpha
        } else {
            # Fully opaque emblem
            $destBytes[$dIdx] = [byte]$b
            $destBytes[$dIdx + 1] = [byte]$g
            $destBytes[$dIdx + 2] = [byte]$r
            $destBytes[$dIdx + 3] = 255
        }
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($destBytes, 0, $destData.Scan0, $destBytes.Length)

$src.UnlockBits($srcData)
$dest.UnlockBits($destData)

$src.Dispose()

# Save transparent version
$transparentPath = "$PSScriptRoot\..\public\images\logo.png"
$dest.Save($transparentPath, [System.Drawing.Imaging.ImageFormat]::Png)
Copy-Item $transparentPath "$PSScriptRoot\..\public\logo.png" -Force
Copy-Item $transparentPath "$PSScriptRoot\..\landing\public\logo.png" -Force

# Generate resized favicons
function Resize-Bmp([System.Drawing.Bitmap]$sourceBmp, [string]$dst, [int]$rw, [int]$rh) {
    $rBmp = New-Object System.Drawing.Bitmap $rw, $rh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($rBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($sourceBmp, 0, 0, $rw, $rh)
    $rBmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $rBmp.Dispose()
}

Resize-Bmp $dest "$PSScriptRoot\..\public\favicon-32x32.png" 32 32
Resize-Bmp $dest "$PSScriptRoot\..\public\apple-touch-icon.png" 180 180
Resize-Bmp $dest "$PSScriptRoot\..\public\icon-192.png" 192 192
Copy-Item "$PSScriptRoot\..\public\favicon-32x32.png" "$PSScriptRoot\..\public\favicon.ico" -Force

Resize-Bmp $dest "$PSScriptRoot\..\landing\public\favicon-32x32.png" 32 32
Resize-Bmp $dest "$PSScriptRoot\..\landing\public\apple-touch-icon.png" 180 180
Copy-Item "$PSScriptRoot\..\landing\public\favicon-32x32.png" "$PSScriptRoot\..\landing\public\favicon.ico" -Force

$dest.Dispose()
Write-Output "BARBERNOW_PROCESSED_SUCCESSFULLY"
