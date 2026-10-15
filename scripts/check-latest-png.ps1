Add-Type -AssemblyName System.Drawing
$path = 'C:\Users\usuario\.gemini\antigravity\brain\e7eb89fb-0c64-40ca-85b5-6fdf2b1d310c\.user_uploaded\media_1792021277452_77c7e56d.png'
$img = [System.Drawing.Bitmap]::FromFile($path)
Write-Output "PixelFormat: $($img.PixelFormat) Size: $($img.Width)x$($img.Height)"
$p0 = $img.GetPixel(0, 0)
Write-Output "Pixel 0,0: R=$($p0.R), G=$($p0.G), B=$($p0.B), A=$($p0.A)"

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
