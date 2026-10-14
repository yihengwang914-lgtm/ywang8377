from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]/'icons'
root.mkdir(exist_ok=True)
for size in (192,512):
    image=Image.new('RGB',(size,size),'#f5f2e8')
    draw=ImageDraw.Draw(image)
    font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',int(size*.40))
    draw.text((size/2,size/2),'CL',fill='#232320',font=font,anchor='mm')
    image.save(root/f'courselex-{size}.png')
