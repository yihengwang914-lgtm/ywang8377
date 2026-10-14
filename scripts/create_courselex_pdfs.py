from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
TMP = ROOT / "assets" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

BG = HexColor("#F5F2E8")
CARD = HexColor("#FBFAF6")
INK = HexColor("#22221F")
MUTED = HexColor("#77756E")
LINE = HexColor("#DDD8CC")
GREEN = HexColor("#327D62")
RED = HexColor("#A95D56")
WHITE = HexColor("#FFFFFF")

FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_LIGHT_PATH = "/System/Library/Fonts/STHeiti Light.ttc"
pdfmetrics.registerFont(TTFont("CourseLex", FONT_LIGHT_PATH))
pdfmetrics.registerFont(TTFont("CourseLexBold", FONT_PATH))


def set_bg(c, width, height, color=BG):
    c.setFillColor(color)
    c.rect(0, 0, width, height, fill=1, stroke=0)


def text(c, value, x, y, size=12, color=INK, font="CourseLex", max_width=None, leading=None):
    c.setFillColor(color)
    c.setFont(font, size)
    if not max_width:
        c.drawString(x, y, value)
        return y
    leading = leading or size * 1.55
    lines, current = [], ""
    for ch in value:
        test = current + ch
        if current and pdfmetrics.stringWidth(test, font, size) > max_width:
            lines.append(current)
            current = ch
        else:
            current = test
    if current:
        lines.append(current)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def tag(c, label, x, y, fill=INK, fg=WHITE):
    width = pdfmetrics.stringWidth(label, "CourseLexBold", 9) + 20
    c.setFillColor(fill)
    c.roundRect(x, y - 4, width, 22, 11, fill=1, stroke=0)
    text(c, label, x + 10, y + 2, 9, fg, "CourseLexBold")
    return width


def page_number(c, n, width):
    text(c, f"COURSELEX AI  ·  {n:02d}", 44, 25, 8, MUTED, "CourseLexBold")
    c.setStrokeColor(LINE)
    c.line(44, 42, width - 44, 42)


def card(c, x, y, w, h, fill=CARD, stroke=LINE, radius=18):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)


def draw_image_cover(c, path, x, y, w, h):
    img = ImageReader(str(path))
    iw, ih = img.getSize()
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    p = c.beginPath()
    p.rect(x, y, w, h)
    c.clipPath(p, stroke=0, fill=0)
    c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    c.restoreState()


def bullet(c, title, body, x, y, width, number=None):
    if number is not None:
        c.setFillColor(INK)
        c.circle(x + 12, y + 3, 12, fill=1, stroke=0)
        text(c, str(number), x + 8.5, y - 1, 10, WHITE, "CourseLexBold")
        tx = x + 34
    else:
        c.setFillColor(GREEN)
        c.circle(x + 5, y + 4, 3, fill=1, stroke=0)
        tx = x + 16
    text(c, title, tx, y, 13, INK, "CourseLexBold")
    return text(c, body, tx, y - 22, 9.5, MUTED, "CourseLex", width - (tx - x), 15)


