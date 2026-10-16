from create_assistant_pdfs import brand
from create_courselex_pdfs import *

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
      ('再练会','在对话里做题、看解析，用自己的话回答简答题。'),
      ('按时再见','错题进入薄弱点复习，也可以安排几天的小任务。')]):
        y=487-i*82;card(c,46,y-42,w-92,68,WHITE);text(c,f'0{i+1}',62,y,13,GREEN,'CourseLexBold');text(c,a,102,y,14,INK,'CourseLexBold');text(c,b,102,y-23,10,MUTED,max_width=w-164,leading=16)
    text(c,'每一个知识点，都是新的起点。',46,95,12,GREEN)
    text(c,'www.courselexai.com',46,62,13,GREEN,'CourseLexBold');draw_qr(c,'https://www.courselexai.com/',451,57,60);page_number(c,1,w);c.showPage()

    title(c,'01 / 开始与讲解','第一次使用，三步就够',2,w,h)
    phone(c,'learning-welcome-mobile.png',348,214,190,454)
    y=677
    for a,b in [
      ('注册并验证邮箱','填写邮箱、密码和用户名。学校、学历和专业可选填，稍后也能修改。'),
      ('整包交给莱克','在 Canvas 的 Files 下载 ZIP，直接上传，不用解压或逐个 Week 选择。只优先处理老师课件，阅读材料会先跳过。'),
      ('选一门课，直接问','顶部选择学习范围，或者在问题里写课号。有多门课时，莱克会先请你选课。切换课程会开启对应的独立对话。')]:
        y=bullet(c,a,b,46,y,265)-35
    card(c,46,90,w-92,94,WHITE);text(c,'你可以这样说',62,155,13,GREEN,'CourseLexBold')
    text(c,'“用简单的话讲解 Week 2 的数据最小化，再举个生活例子。”',62,130,10,INK,max_width=w-124,leading=17)
    text(c,'“帮我整理这份课件的重点和容易混淆的概念，附上依据。”',62,108,10,INK,max_width=w-124,leading=17);c.showPage()

    title(c,'02 / 理解、练习与反馈','在同一段对话里，练到懂',3,w,h)
    phone(c,'learning-quiz-mobile.png',46,159,199,502)
    y=675
    for a,b in [
      ('先做题，再看答案','说“根据课件出 3 道题”，点击选项或直接回复 A/B/C/D。简答题可以用中文或英文，用自己的话作答。'),
      ('答错也要知道为什么','提交后展示正确答案、解析及课件出处。选择题即时批改；简答题由 AI 结合参考答案和原文反馈。'),
      ('提问不打断学习','哪里不懂就追问，或说“换个例子”。可以暂停一组练习，之后从作答记录继续。'),
      ('核对原文','讲解和重点下方的“课件出处”可以展开查看文件名、周次、文字段和引用内容。文字段不等于 PDF 页码。')]:
        y=bullet(c,a,b,272,y,275)-30
    text(c,'背词仍保留在首页下方；学习记录随账号同步。',46,91,10,GREEN,max_width=w-92,leading=17);c.showPage()

    title(c,'03 / 复习与使用边界','学过之后，让它再见几次',4,w,h)
    y=688
    for a,b in [
      ('薄弱知识点自动安排','答错约 10 分钟后再练；答对后按连续答对情况逐步安排 1、3、7、14、30 天后的复习。在“记录 → 知识点复习”里查看，也可提前复习。'),
      ('把复习变成小任务','说“根据我的薄弱点，安排三天复习，每次 15 分钟”。任务卡显示日期、时长与内容，点击“开始”继续对话，完成后由你勾选。'),
      ('刷新后继续','对话、已作答题目、反馈和复习安排保存到云端。刷新后恢复同一对话，也可以从“记录”打开。未完整生成的回答可点击继续或重试。'),
      ('旧词库不会被覆盖','旧版曾在生成单词后清理课件文字。如果提示没有原文，请重新上传课件以启用讲解和出题。原有词库与进度继续保留。'),
      ('上传和空间范围','支持 ZIP、PDF、PPT/PPTX、DOCX、TXT 与常见图片。每批最多 60 个文件；ZIP ≤80 MB，单文件 ≤20 MB / 100 页。每个账号保留约 200 万字提取原文。'),
      ('把 AI 当作学习搭档','课件只用于当前账号的私人学习。扫描识别、复杂图表和 AI 批改仍可能出错，重要结论结合老师课件核对；没有原文时会说明依据不足。')]:
        y=bullet(c,a,b,46,y,w-92)-25
    text(c,'www.courselexai.com',46,67,13,GREEN,'CourseLexBold');c.save();return path

def brochure():
    path=OUT/'courselex-product-brochure.pdf';w,h=landscape(A4);c=canvas.Canvas(str(path),pagesize=landscape(A4))
    set_bg(c,w,h);brand(c,43,h-61,.95)
    text(c,'从课件，到理解，',43,402,31,INK,'CourseLexBold');text(c,'再到记牢。',43,354,31,INK,'CourseLexBold')
    text(c,'莱克 Lex · 你的课堂学习助理',43,306,13,GREEN,'CourseLexBold')
    for i,line in enumerate(['课件讲解与重点整理，带原文依据','在对话里出题、批改、追问','根据薄弱点，安排下一次复习']):text(c,'• '+line,43,252-i*35,12,INK)
    phone(c,'learning-welcome-mobile.png',537,93,225,425)
    text(c,'每一个知识点，都是新的起点。',43,103,11,GREEN)
    text(c,'www.courselexai.com',43,61,16,GREEN,'CourseLexBold');draw_qr(c,'https://www.courselexai.com/',366,49,65);c.showPage()
    set_bg(c,w,h);text(c,'一次上传，在同一段对话里学下去。',43,h-62,26,INK,'CourseLexBold')
    cards=[('01 上传','Canvas ZIP、PDF、PPT、DOCX 都可交给莱克。识别课堂材料，先跳过阅读资料。'),('02 理解','用自己的话问知识点、要例子、整理重点。回答附可展开的课件出处。'),('03 练习','直接做理解与应用题。提交后看答案与解析，简答支持中英文作答。'),('04 复习','薄弱知识点自动排期。也可以让莱克安排几天的任务，再从对话开始。')]
    for i,(a,b) in enumerate(cards):
        x=43+(i%2)*381;y=281-(i//2)*173;card(c,x,y,358,150,WHITE);text(c,a,x+20,y+110,18,GREEN,'CourseLexBold');text(c,b,x+20,y+77,11,MUTED,max_width=316,leading=20)
    text(c,'按账号和课程隔离学习内容，进度与对话随账号同步。背单词与已有词表导入继续保留。',43,82,10,GREEN,max_width=w-86,leading=17)
    text(c,'内测版 · AI 结果请结合原课件核对。扫描、图表与手写内容的识别效果因材料而异。',43,55,9,MUTED)
    c.save();return path

if __name__=='__main__':
    print(guide());print(brochure())
