from PIL import Image, ImageDraw

img = Image.open('c:\\Projecten\\trictrac\\afbeeldingen\\speelbord.png').convert('RGB')
draw = ImageDraw.Draw(img)

# Left field
LF = [105, 147, 189, 231, 273, 315]
# Right field
RF = [390, 432, 474, 516, 558, 600]

TOP_BASE = 70
TOP_TIP = 230
BOTTOM_BASE = 415
BOTTOM_TIP = 255

for x in LF + RF:
    draw.line((x, TOP_BASE, x, TOP_TIP), fill="red", width=2)
    draw.line((x, BOTTOM_BASE, x, BOTTOM_TIP), fill="blue", width=2)

img.save('c:\\Projecten\\trictrac\\afbeeldingen\\test_plot2.png')
