export type StratDslInline =
  | { type: 'text'; value: string }
  | { type: 'highlight'; value: string }
  | { type: 'boss' }
  | { type: 'role'; role: 'tank' | 'healer' | 'dps' | 'all' | 'melee' | 'ranged' | 'magic' | 'healer|dps' | 'tank|dps'; tag: string }
  | { type: 'skill'; value: string }
  | { type: 'buff'; buff: 'magical-vulnerability' | 'physical-vulnerability' | 'bleeding'; tag: string }
  | { type: 'damage'; damage: string; damageType: 'physical' | 'magical' | 'special' }
  | { type: 'dot'; damage: string }
  | { type: 'color'; color: 'red' | 'lime' | 'cyan' | 'pink' | 'blue' | 'rose'; value: string }
  | { type: 'link'; href: string; value: string }
  | { type: 'status'; path: string; name: string; tag: string }

export interface StratDslImageNode {
  type: 'image'
  path: string
  title?: string
  alt: string
  width?: string
  line: number
}

export interface StratDslImageGroupNode {
  type: 'image-group'
  images: StratDslImageNode[]
  width?: string
  line: number
}

export type StratDslBlockItem =
  | { type: 'paragraph'; content: StratDslInline[]; line: number }
  | { type: 'heading'; content: StratDslInline[]; line: number }
  | { type: 'quote'; paragraphs: StratDslInline[][]; line: number }
  | { type: 'paragraph-image'; content: StratDslInline[]; image: StratDslImageNode; line: number }
  | { type: 'media'; image: StratDslImageNode; paragraphs: StratDslInline[][]; width?: string; border?: string; line: number }
  | { type: 'conditions'; lead: StratDslInline[]; branches: StratDslInline[][]; line: number }
  | StratDslImageNode
  | StratDslImageGroupNode

export type StratDslNode =
  | { type: 'separator'; title: string; id?: string; line: number }
  | { type: 'event'; time: string; content: StratDslInline[]; line: number }
  | { type: 'warning'; paragraphs: StratDslInline[][]; line: number }
  | { type: 'multi-solution'; defaultSolution: string; solutions: { id: string; title: string; items: StratDslBlockItem[] }[]; line: number }
  | { type: 'collapse'; summary: StratDslInline[]; events: { time: string; content: StratDslInline[]; line: number }[]; line: number }
  | { type: 'animation'; frames: StratDslImageNode[]; interval: number; width?: string; autoplay: boolean; line: number }
  | {
      type: 'cast'
      start: string
      duration?: string
      ability: string
      target?: 'tank' | 'healer' | 'dps' | 'all'
      targetTag?: string
      targetContent?: StratDslInline[]
      damage?: string
      damageType: 'physical' | 'magical' | 'special'
      badge?: string
      badgeVariant?: 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'cyan' | 'blue' | 'purple'
      extra?: StratDslInline[]
      badges?: { text: string; variant: 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'cyan' | 'blue' | 'purple' }[]
      line: number
    }
  | {
      type: 'attack'
      time: string
      name: string
      damage: string
      damageType: 'physical' | 'magical' | 'special'
      line: number
    }
  | { type: 'note' | 'mechanic' | 'solution'; title?: string; items: StratDslBlockItem[]; line: number }
  | StratDslImageNode
  | { type: 'preset'; name: string; start: string; line: number }

export interface StratDslDocument {
  duty: string
  base: string
  nodes: StratDslNode[]
}

export class StratDslError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(`攻略 DSL 第 ${line} 行：${message}`)
  }
}

const timePattern = /^\d{1,2}:\d{2}(?:\.\d{1,3})?$/

