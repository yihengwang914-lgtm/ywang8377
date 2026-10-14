from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
for size,name in ((192,'courselex-192'),(512,'courselex-512'),(180,'apple-touch-icon'),(32,'favicon-32')):
    subprocess.run(['sips','-z',str(size),str(size),str(root/'assets/brand/courselex-mark.png'),'--out',str(root/f'icons/{name}.png')],check=True)