def draw_qr(c, url, x, y, size=86):
    c.setFillColor(WHITE)
    c.rect(x - 4, y - 4, size + 8, size + 8, fill=1, stroke=0)
    widget = qr.QrCodeWidget(url)
    bounds = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def guide():
    path = OUT / "courselex-user-guide.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    c.setTitle("CourseLex AI 用户指南")
    c.setAuthor("CourseLex AI")

    # Cover
    set_bg(c, width, height)
    tag(c, "USER GUIDE · 2026", 44, height - 62)
    text(c, "CourseLex AI", 44, height - 130, 34, INK, "CourseLexBold")
    text(c, "把专业词汇真正记下来。", 44, height - 178, 24, INK, "CourseLexBold")
    text(c, "注册、建课、导入词表、学习与同步，一份指南完成上手。", 44, height - 214, 11, MUTED, max_width=320)
    card(c, 44, 95, width - 88, 430, WHITE, LINE, 24)
    draw_image_cover(c, TMP / "courselex-login.png", 58, 109, width - 116, 402)
    text(c, "www.courselexai.com", 44, 65, 10, GREEN, "CourseLexBold")
    c.showPage()

    # Signup and profile
    set_bg(c, width, height)
    page_number(c, 2, width)
    text(c, "01  注册与个人资料", 44, height - 72, 25, INK, "CourseLexBold")
    text(c, "每个账号都有独立课程、词库和学习进度。", 44, height - 104, 10, MUTED)
    card(c, 44, 308, 250, 390, WHITE)
    draw_image_cover(c, TMP / "courselex-signup.png", 55, 320, 228, 366)
    y = height - 160
    y = bullet(c, "创建账号", "点击“创建账号”，填写邮箱和至少 8 位密码。", 324, y, 225, 1) - 18
    y = bullet(c, "验证邮箱", "打开 CourseLex AI 发来的邮件，完成验证后返回登录。", 324, y, 225, 2) - 18
    y = bullet(c, "完善资料", "首次登录填写用户名、学校和专业。用户名需保持唯一。", 324, y, 225, 3) - 18
    y = bullet(c, "智能选校", "学校栏输入“香港”、英文校名或 HKUST、CityUHK 等简称，下方会出现匹配院校；名单外学校可直接填写。", 324, y, 225, 4)
    card(c, 324, 90, 225, 118, INK, INK, 16)
    text(c, "隐私提示", 342, 178, 11, WHITE, "CourseLexBold")
    text(c, "学校和专业用于试用分析。其他普通用户无法查看；只有管理员后台可以读取。", 342, 154, 9, HexColor("#D8D8D0"), max_width=185, leading=14)
    c.showPage()

    # Courses
    set_bg(c, width, height)
    page_number(c, 3, width)
    text(c, "02  创建课程与周数", 44, height - 72, 25, INK, "CourseLexBold")
    text(c, "从首页进入“课程设置”，课程数量由你决定。", 44, height - 104, 10, MUTED)
    card(c, 44, 425, width - 88, 290, WHITE)
    text(c, "自定义课程", 70, 675, 18, INK, "CourseLexBold")
    fields = [("课程名称", "Communication and New Media", 190, 205), ("课程简称", "COM5101", 125, 140), ("周数", "13", 90, 105)]
    x = 70
    for label, value, field_width, step in fields:
        text(c, label, x, 630, 9, MUTED, "CourseLexBold")
        card(c, x, 574, field_width, 42, WHITE, LINE, 9)
        text(c, value, x + 12, 590, 10, INK)
        x += step
    tag(c, "添加课程", 70, 525)
    text(c, "支持 1–52 周", 70, 482, 13, GREEN, "CourseLexBold")
    text(c, "课程会自动生成 Week 1 到设定周数。后续可以修改名称、简称和周数。", 70, 458, 10, MUTED, max_width=430)
    y = 360
    y = bullet(c, "首页课程卡片", "显示课程词数和熟词数量，点击后进入各周。", 50, y, 235) - 22
    y = bullet(c, "删除可恢复", "删除课程只会归档，词汇和进度继续保留；可在课程设置中恢复。", 50, y, 235)
    y = 360
    y = bullet(c, "独立周数", "不同课程可以设置不同周数，最长支持 52 周。", 310, y, 235) - 22
    bullet(c, "数据自动同步", "同一账号换设备登录后，会加载自己的课程与学习进度。", 310, y, 235)
    c.showPage()

    # Import
    set_bg(c, width, height)
    page_number(c, 4, width)
    text(c, "03  导入专业词表", 44, height - 72, 25, INK, "CourseLexBold")
    text(c, "推荐使用“用自己的 AI 整理”，不消耗网站站长的 API 额度。", 44, height - 104, 10, MUTED)
    y = height - 170
    steps = [
        ("复制提示词", "在首页点击“用自己的 AI 整理”，选择课程与 Week，然后复制整理提示词。"),
        ("在自己的 AI 上传课件", "可使用 ChatGPT 或其他支持文件的 AI，上传 PDF、PPTX、DOCX 或文本。"),
        ("粘贴或上传结果", "把“英文 | 中文”两列词表粘贴回来，也支持 TXT、TSV、JSON 文件。"),
        ("预览并保存", "系统会检查格式、去重并显示预览；确认后保存到当前账号的对应课程与周次。"),
    ]
    for i, (title, body) in enumerate(steps, 1):
        card(c, 44, y - 74, width - 88, 78, WHITE)
        c.setFillColor(INK);c.circle(74, y - 35, 18, fill=1, stroke=0)
        text(c, str(i), 69, y - 41, 13, WHITE, "CourseLexBold")
        text(c, title, 105, y - 25, 13, INK, "CourseLexBold")
        text(c, body, 105, y - 48, 9.5, MUTED, max_width=405, leading=14)
        y -= 102
    card(c, 44, 102, width - 88, 92, INK, INK, 16)
    text(c, "API 自动整理", 64, 163, 12, WHITE, "CourseLexBold")
    text(c, "功能继续保留，但需要上传口令并可能产生模型费用。试用阶段建议优先使用自己的 AI。", 64, 137, 9.5, HexColor("#D8D8D0"), max_width=450, leading=15)
    c.showPage()

    # Study
    set_bg(c, width, height)
    page_number(c, 5, width)
    text(c, "04  学习与复习", 44, height - 72, 25, INK, "CourseLexBold")
    text(c, "进入课程与 Week 后，选择适合自己的学习方式。", 44, height - 104, 10, MUTED)
    modes = [("A", "四选一", "根据英文选择中文释义。答错自动进入生词状态。"), ("B", "认识 / 不认识", "先判断是否认识，再核对中文释义并确认结果。"), ("C", "词库管理", "单个添加、批量导入、查看或删除当前周词汇。")]
    x = 44
    for mark, title, body in modes:
        card(c, x, 410, 160, 275, WHITE)
        tag(c, mark, x + 18, 650, GREEN)
        text(c, title, x + 18, 600, 17, INK, "CourseLexBold")
        text(c, body, x + 18, 565, 10, MUTED, max_width=124, leading=16)
        x += 174
    card(c, 44, 125, width - 88, 230, INK, INK, 20)
    text(c, "云端学习进度", 70, 310, 19, WHITE, "CourseLexBold")
    text(c, "每次作答都会更新词汇状态、学习次数与错误次数。熟词本和生词本跨课程汇总，退出再登录也不会丢失。", 70, 270, 11, HexColor("#D8D8D0"), max_width=440, leading=19)
    text(c, "● 已同步", 70, 205, 11, HexColor("#7FC3A8"), "CourseLexBold")
    text(c, "看到右上角“已同步”表示当前数据已经写入个人云端。", 160, 205, 10, HexColor("#D8D8D0"))
    c.showPage()

    # Help
    set_bg(c, width, height)
    page_number(c, 6, width)
    text(c, "05  常见问题", 44, height - 72, 25, INK, "CourseLexBold")
    faqs = [
        ("为什么注册后看不到课程？", "新账号默认没有课程。先完成个人资料，再进入“课程设置”添加自己的课程。"),
        ("为什么没有收到验证邮件？", "检查垃圾邮件并稍等片刻。免费邮件服务有每日发送额度，必要时稍后重试。"),
        ("换电脑后进度会消失吗？", "不会。使用同一个邮箱账号登录，课程、词库和学习状态都从云端加载。"),
        ("课程删除后还能找回吗？", "可以。课程设置会显示“已删除 · 可恢复”，恢复后词汇和进度仍在。"),
        ("谁能看到我的学校和专业？", "普通用户看不到。本人可编辑自己的资料，只有受保护的管理员后台能做试用统计。"),
    ]
    y = height - 140
    for q, a in faqs:
        card(c, 44, y - 92, width - 88, 96, WHITE)
        text(c, q, 64, y - 28, 12, INK, "CourseLexBold")
        text(c, a, 64, y - 54, 9.5, MUTED, max_width=450, leading=15)
        y -= 112
    text(c, "需要开始？打开 www.courselexai.com", 44, 70, 12, GREEN, "CourseLexBold")
    c.save()
    return path


