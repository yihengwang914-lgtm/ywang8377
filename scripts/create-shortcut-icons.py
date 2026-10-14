from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[1]
for size,name in ((192,'courselex-app-192'),(512,'courselex-app-512'),(180,'apple-touch-icon-v2'),(32,'favicon-v2')):
    subprocess.run(['sips','-z',str(size),str(size),str(root/'assets/brand/courselex-app-icon.png'),'--out',str(root/f'icons/{name}.png')],check=True)