function parseInline(source: string): StratDslInline[] {
  const tokens: StratDslInline[] = []
  const pattern = /(==(.+?)==|《(.+?)》|【(Boss|MT|ST|H1|H2|D1|D2|D3|D4|全员|坦克|治疗|输出|治疗输出|流血|流血:\d+|持续伤害:\d+|伤害:\d+:(?:物理|魔法|特殊)|链接:[^:】]+:[^】]+|状态:[^:】]+:[^:】]+(?::[^】]+)?|(?:红字|绿字|青字|粉字|蓝字|玫红字|坦克|治疗|输出|近战|远敏|法系|治疗输出|坦克输出|魔法易伤|物理易伤):[^】]+)】)/gi
  let cursor = 0

  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push({ type: 'text', value: source.slice(cursor, index) })

    if (match[2]) {
      tokens.push({ type: 'highlight', value: match[2] })
    } else if (match[3]) {
      tokens.push({ type: 'skill', value: match[3] })
    } else {
      const tag = match[4]
      if (tag.toLowerCase() === 'boss') tokens.push({ type: 'boss' })
      else if (tag.startsWith('链接:')) {
        const [, href, ...value] = tag.split(':')
        tokens.push({ type: 'link', href, value: value.join(':') })
      }
      else if (tag.startsWith('状态:')) {
        const [, path, name, value = ''] = tag.split(':')
        tokens.push({ type: 'status', path, name, tag: value })
      }
      else if (/^(红字|绿字|青字|粉字|蓝字|玫红字):/.test(tag)) {
        const [name, ...parts] = tag.split(':')
        const colors = { 红字: 'red', 绿字: 'lime', 青字: 'cyan', 粉字: 'pink', 蓝字: 'blue', 玫红字: 'rose' } as const
        tokens.push({ type: 'color', color: colors[name as keyof typeof colors], value: parts.join(':') })
      }
      else if (tag.startsWith('伤害:')) {
        const [, damage, kind] = tag.split(':')
        const damageTypes = { 物理: 'physical', 魔法: 'magical', 特殊: 'special' } as const
        tokens.push({ type: 'damage', damage, damageType: damageTypes[kind as keyof typeof damageTypes] })
      }
      else if (tag === '流血' || tag.startsWith('流血:')) tokens.push({ type: 'buff', buff: 'bleeding', tag: tag.split(':')[1] ?? '' })
      else if (tag.startsWith('持续伤害:')) tokens.push({ type: 'dot', damage: tag.split(':')[1] })
      else if (tag.startsWith('魔法易伤:') || tag.startsWith('物理易伤:')) {
        const [name, value = ''] = tag.split(':', 2)
        tokens.push({ type: 'buff', buff: name === '魔法易伤' ? 'magical-vulnerability' : 'physical-vulnerability', tag: value })
      }
      else {
        const explicit = tag.match(/^(坦克|治疗|输出|近战|远敏|法系|治疗输出|坦克输出):(.+)$/)
        const roleMap = { 坦克: 'tank', 治疗: 'healer', 输出: 'dps', 近战: 'melee', 远敏: 'ranged', 法系: 'magic', 治疗输出: 'healer|dps', 坦克输出: 'tank|dps' } as const
        const role = explicit ? roleMap[explicit[1] as keyof typeof roleMap] : tag === 'MT' || tag === 'ST' || tag === '坦克' ? 'tank' : tag.startsWith('H') || tag === '治疗' ? 'healer' : tag === '全员' ? 'all' : tag === '治疗输出' ? 'healer|dps' : 'dps'
        tokens.push({ type: 'role', role, tag: explicit?.[2] ?? (['坦克', '治疗', '输出', '治疗输出'].includes(tag) ? '' : tag) })
      }
    }
    cursor = index + match[0].length
  }

  if (cursor < source.length) tokens.push({ type: 'text', value: source.slice(cursor) })
  return tokens
}

function readSetting(line: string, key: string): string | undefined {
  const match = line.match(new RegExp(`^${key}[：:]\\s*(.+)$`, 'i'))
  return match?.[1].trim()
}

