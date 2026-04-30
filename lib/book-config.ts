/**
 * 小说创建配置
 * 题材、风格、字数等预设选项
 */

export interface GenreOption {
  value: string
  label: string
  description: string
  defaultStyle: string
  exampleIdeas: string[]
}

export interface StyleOption {
  value: string
  label: string
  description: string
}

export interface WordCountOption {
  value: number
  label: string
  description: string
  chapterCount: string
}

export const GENRE_OPTIONS: GenreOption[] = [
  {
    value: '都市异能',
    label: '都市异能',
    description: '现代都市背景下的超能力故事',
    defaultStyle: '快节奏、爽点密集、贴近现实',
    exampleIdeas: [
      '一个普通上班族意外获得读取他人情绪的能力',
      '快递员发现自己的身体可以穿越物体',
      '外卖骑手获得了时间暂停的能力，但只有3秒',
    ],
  },
  {
    value: '玄幻升级',
    label: '玄幻升级',
    description: '修炼、打怪、升级、换地图',
    defaultStyle: '热血励志、等级清晰、世界观宏大',
    exampleIdeas: [
      '废材少年觉醒双生武魂，走上逆天改命之路',
      '穿越到修仙世界，发现自己是炉鼎体质',
      '一个杂役弟子在藏经阁扫地时发现上古秘籍',
    ],
  },
  {
    value: '悬疑推理',
    label: '悬疑推理',
    description: '破案、解谜、反转、心理博弈',
    defaultStyle: '逻辑严密、节奏紧凑、悬念迭起',
    exampleIdeas: [
      '刑警队长发现连环凶案的凶手竟然是自己',
      '密闭空间里的死亡游戏，凶手就在7人之中',
      '每死一个人就会收到一封预告信',
    ],
  },
  {
    value: '科幻未来',
    label: '科幻未来',
    description: '未来科技、太空、AI、基因',
    defaultStyle: '硬科幻、思想深刻、设定严谨',
    exampleIdeas: [
      '人类意识上传后，发现数字世界比现实更残酷',
      '最后一个没有植入芯片的人成了通缉犯',
      '宇航员在火星发现了一座人类城市的废墟',
    ],
  },
  {
    value: '末世生存',
    label: '末世生存',
    description: '丧尸、天灾、资源争夺、重建文明',
    defaultStyle: '黑暗压抑、人性考验、生存至上',
    exampleIdeas: [
      '丧尸爆发后，发现自己的血液是疫苗原料',
      '全球断电后，一个电工成了最抢手的人',
      '陨石带来外星病毒，感染者获得超能力但会逐渐失控',
    ],
  },
  {
    value: '历史架空',
    label: '历史架空',
    description: '穿越、权谋、战争、改朝换代',
    defaultStyle: '厚重沉稳、细节考究、权谋智斗',
    exampleIdeas: [
      '穿越成末代皇帝，用现代知识翻盘',
      '一个账房先生发现朝廷的惊天贪腐案',
      '女扮男装入朝为官，卷入党争漩涡',
    ],
  },
  {
    value: '东方仙侠',
    label: '东方仙侠',
    description: '修仙、道法、江湖、恩怨情仇',
    defaultStyle: '意境悠远、仙气飘渺、情义深重',
    exampleIdeas: [
      '一个扫地童子被误认为是隐世高人',
      '剑修发现自己的剑灵是前世仇人',
      '魔道圣女的替身丫鬟成了真圣女',
    ],
  },
  {
    value: '游戏竞技',
    label: '游戏竞技',
    description: '电竞、网游、全息、策略',
    defaultStyle: '紧张刺激、技术流、团队配合',
    exampleIdeas: [
      '退役选手被迫复出，带领一群新人冲击冠军',
      '全息游戏里死亡就是真的死亡',
      '发现游戏里的NPC其实是真人意识上传',
    ],
  },
  {
    value: '恐怖灵异',
    label: '恐怖灵异',
    description: '鬼怪、诅咒、禁忌、心理恐惧',
    defaultStyle: '氛围营造、心理压迫、细思极恐',
    exampleIdeas: [
      '搬进新家后发现墙里有个人一直在模仿自己',
      '每张照片里都有一个不该存在的人',
      '规则怪谈：必须遵守的诡异规则',
    ],
  },
  {
    value: '商战职场',
    label: '商战职场',
    description: '创业、并购、权谋、逆袭',
    defaultStyle: '现实感强、智斗精彩、节奏明快',
    exampleIdeas: [
      '被裁员后发现前公司的核心代码是自己写的',
      '破产富二代用最后10万翻盘',
      '发现竞争对手的CEO是自己失散多年的兄弟',
    ],
  },
  {
    value: '言情甜宠',
    label: '言情甜宠',
    description: '爱情、甜宠、虐恋、先婚后爱',
    defaultStyle: '细腻温馨、情绪饱满、甜而不腻',
    exampleIdeas: [
      '先婚后爱：合约婚姻对象竟是暗恋多年的学长',
      '重生后决定远离渣男，却发现他也重生了',
      '霸总的秘书其实是个隐藏的格斗高手',
    ],
  },
  {
    value: '无限流',
    label: '无限流',
    description: '副本、任务、生存、进化',
    defaultStyle: '脑洞大开、副本多样、团队博弈',
    exampleIdeas: [
      '被困在死亡游戏里，唯一出路是成为管理员',
      '每个副本都是一本书，必须改变结局才能离开',
      '发现副本里的Boss是现实世界的自己',
    ],
  },
  {
    value: '国运文',
    label: '国运文',
    description: '国家命运、民族崛起、历史使命',
    defaultStyle: '热血激昂、家国情怀、波澜壮阔',
    exampleIdeas: [
      '穿越到近代，用现代科技改变国运',
      '发现历史书上的战争其实是超能力者之战',
      '一个普通人的日记成了改变历史的钥匙',
    ],
  },
  {
    value: '种田文',
    label: '种田文',
    description: '基建、经营、发展、养成',
    defaultStyle: '细水长流、温馨治愈、成就感强',
    exampleIdeas: [
      '穿越到荒年，带着全村人种地致富',
      '继承了一个荒废的农场，发现土地有神奇能力',
      '在末世经营一家安全屋，成了人类最后的希望',
    ],
  },
  {
    value: '钓鱼文',
    label: '钓鱼',
    description: '垂钓、渔具、大鱼、水域探险',
    defaultStyle: '轻松解压、期待感强、收获反馈明确',
    exampleIdeas: [
      '辞职回乡钓鱼，发现钓到的鱼能兑换超能力',
      '一个被开除的饵料研究员，发现神秘配方能钓起传说中的鱼',
      '继承去世爷爷的钓棚，发现水下有通往异世界的入口',
    ],
  },
  {
    value: '克苏鲁',
    label: '克苏鲁',
    description: '不可名状、疯狂、调查、绝望',
    defaultStyle: '压抑诡异、未知恐惧、理智崩坏',
    exampleIdeas: [
      '调查员发现城市的地下有另一个城市',
      '每读一本书就会失去一段记忆',
      '发现自己的梦境是另一个维度的现实',
    ],
  },
]