def brochure():
    size = landscape(A4)
    width, height = size
    path = OUT / "courselex-product-brochure.pdf"
    c = canvas.Canvas(str(path), pagesize=size)
    c.setTitle("CourseLex AI 产品介绍")
    c.setAuthor("CourseLex AI")

    # Cover
    set_bg(c, width, height)
    tag(c, "COURSELEX AI · PILOT EDITION", 52, height - 60)
    text(c, "把每门课的专业词汇", 52, height - 142, 34, INK, "CourseLexBold")
    text(c, "变成真正记得住的知识。", 52, height - 190, 34, INK, "CourseLexBold")
    text(c, "为大学生设计的个性化课程词库与学习进度平台。", 52, height - 235, 13, MUTED)
    card(c, 52, 72, 360, 255, WHITE, LINE, 22)
    draw_image_cover(c, TMP / "courselex-login.png", 62, 82, 340, 235)
    card(c, 450, 72, 335, 255, INK, INK, 22)
    text(c, "课程 × 周次 × 个人进度", 478, 280, 18, WHITE, "CourseLexBold")
    text(c, "每位用户自定义课程与 1–52 周结构，词库、熟词、生词和学习记录完全隔离。", 478, 240, 11, HexColor("#D8D8D0"), max_width=270, leading=18)
    text(c, "www.courselexai.com", 478, 130, 15, HexColor("#7FC3A8"), "CourseLexBold")
    draw_qr(c, "https://www.courselexai.com/", 676, 105, 76)
    c.showPage()

    # Value
    set_bg(c, width, height)
    text(c, "一个清晰的学习闭环", 52, height - 70, 28, INK, "CourseLexBold")
    text(c, "从课件到记忆，每一步都围绕自己的课程发生。", 52, height - 104, 11, MUTED)
    items = [
        ("01", "建课", "自由设置课程名称、简称与周数。"),
        ("02", "整理", "用自己的 AI 或 API 从课件提取双语术语。"),
        ("03", "学习", "四选一与认识判断，快速建立熟悉度。"),
        ("04", "同步", "生词、熟词和进度安全写入个人云端。"),
    ]
    x = 52
    for n, title, body in items:
        card(c, x, 190, 170, 300, WHITE)
        text(c, n, x + 20, 445, 13, GREEN, "CourseLexBold")
        text(c, title, x + 20, 390, 23, INK, "CourseLexBold")
        text(c, body, x + 20, 345, 10.5, MUTED, max_width=130, leading=18)
        x += 190
    text(c, "重点功能", 52, 145, 10, MUTED, "CourseLexBold")
    labels = ["邮箱注册与验证", "智能学校联想", "自定义课程", "1–52 周", "个人词库", "学习进度同步", "可恢复课程", "管理后台"]
    x, y = 52, 110
    for label in labels:
        w = tag(c, label, x, y, INK)
        x += w + 9
    c.showPage()

    # Trust and admin
    set_bg(c, width, height)
    text(c, "适合小范围真实试用", 52, height - 70, 28, INK, "CourseLexBold")
    text(c, "体验简单，数据边界清楚，运营状态可看见。", 52, height - 104, 11, MUTED)
    card(c, 52, 105, 345, 360, INK, INK, 22)
    text(c, "用户侧", 82, 450, 11, HexColor("#7FC3A8"), "CourseLexBold")
    text(c, "每个人只看到自己的数据", 82, 410, 21, WHITE, "CourseLexBold")
    bullets = ["课程、词库和进度按账号隔离", "用户名、学校和专业可自行维护", "课程删除后可恢复，不丢词汇", "共享 API 之外，可用自己的 AI 零站长成本整理"]
    y = 355
    for b in bullets:
        c.setFillColor(HexColor("#7FC3A8"));c.circle(88, y + 3, 3, fill=1, stroke=0)
        text(c, b, 102, y, 10.5, HexColor("#D8D8D0"), max_width=250, leading=17)
        y -= 56
    card(c, 425, 105, 360, 360, WHITE)
    text(c, "管理员侧", 455, 450, 11, GREEN, "CourseLexBold")
    text(c, "试用数据一页掌握", 455, 410, 21, INK, "CourseLexBold")
    stats = [("注册", "总人数 / 资料完成"), ("活跃", "7 天 / 30 天"), ("使用", "时长 / 次数 / 活跃日"), ("学习", "课程 / 词汇 / 熟词"), ("容量", "数据库占用 / 建议人数")]
    y = 355
    for name, desc in stats:
        text(c, name, 455, y, 12, INK, "CourseLexBold")
        text(c, desc, 530, y, 10, MUTED)
        c.setStrokeColor(LINE);c.line(455, y - 16, 750, y - 16)
        y -= 52
    c.showPage()

    # Capacity
    set_bg(c, width, height)
    text(c, "免费套餐也能支撑一轮校园试用", 52, height - 70, 28, INK, "CourseLexBold")
    text(c, "基于 2026-10-14 的实际数据库测量与官方免费额度。", 52, height - 104, 11, MUTED)
    card(c, 52, 290, 350, 190, WHITE)
    text(c, "13 MB", 80, 420, 34, INK, "CourseLexBold")
    text(c, "当前数据库占用 / 500 MB 免费额度", 80, 386, 10, MUTED)
    c.setFillColor(HexColor("#E8E3D8"));c.roundRect(80, 342, 290, 14, 7, fill=1, stroke=0)
    c.setFillColor(GREEN);c.roundRect(80, 342, 8, 14, 7, fill=1, stroke=0)
    text(c, "约 2.55%", 80, 316, 9, GREEN, "CourseLexBold")
    card(c, 435, 290, 350, 190, INK, INK, 22)
    text(c, "200–300 人", 465, 420, 32, WHITE, "CourseLexBold")
    text(c, "建议的重度试用规模", 465, 385, 10, HexColor("#D8D8D0"))
    text(c, "按每人约 1,736 个词、每天完整同步一次估算。", 465, 345, 10, HexColor("#D8D8D0"), max_width=275, leading=17)
    limits = [("Supabase", "500 MB 数据库 · 5 GB egress · 50,000 MAU"), ("GitHub Pages", "每月 100 GB 软性带宽"), ("Brevo", "每天 300 封验证 / 重置邮件"), ("AI", "自己的 AI 不消耗站长 API 额度")]
    y = 235
    for name, desc in limits:
        text(c, name, 52, y, 11, INK, "CourseLexBold")
        text(c, desc, 185, y, 10, MUTED)
        c.setStrokeColor(LINE);c.line(52, y - 17, 785, y - 17)
        y -= 46
    text(c, "立即体验", 540, 72, 10, MUTED, "CourseLexBold")
    text(c, "www.courselexai.com", 540, 48, 14, GREEN, "CourseLexBold")
    draw_qr(c, "https://www.courselexai.com/", 705, 42, 70)
    c.save()
    return path


if __name__ == "__main__":
    print(guide())
    print(brochure())
