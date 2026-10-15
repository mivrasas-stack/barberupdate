Add-Type -AssemblyName System.Drawing
$path = 'C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792004976193_b8cd9c64.jpg'
$img = [System.Drawing.Bitmap]::FromFile($path)
Write-Output "PixelFormat: $($img.PixelFormat) Size: $($img.Width)x$($img.Height)"
$p0 = $img.GetPixel(0, 0)
Write-Output "Pixel 0,0: R=$($p0.R), G=$($p0.G), B=$($p0.B)"
$img.Dispose()