export const STYLE_OPTIONS: StyleOption[] = [
  { value: '快节奏', label: '快节奏', description: '情节推进快，不拖沓' },
  { value: '慢热型', label: '慢热型', description: '铺垫充分，渐入佳境' },
  { value: '爽文流', label: '爽文流', description: '打脸升级，爽快淋漓' },
  { value: '虐心向', label: '虐心向', description: '情感纠葛，催人泪下' },
  { value: '悬疑感', label: '悬疑感', description: '悬念迭起，扣人心弦' },
  { value: '热血向', label: '热血向', description: '激情澎湃，热血沸腾' },
  { value: '黑暗风', label: '黑暗风', description: '残酷现实，人性考验' },
  { value: '轻松幽默', label: '轻松幽默', description: '诙谐风趣，轻松愉快' },
  { value: '硬核技术', label: '硬核技术', description: '专业细节，技术为王' },
  { value: '细腻描写', label: '细腻描写', description: '文笔优美，细节丰富' },
  { value: '对话流', label: '对话流', description: '对白精彩，性格鲜明' },
  { value: '多线叙事', label: '多线叙事', description: '多条线索，交织推进' },
]

export const WORD_COUNT_OPTIONS: WordCountOption[] = [
  { value: 100000, label: '10万字', description: '短篇精品', chapterCount: '30-50章' },
  { value: 300000, label: '30万字', description: '中篇力作', chapterCount: '80-120章' },
  { value: 500000, label: '50万字', description: '标准长篇', chapterCount: '150-200章' },
  { value: 1000000, label: '100万字', description: '史诗巨著', chapterCount: '300-400章' },
  { value: 2000000, label: '200万字', description: '超长篇', chapterCount: '600-800章' },
]

export const CHAPTER_WORD_OPTIONS = [
  { value: 2000, label: '2000字', description: '快节奏，适合移动端阅读' },
  { value: 3000, label: '3000字', description: '标准长度，平衡节奏和信息量' },
  { value: 5000, label: '5000字', description: '长章节，适合深度叙事' },
]
