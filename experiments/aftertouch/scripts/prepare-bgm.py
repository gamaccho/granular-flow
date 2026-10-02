"""Prepare the supplied 深海旋回 track as a gapless six-second crossfade loop.
Usage: python3 scripts/prepare-bgm.py path/to/深海旋回.mp3
Requires ffmpeg. Crop bounds were measured with silencedetect at -50 dB.
"""
import subprocess
import sys
from pathlib import Path

output = Path(__file__).resolve().parents[1] / 'public/audio/deep-sea-loop.mp3'
output.parent.mkdir(parents=True, exist_ok=True)
# Trim only the measured silence, split off the first six seconds, then append
# the body crossfading its tail into that head. The loop boundary continues from
# the end of the head into the original body without a playback timer.
filters = (
    '[0:a]atrim=start=6.48525:end=213.540458,asetpts=PTS-STARTPTS[b];'
    '[1:a]atrim=start=0.48525:end=6.48525,asetpts=PTS-STARTPTS[h];'
    '[b][h]acrossfade=d=6:c1=tri:c2=tri[out]'
)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', sys.argv[1],
                '-i', sys.argv[1], '-filter_complex', filters, '-map', '[out]', '-map_metadata', '0',
                '-c:a', 'libmp3lame', '-b:a', '160k', '-ar', '32000',
                '-metadata', 'title=深海旋回 — AFTERTOUCH crossfade loop', str(output)], check=True)
print(output)
