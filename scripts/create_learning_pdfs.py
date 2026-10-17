from create_assistant_pdfs import brand
from create_courselex_pdfs import *

# Match the live learning workspace's cool white and green palette.
BG = HexColor('#F5F7F6')
INK = HexColor('#19352C')
MUTED = HexColor('#65766E')
GREEN = HexColor('#167454')

def set_bg(c, width, height, color=BG):
    c.setFillColor(color)
    c.rect(0, 0, width, height, fill=1, stroke=0)

def phone(c, name, x, y, width, height):
    path=ROOT/'assets/pdf'/name
    if not path.exists(): raise FileNotFoundError(path)
    card(c,x-4,y-4,width+8,height+8,WHITE,radius=16)
    c.drawImage(str(path),x,y,width,height,preserveAspectRatio=True,anchor='c',mask='auto')

def title(c, label, heading, number, width, height):
    set_bg(c,width,height);page_number(c,number,width)
    text(c,label,46,height-64,10,GREEN,'CourseLexBold')
    text(c,heading,46,height-105,26,INK,'CourseLexBold')

def guide():
    path=OUT/'courselex-user-guide.pdf';w,h=A4;c=canvas.Canvas(str(path),pagesize=A4)
    set_bg(c,w,h);brand(c,46,h-66,1.05)
    text(c,'让课件，变成你的',46,651,29,INK,'CourseLexBold')
    text(c,'私人学习对话。',46,607,29,INK,'CourseLexBold')
    text(c,'奇点 CourseLex AI · 莱克学习指南',46,565,12,GREEN)
    for i,(a,b) in enumerate([
      ('上传一次','把老师的 PDF、PPT 或 Canvas ZIP 交给莱克。'),
      ('先讲懂','用简单解释、课堂例子和可展开的原文依据理解知识点。'),
      ('再练会','题库提前准备好，英文题目与选项，提交后看中文解析。'),
      ('按时再见','错题进入薄弱点复习，也可以安排几天的小任务。')]):
        y=487-i*82;card(c,46,y-42,w-92,68,WHITE);text(c,f'0{i+1}',62,y,13,GREEN,'CourseLexBold');text(c,a,102,y,14,INK,'CourseLexBold');text(c,b,102,y-23,10,MUTED,max_width=w-164,leading=16)
    text(c,'每一个知识点，都是新的起点。',46,95,12,GREEN)
    text(c,'www.courselexai.com',46,62,13,GREEN,'CourseLexBold');draw_qr(c,'https://www.courselexai.com/',451,57,60);page_number(c,1,w);c.showPage()

    title(c,'01 / 开始与讲解','第一次使用，三步就够',2,w,h)
    phone(c,'learning-welcome-mobile.png',348,214,190,454)
    y=677
    for a,b in [
      ('注册并验证邮箱','填写邮箱、密码和用户名。首次进入有三步功能引导，可跳过；以后可在“账户 → 功能引导”重新查看。学校等资料可稍后补充。'),
      ('整包交给莱克','在 Canvas 的 Files 下载 ZIP，直接上传，不用解压或逐个 Week 选择。选错的附件可移除；阅读材料会先跳过。'),
      ('选一门课，直接问','只有一门课时会自动选好；多门课可在顶部选范围，或在问题里写课号。课件保存后就能问答，无需等词汇全部整理完。')]:
        y=bullet(c,a,b,46,y,265)-35
    card(c,46,90,w-92,94,WHITE);text(c,'你可以这样说',62,155,13,GREEN,'CourseLexBold')
    text(c,'“用简单的话讲解 Week 2 的数据最小化，再举个生活例子。”',62,130,10,INK,max_width=w-124,leading=17)
    text(c,'“帮我整理这份课件的重点和容易混淆的概念，附上依据。”',62,108,10,INK,max_width=w-124,leading=17);c.showPage()

    title(c,'02 / 理解、练习与反馈','在同一段对话里，练到懂',3,w,h)
    phone(c,'learning-quiz-mobile.png',46,159,199,502)
    y=675
    for a,b in [
      ('先做题，再看答案','课件导入后，后台提前准备英文练习并核对答案。就绪后说“根据课件出 3 道题”，直接取题；点击选项或回复 A/B/C/D。简答支持中英文作答。'),
      ('答错也要知道为什么','提交后停在正确答案、解析和课件出处，读懂后点击“下一题”。选择题即时批改；简答由 AI 结合原文反馈。'),
      ('提问不打断学习','哪里不懂就追问，或说“换个例子”。可以暂停一组练习，之后从作答记录继续。'),
      ('核对原文','讲解和重点下方的“课件出处”可以展开查看文件名、周次、文字段和引用内容。文字段不等于 PDF 页码。')]:
        y=bullet(c,a,b,272,y,275)-30
    text(c,'首页下方保留背词；账户菜单提供导入词表、上传帮助与功能引导。',46,91,10,GREEN,max_width=w-92,leading=17);c.showPage()

    title(c,'03 / 复习与使用边界','学过之后，让它再见几次',4,w,h)
    y=688
    for a,b in [
      ('薄弱知识点自动安排','答错约 10 分钟后再练；答对后按连续答对情况逐步安排 1、3、7、14、30 天后的复习。在“记录 → 知识点复习”里查看，也可提前复习。'),
      ('把复习变成小任务','说“根据我的薄弱点，安排三天复习，每次 15 分钟”。任务卡显示日期、时长与内容，点击“开始”继续对话，完成后由你勾选。'),
      ('刷新后继续','上传中刷新会继续已保存的进度；已上传的课件和词库可在另一台设备找回。对话、反馈和复习安排保存到云端，从“记录”继续。尚未上传完的原文件需要重新选择。'),
      ('旧词库不会被覆盖','旧版曾在生成单词后清理课件文字。如果提示没有原文，请重新上传课件以启用讲解和出题。原有词库与进度继续保留。'),
      ('上传和空间范围','支持 ZIP、PDF、PPT/PPTX、DOCX、TXT 与常见图片。每批最多 60 个文件；ZIP ≤80 MB，单文件 ≤20 MB / 100 页。每个账号保留约 200 万字提取原文。'),
      ('把 AI 当作学习搭档','课件只用于当前账号的私人学习。扫描识别、复杂图表和 AI 批改仍可能出错，重要结论结合老师课件核对；没有原文时会说明依据不足。')]:
        y=bullet(c,a,b,46,y,w-92)-25
    text(c,'www.courselexai.com',46,67,13,GREEN,'CourseLexBold');c.showPage()

    title(c,'04 / 从开学，到考前','把整个学期连起来',5,w,h)
    phone(c,'learning-calendar-mobile.png',350,220,188,407)
    y=686
    for a,b in [
      ('选课与学期规划','点“新对话 → 选课与学期规划”，与莱克比较候选课程、目标、毕业要求和可用时间。最新选课规则与名额请到学校官方系统核实。'),
      ('先导入 syllabus','打开“课程空间 → 日历 → 导入 syllabus”，选择 PDF、文档、文本文件或粘贴大纲。逐条核对原文、日期和时区后添加；每周上课可以设置重复次数。'),
      ('日历带到手机','点“导出日历”，将 .ics 文件导入手机或电脑日历应用。后续在网页修改后，需要重新导出；这不是自动双向同步。'),
      ('对话分别保存','顶部选择课程；同一门课可以新建学习、作业辅导或考前复习话题。各话题独立保存，切换课程不会带入另一门课的聊天记录。')]:
        y=bullet(c,a,b,46,y,266)-25
    text(c,'日期不明确时，莱克会留空让你确认；不会替你猜作业截止时间。',46,100,10,GREEN,max_width=w-92,leading=17);c.showPage()

    title(c,'05 / 笔记与行动','理解留下来，复习接下去',6,w,h)
    phone(c,'learning-notes-mobile.png',46,202,196,445)
    y=686
    for a,b in [
      ('解释变成自己的笔记','在莱克的回答下点“存为笔记”，或在“课程空间 → 笔记”中新建、导入和编辑。支持 Markdown 预览、自动保存和导出。'),
      ('作业单独开一个话题','点“新对话”，选课程和“作业辅导”。可以讨论题目、梳理思路和检查草稿；用清楚的话题名保存，之后从“记录”继续。'),
      ('复习任务加入日历','计划下方点“加入课程日历”。关联任务的完成状态会在计划与网页日历之间同步；时间和备注可在日历中调整。'),
      ('保护修改，保留控制','未同步笔记会保留本机草稿。两台设备同时修改时会提示冲突，可导出或另存一份，避免直接覆盖。选课官网、Canvas 和学校图书馆在“学校链接”中打开。')]:
        y=bullet(c,a,b,270,y,275)-27
    text(c,'邮箱自动同步后续再接；目前可主动粘贴所选邮件，确认后整理到日历。',46,105,10,GREEN,max_width=w-92,leading=17)
    text(c,'www.courselexai.com',46,67,13,GREEN,'CourseLexBold');c.save();return path

