Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile('C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792002966603_9e773da5.png')
$corner = $img.GetPixel(0, 0)
Write-Output "Format: $($img.PixelFormat) Size: $($img.Width)x$($img.Height)"
Write-Output "Pixel 0,0: A=$($corner.A), R=$($corner.R), G=$($corner.G), B=$($corner.B)"

$transparentCount = 0
$totalSampled = 0
for ($x = 0; $x -lt $img.Width; $x += 20) {
    for ($y = 0; $y -lt $img.Height; $y += 20) {
        $totalSampled++
        $p = $img.GetPixel($x, $y)
        if ($p.A -lt 250) {
            $transparentCount++
        }
    }
}
Write-Output "Sampled: $totalSampled, Transparent: $transparentCount"
$img.Dispose()