export function parseStratDsl(source: string): StratDslDocument {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const document: StratDslDocument = { duty: '', base: '00:00.000', nodes: [] }

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1
    const line = lines[index].trim()
    if (!line || line.startsWith('//')) continue

    const duty = readSetting(line, '副本')
    if (duty !== undefined) {
      document.duty = duty
      continue
    }
    const base = readSetting(line, '基准')
    if (base !== undefined) {
      if (!timePattern.test(base)) throw new StratDslError(`基准时间“${base}”格式不正确`, lineNumber)
      document.base = base
      continue
    }

    const separator = line.match(/^分段(?:[（(]([^）)]+)[）)])?[：:]\s*(.*)$/)
    if (separator) {
      document.nodes.push({ type: 'separator', id: separator[1]?.trim(), title: separator[2].trim(), line: lineNumber })
      continue
    }

    if (/^警告[：:]\s*$/.test(line)) {
      const paragraphs: StratDslInline[][] = []
      while (index + 1 < lines.length && /^\s{2,}\S/.test(lines[index + 1])) {
        index++
        paragraphs.push(parseInline(lines[index].trim()))
      }
      if (!paragraphs.length) throw new StratDslError('警告内容不能为空；正文行前请留两个空格', lineNumber)
      document.nodes.push({ type: 'warning', paragraphs, line: lineNumber })
      continue
    }

    const multiSolution = line.match(/^多解法[（(]默认[=＝](.+?)[）)][：:]\s*$/)
    if (multiSolution) {
      const solutions: { id: string; title: string; items: StratDslBlockItem[] }[] = []
      while (index + 1 < lines.length) {
        const header = lines[index + 1].match(/^\s{2}方案[（(](.+?)[）)][：:]\s*$/)
        if (!header) break
        index++
        const fields = header[1].split(/[；;]/).map((field) => field.trim()).filter(Boolean)
        const title = fields.shift() ?? ''
        const options = parseOptions(fields)
        const items: StratDslBlockItem[] = []
        while (index + 1 < lines.length && /^\s{4,}\S/.test(lines[index + 1])) {
          index++
          const content = lines[index].trim()
          const imageGroup = content.match(/^图片组[：:]\s*(.*)$/)
          if (imageGroup) {
            const groupOptions = parseOptions(imageGroup[1].split(/[；;]/).map((field) => field.trim()).filter(Boolean))
            const images: StratDslImageNode[] = []
            while (index + 1 < lines.length && /^\s{6,}图片[：:]/.test(lines[index + 1])) {
              index++
              images.push(parseImage(lines[index].trim(), index + 1))
            }
            if (images.length < 2) throw new StratDslError('多解法中的图片组至少需要两张图片', index + 1)
            items.push({ type: 'image-group', images, width: groupOptions.宽度, line: index + 1 })
          } else if (/^图片[：:]/.test(content)) {
            items.push(parseImage(content, index + 1))
          } else {
            items.push({ type: 'paragraph', content: parseInline(content), line: index + 1 })
          }
        }
        if (!title || !options.id || !items.length) throw new StratDslError('方案需要标题、id 和正文', index + 1)
        solutions.push({ id: options.id, title, items })
      }
      if (solutions.length < 2) throw new StratDslError('多解法至少需要两个方案', lineNumber)
      if (!solutions.some((solution) => solution.title === multiSolution[1].trim())) throw new StratDslError('多解法的默认方案不存在', lineNumber)
      document.nodes.push({ type: 'multi-solution', defaultSolution: multiSolution[1].trim(), solutions, line: lineNumber })
      continue
    }

    const collapse = line.match(/^折叠[（(](.+?)[）)][：:]\s*$/)
    if (collapse) {
      const events: { time: string; content: StratDslInline[]; line: number }[] = []
      while (index + 1 < lines.length && /^\s{2,}事件\s+/.test(lines[index + 1])) {
        index++
        const detail = lines[index].trim().match(/^事件\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)[：:]\s*(.+)$/)
        if (!detail) throw new StratDslError('折叠明细中的事件格式不正确', index + 1)
        events.push({ time: detail[1], content: parseInline(detail[2]), line: index + 1 })
      }
      if (!events.length) throw new StratDslError('折叠区块至少需要一个缩进的事件', lineNumber)
      document.nodes.push({ type: 'collapse', summary: parseInline(collapse[1]), events, line: lineNumber })
      continue
    }

    const animation = line.match(/^动画(?:[（(](.*)[）)])?[：:]\s*$/)
    if (animation) {
      const options = parseOptions((animation[1] ?? '').split(/[；;]/).map((field) => field.trim()).filter(Boolean))
      const interval = Number(options.间隔 ?? '1000')
      if (!Number.isFinite(interval) || interval < 100) throw new StratDslError('动画间隔需要是不小于100的毫秒数', lineNumber)
      const frames: StratDslImageNode[] = []
      while (index + 1 < lines.length && /^\s{2,}图片[：:]/.test(lines[index + 1])) {
        index++
        frames.push(parseImage(lines[index].trim(), index + 1))
      }
      if (frames.length < 2) throw new StratDslError('动画至少需要两张缩进的图片', lineNumber)
      document.nodes.push({ type: 'animation', frames, interval, width: options.宽度, autoplay: options.自动播放 === '是', line: lineNumber })
      continue
    }

    const event = line.match(/^事件\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)[：:]\s*(.+)$/)
    if (event) {
      if (!timePattern.test(event[1])) throw new StratDslError(`事件时间“${event[1]}”格式不正确`, lineNumber)
      document.nodes.push({ type: 'event', time: event[1], content: parseInline(event[2]), line: lineNumber })
      continue
    }

    const cast = line.match(/^读条\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)[：:]\s*(.+)$/)
    if (cast) {
      if (!timePattern.test(cast[1])) throw new StratDslError(`读条时间“${cast[1]}”格式不正确`, lineNumber)
      const fields = cast[2].split(/[；;]/).map((field) => field.trim()).filter(Boolean)
      const ability = fields.shift() ?? ''
      const options = parseOptions(fields)
      if (!ability) throw new StratDslError('读条缺少技能名', lineNumber)
      if (options.时长 && !/^\d+(?:\.\d+)?$/.test(options.时长)) throw new StratDslError('读条时长应为秒数', lineNumber)
      const targetMap = { 全员: 'all', 坦克: 'tank', 治疗: 'healer', 输出: 'dps' } as const
      const target = options.目标 ? targetMap[options.目标 as keyof typeof targetMap] : undefined
      if (options.目标 && !target) throw new StratDslError('读条目标只能是全员、坦克、治疗或输出', lineNumber)
      const damageType = parseDamageType(options.类型, lineNumber, Boolean(options.伤害))
      document.nodes.push({
        type: 'cast', start: cast[1], duration: options.时长, ability, target,
        targetTag: options.目标标签, targetContent: options.目标内容 ? parseInline(options.目标内容) : undefined, damage: options.伤害, damageType,
        badge: options.徽章, badgeVariant: parseBadgeVariant(options.徽章颜色, lineNumber), line: lineNumber,
        extra: options.补充 ? parseInline(options.补充) : undefined,
        badges: options.徽章组 ? parseBadges(options.徽章组, lineNumber) : undefined,
      })
      continue
    }

    const attack = line.match(/^攻击\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)[：:]\s*(.+)$/)
    if (attack) {
      if (!timePattern.test(attack[1])) throw new StratDslError(`攻击时间“${attack[1]}”格式不正确`, lineNumber)
      const fields = attack[2].split(/[；;]/).map((field) => field.trim()).filter(Boolean)
      const name = fields.shift() ?? '攻击'
      const options = parseOptions(fields)
      const damageType = parseDamageType(options.类型, lineNumber, true)
      if (!options.伤害) throw new StratDslError('攻击缺少“伤害=”', lineNumber)
      document.nodes.push({ type: 'attack', time: attack[1], name, damage: options.伤害, damageType, line: lineNumber })
      continue
    }

    if (/^图片[：:]/.test(line)) {
      document.nodes.push(parseImage(line, lineNumber))
      continue
    }

    const preset = line.match(/^预设\s+([a-z0-9-]+)(?:[：:]\s*(.*))?$/i)
    if (preset) {
      const options = parseOptions((preset[2] ?? '').split(/[；;]/).map((field) => field.trim()))
      if (options.开始 && !timePattern.test(options.开始)) throw new StratDslError('预设的“开始=”时间无效', lineNumber)
      document.nodes.push({ type: 'preset', name: preset[1], start: options.开始 ?? document.base, line: lineNumber })
      continue
    }

    const block = line.match(/^(说明|机制|解法)(?:[（(](.+?)[）)])?[：:]\s*(.*)$/)
    if (block) {
      const items: StratDslBlockItem[] = []
      if (block[3].trim()) items.push({ type: 'paragraph', content: parseInline(block[3].trim()), line: lineNumber })
      while (index + 1 < lines.length) {
        const next = lines[index + 1]
        if (/^\s{2,}\S/.test(next)) {
          index++
          const content = next.trim()
          const conditions = content.match(/^条件[：:]\s*(.+)$/)
          if (conditions) {
            const branches: StratDslInline[][] = []
            while (index + 1 < lines.length && /^\s{4,}\S/.test(lines[index + 1])) {
              index++
              branches.push(parseInline(lines[index].trim()))
            }
            if (!branches.length) throw new StratDslError('条件至少需要一行缩进四个空格的分支', index + 1)
            items.push({ type: 'conditions', lead: parseInline(conditions[1]), branches, line: index + 1 })
            continue
          }
          const media = content.match(/^并排图文[：:]\s*(.+)$/)
          if (media) {
            const fields = media[1].split(/[；;]/).map((field) => field.trim()).filter(Boolean)
            const path = fields.shift() ?? ''
            const options = parseOptions(fields)
            const image = parseImage(`图片：${path}${options.标题 ? `；标题=${options.标题}` : ''}${options.替代文字 ? `；替代文字=${options.替代文字}` : ''}`, index + 1)
            const paragraphs: StratDslInline[][] = []
            while (index + 1 < lines.length && /^\s{4,}\S/.test(lines[index + 1])) {
              index++
              paragraphs.push(parseInline(lines[index].trim()))
            }
            if (!paragraphs.length) throw new StratDslError('并排图文至少需要一行缩进四个空格的正文', index + 1)
            items.push({ type: 'media', image, paragraphs, width: options.宽度, border: options.边框, line: index + 1 })
            continue
          }
          const paragraphImage = content.match(/^图文[：:]\s*(.+)$/)
          if (paragraphImage) {
            const following = lines[index + 1]
            if (!following || !/^\s{4,}图片[：:]/.test(following)) throw new StratDslError('图文后需要一行缩进四个空格的图片', index + 1)
            index++
            items.push({ type: 'paragraph-image', content: parseInline(paragraphImage[1]), image: parseImage(lines[index].trim(), index + 1), line: index })
            continue
          }
          const imageGroup = content.match(/^图片组[：:]\s*(.*)$/)
          if (imageGroup) {
            const options = parseOptions(imageGroup[1].split(/[；;]/).map((field) => field.trim()).filter(Boolean))
            const images: StratDslImageNode[] = []
            while (index + 1 < lines.length && /^\s{4,}图片[：:]/.test(lines[index + 1])) {
              index++
              images.push(parseImage(lines[index].trim(), index + 1))
            }
            if (images.length < 2) throw new StratDslError('图片组至少需要两张图片；图片行前请留四个空格', index + 1)
            items.push({ type: 'image-group', images, width: options.宽度, line: index + 1 })
            continue
          }
          if (/^引用[：:]\s*$/.test(content)) {
            const paragraphs: StratDslInline[][] = []
            while (index + 1 < lines.length && /^\s{4,}\S/.test(lines[index + 1])) {
              index++
              paragraphs.push(parseInline(lines[index].trim()))
            }
            if (!paragraphs.length) throw new StratDslError('引用内容不能为空；引用正文行前请留四个空格', index + 1)
            items.push({ type: 'quote', paragraphs, line: index + 1 })
            continue
          }
          items.push(/^图片[：:]/.test(content)
            ? parseImage(content, index + 1)
            : /^小标题[：:]/.test(content)
              ? { type: 'heading', content: parseInline(content.replace(/^小标题[：:]\s*/, '')), line: index + 1 }
            : { type: 'paragraph', content: parseInline(content), line: index + 1 })
        } else break
      }
      if (items.length === 0) throw new StratDslError(`${block[1]}内容不能为空；正文行前请留两个空格`, lineNumber)
      document.nodes.push({
        type: block[1] === '说明' ? 'note' : block[1] === '解法' ? 'solution' : 'mechanic',
        title: block[2]?.trim(),
        items,
        line: lineNumber,
      })
      continue
    }

    throw new StratDslError(`无法识别“${line}”`, lineNumber)
  }

  if (!document.duty) throw new StratDslError('缺少“副本：...”设置', 1)
  return document
}