def brochure():
    path=OUT/'courselex-product-brochure.pdf';w,h=landscape(A4);c=canvas.Canvas(str(path),pagesize=landscape(A4))
    set_bg(c,w,h);brand(c,43,h-61,.95)
    text(c,'从开学，到考前，',43,402,31,INK,'CourseLexBold');text(c,'学习接起来。',43,354,31,INK,'CourseLexBold')
    text(c,'莱克 Lex · 你的课堂学习助理',43,306,13,GREEN,'CourseLexBold')
    for i,line in enumerate(['syllabus 整理日历，按课程保存对话与笔记','课堂讲解、作业辅导与英文模拟练习','难词术语、薄弱点复习和学习计划衔接']):text(c,'• '+line,43,252-i*35,12,INK)
    phone(c,'learning-welcome-mobile.png',537,93,225,425)
    text(c,'每一个知识点，都是新的起点。',43,103,11,GREEN)
    text(c,'www.courselexai.com',43,61,16,GREEN,'CourseLexBold');draw_qr(c,'https://www.courselexai.com/',366,49,65);c.showPage()
    set_bg(c,w,h);text(c,'一次上传，在同一段对话里学下去。',43,h-62,26,INK,'CourseLexBold')
    cards=[('01 准备','先做选课与学期规划。导入 syllabus，确认课程与作业日期，导出手机日历。'),('02 理解','整包上传课堂材料。按课程问知识点、整理重点、讨论作业，把解释存为可编辑笔记。'),('03 练习','后台提前准备英文理解与应用题，并核对答案。就绪后直接练，提交后看中文解析；简答支持中英文作答。'),('04 复习','难词与薄弱知识点继续巩固。学习任务加入日历，从保存的课程对话和笔记接着学。')]
    for i,(a,b) in enumerate(cards):
        x=43+(i%2)*381;y=281-(i//2)*173;card(c,x,y,358,150,WHITE);text(c,a,x+20,y+110,18,GREEN,'CourseLexBold');text(c,b,x+20,y+77,11,MUTED,max_width=316,leading=20)
    text(c,'按账号和课程隔离学习内容，进度与对话随账号同步。背单词与已有词表导入继续保留。',43,82,10,GREEN,max_width=w-86,leading=17)
    text(c,'内测版 · AI 结果请结合原课件核对。扫描、图表与手写内容的识别效果因材料而异。',43,55,9,MUTED)
    c.save();return path

if __name__=='__main__':
    print(guide());print(brochure())