function parseBadges(value: string, line: number) {
  return value.split('|').map((entry) => {
    const [text, color] = entry.split('@', 2).map((part) => part.trim())
    if (!text) throw new StratDslError('徽章组中存在空徽章', line)
    return { text, variant: parseBadgeVariant(color, line) ?? 'yellow' }
  })
}

function parseBadgeVariant(value: string | undefined, line: number): 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'cyan' | 'blue' | 'purple' | undefined {
  if (!value) return undefined
  const variants = { 红: 'red', 橙: 'orange', 琥珀: 'amber', 黄: 'yellow', 青柠: 'lime', 绿: 'green', 翠绿: 'emerald', 青: 'cyan', 蓝: 'blue', 紫: 'purple' } as const
  const variant = variants[value as keyof typeof variants]
  if (!variant) throw new StratDslError('徽章颜色不受支持', line)
  return variant
}

function parseImage(line: string, lineNumber: number): StratDslImageNode {
  const image = line.match(/^图片[：:]\s*(.+)$/)
  if (!image) throw new StratDslError('图片语法不正确', lineNumber)
  const fields = image[1].split(/[；;]/).map((field) => field.trim()).filter(Boolean)
  const path = fields.shift() ?? ''
  const options = parseOptions(fields)
  if (!/\.(?:png|jpe?g|webp|gif)$/i.test(path)) throw new StratDslError('图片路径需要包含受支持的扩展名', lineNumber)
  return { type: 'image', path, title: options.标题, alt: options.替代文字 ?? options.标题 ?? '', width: options.宽度, line: lineNumber }
}

function parseOptions(fields: string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => {
    const pair = field.split(/[=＝]/, 2)
    return [pair[0]?.trim(), pair[1]?.trim()]
  }))
}

function parseDamageType(value: string | undefined, line: number, required: boolean): 'physical' | 'magical' | 'special' {
  const typeMap = { 物理: 'physical', 魔法: 'magical', 特殊: 'special' } as const
  if (!value && !required) return 'physical'
  const type = typeMap[value as keyof typeof typeMap]
  if (!type) throw new StratDslError('伤害类型只能是物理、魔法或特殊', line)
  return type
}
