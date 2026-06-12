import { useState, useRef, useEffect } from 'react'
import type { BirthDateInput, Gender, UserInput } from '../lib/types'
import type { HeBanRelationType, HeBanUserInput } from '../lib/types'
import Card from '../components/Card'
import { IconSparkle } from '../components/icons'
import { getReadings, getReading, isHeBanInputData, type ReadingListItem } from '../lib/history'
import { supabase } from '../lib/supabase'

// ── 关系类型 ──────────────────────────────────────────────────────
const RELATION_OPTIONS: { key: HeBanRelationType; label: string; icon: string }[] = [
  { key: '情侣', label: '情侣', icon: '💕' },
  { key: '夫妻', label: '夫妻', icon: '💍' },
  { key: '亲子', label: '亲子', icon: '👨‍👩‍👧' },
  { key: '朋友', label: '朋友', icon: '🤝' },
  { key: '事业合伙', label: '事业合伙', icon: '🤜' },
]

// ── 省/市/区 数据（与 Step1Input 保持一致） ───────────────────────
const locationData: Record<string, Record<string, string[]>> = {
  '北京': { '北京市': ['东城区','西城区','朝阳区','丰台区','石景山区','海淀区','顺义区','通州区','大兴区','昌平区','房山区','门头沟区','平谷区','怀柔区','密云区','延庆区'] },
  '上海': { '上海市': ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','浦东新区','闵行区','宝山区','嘉定区','金山区','松江区','青浦区','奉贤区','崇明区'] },
  '天津': { '天津市': ['和平区','河东区','河西区','南开区','河北区','红桥区','滨海新区','东丽区','西青区','津南区','北辰区','武清区','宝坻区','静海区','宁河区','蓟州区'] },
  '重庆': { '重庆市': ['渝中区','大渡口区','江北区','沙坪坝区','九龙坡区','南岸区','北碚区','渝北区','巴南区','万州区','涪陵区','黔江区','长寿区','江津区','合川区','永川区','其他'] },
  '广东': { '广州': ['天河区','越秀区','荔湾区','海珠区','白云区','黄埔区','番禺区','花都区','南沙区','增城区','从化区'], '深圳': ['福田区','罗湖区','盐田区','南山区','宝安区','龙岗区','龙华区','坪山区','光明区','大鹏新区'], '其他': ['其他'] },
  '浙江': { '杭州': ['上城区','拱墅区','西湖区','滨江区','萧山区','余杭区','临平区','钱塘区','富阳区','临安区'], '宁波': ['海曙区','江北区','北仑区','镇海区','鄞州区','奉化区','余姚市','慈溪市'], '其他': ['其他'] },
  '江苏': { '南京': ['玄武区','秦淮区','建邺区','鼓楼区','浦口区','栖霞区','雨花台区','江宁区','六合区','溧水区','高淳区'], '苏州': ['姑苏区','虎丘区','吴中区','相城区','吴江区','常熟市','张家港市','昆山市','太仓市'], '其他': ['其他'] },
  '山东': { '济南': ['历下区','市中区','槐荫区','天桥区','历城区','长清区'], '青岛': ['市南区','市北区','黄岛区','崂山区','李沧区','城阳区'], '其他': ['其他'] },
  '四川': { '成都': ['锦江区','青羊区','金牛区','武侯区','成华区','龙泉驿区','青白江区','新都区','温江区','双流区','郫都区'], '其他': ['其他'] },
  '湖北': { '武汉': ['江岸区','江汉区','硚口区','汉阳区','武昌区','青山区','洪山区','东西湖区','蔡甸区','江夏区','黄陂区','新洲区'], '其他': ['其他'] },
  '湖南': { '长沙': ['芙蓉区','天心区','岳麓区','开福区','雨花区','望城区','长沙县','浏阳市','宁乡市'], '其他': ['其他'] },
  '河南': { '郑州': ['中原区','二七区','管城回族区','金水区','上街区','惠济区','中牟县'], '其他': ['其他'] },
  '陕西': { '西安': ['新城区','碑林区','莲湖区','灞桥区','未央区','雁塔区','阎良区','临潼区','长安区'], '其他': ['其他'] },
  '福建': { '福州': ['鼓楼区','台江区','仓山区','马尾区','晋安区','长乐区'], '厦门': ['思明区','海沧区','湖里区','集美区','同安区','翔安区'], '其他': ['其他'] },
  '香港': { '香港': ['中西区','湾仔区','东区','南区','油尖旺区','深水埗区','九龙城区','黄大仙区','观塘区','荃湾区','屯门区','元朗区','北区','大埔区','西贡区','沙田区','葵青区','离岛区'] },
  '澳门': { '澳门': ['澳门半岛','氹仔','路环','路氹城'] },
  '台湾': { '台北': ['中正区','大同区','中山区','松山区','大安区','万华区','信义区'], '其他': ['其他'] },
}

const countries = ['中国', '美国', '英国', '日本', '韩国', '加拿大', '澳大利亚', '新加坡', '马来西亚', '其他']
const years = Array.from({ length: 120 }, (_, i) => 2025 - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)

function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function isValidDate(birth: BirthDateInput) {
  const { year, month, day } = birth
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  return day >= 1 && day <= new Date(year, month, 0).getDate()
}
function formatBirth(b: BirthDateInput) {
  return `${b.year}年${String(b.month).padStart(2,'0')}月${String(b.day).padStart(2,'0')}日 ${String(b.hour).padStart(2,'0')}:${String(b.minute ?? 0).padStart(2,'0')}`
}
function formatLocation(province: string, city: string, district: string) {
  if (!province) return '省 / 市 / 区（选填）'
  return [province, city, district].filter(Boolean).join(' · ')
}

// ── 通用弹窗容器 ──────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div ref={ref} className="w-full max-w-sm rounded-t-2xl bg-slate-900 p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-100">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── 滚轮列 ────────────────────────────────────────────────────────
function PickerColumn<T extends string | number>({ items, value, onChange, format }: { items: T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemH = 40
  useEffect(() => {
    const idx = items.indexOf(value)
    if (idx >= 0 && listRef.current) listRef.current.scrollTo({ top: idx * itemH, behavior: 'smooth' })
  }, [value, items])
  return (
    <ul ref={listRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ height: itemH * 3, scrollSnapType: 'y mandatory' }}
      onScroll={(e) => { const idx = Math.round(e.currentTarget.scrollTop / itemH); const c = Math.max(0, Math.min(items.length - 1, idx)); if (items[c] !== value) onChange(items[c]) }}>
      <li style={{ height: itemH }} />
      {items.map((item) => (
        <li key={String(item)} style={{ height: itemH, scrollSnapAlign: 'center' }}
          className={['flex cursor-pointer items-center justify-center text-sm transition select-none', item === value ? 'text-amber-300 font-bold text-base' : 'text-slate-300'].join(' ')}
          onClick={() => onChange(item)}>
          {format ? format(item) : String(item).padStart(2, '0')}
        </li>
      ))}
      <li style={{ height: itemH }} />
    </ul>
  )
}

// ── 出生时间弹窗 ──────────────────────────────────────────────────
function BirthTimePicker({ birth, onChange, onClose }: { birth: BirthDateInput; onChange: (b: BirthDateInput) => void; onClose: () => void }) {
  const [local, setLocal] = useState(birth)
  const maxDay = getDaysInMonth(local.year, local.month)
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)
  const update = (patch: Partial<BirthDateInput>) => setLocal(prev => { const next = { ...prev, ...patch }; const md = getDaysInMonth(next.year, next.month); if (next.day > md) next.day = md; return next })
  return (
    <Modal title="选择出生时间" onClose={onClose}>
      <div className="mb-3 flex gap-1 text-center text-xs text-slate-400">
        <div className="flex-1">年</div><div className="flex-1">月</div><div className="flex-1">日</div><div className="flex-1">时</div><div className="flex-1">分</div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-[40px] h-[40px] rounded-lg border-y border-amber-400/30 bg-amber-400/5" />
        <div className="flex gap-1">
          <PickerColumn items={years} value={local.year} onChange={v => update({ year: v })} format={v => String(v)} />
          <PickerColumn items={months} value={local.month} onChange={v => update({ month: v })} />
          <PickerColumn items={days} value={local.day} onChange={v => update({ day: v })} />
          <PickerColumn items={hours} value={local.hour} onChange={v => update({ hour: v })} />
          <PickerColumn items={minutes} value={local.minute ?? 0} onChange={v => update({ minute: v })} />
        </div>
      </div>
      <button onClick={() => { onChange(local); onClose() }} className="mt-4 w-full rounded-xl bg-amber-400/20 border border-amber-400/40 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/30 transition">确认</button>
    </Modal>
  )
}

// ── 出生地点弹窗 ──────────────────────────────────────────────────
function BirthLocationPicker({ province, city, district, onChange, onClose }: { province: string; city: string; district: string; onChange: (p: string, c: string, d: string) => void; onClose: () => void }) {
  const firstProvince = Object.keys(locationData)[0] ?? ''
  const dp = province || firstProvince
  const dc = city || Object.keys(locationData[dp] ?? {})[0] || ''
  const [selProvince, setSelProvince] = useState(dp)
  const [selCity, setSelCity] = useState(dc)
  const [selDistrict, setSelDistrict] = useState(district || locationData[dp]?.[dc]?.[0] || '')
  const provinces = Object.keys(locationData)
  const cities = Object.keys(locationData[selProvince] ?? {})
  const districts = locationData[selProvince]?.[selCity] ?? []
  const onProvinceChange = (p: string) => { setSelProvince(p); const fc = Object.keys(locationData[p] ?? {})[0] ?? ''; setSelCity(fc); setSelDistrict(locationData[p]?.[fc]?.[0] ?? '') }
  const onCityChange = (c: string) => { setSelCity(c); setSelDistrict(locationData[selProvince]?.[c]?.[0] ?? '') }
  return (
    <Modal title="选择出生地点" onClose={onClose}>
      <div className="mb-3 flex gap-1 text-center text-xs text-slate-400">
        <div className="flex-1">省份</div><div className="flex-1">城市</div><div className="flex-1">区县</div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-[40px] h-[40px] rounded-lg border-y border-amber-400/30 bg-amber-400/5" />
        <div className="flex gap-1">
          <PickerColumn items={provinces} value={selProvince} onChange={onProvinceChange} format={v => v} />
          <PickerColumn items={cities} value={selCity} onChange={onCityChange} format={v => v} />
          <PickerColumn items={districts.length ? districts : ['—']} value={selDistrict || districts[0] || '—'} onChange={setSelDistrict} format={v => v} />
        </div>
      </div>
      <button onClick={() => { onChange(selProvince, selCity, selDistrict); onClose() }} className="mt-4 w-full rounded-xl bg-amber-400/20 border border-amber-400/40 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/30 transition">确认</button>
    </Modal>
  )
}

// ── 人员状态类型 ──────────────────────────────────────────────────
type PersonState = {
  name: string
  birth: BirthDateInput
  gender: Gender
  calendarType: '公历' | '农历'
  country: string
  province: string
  city: string
  district: string
}

function defaultPersonState(today: Date, defaultGender: Gender = '男'): PersonState {
  return {
    name: '',
    birth: { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate(), hour: 12, minute: 0 },
    gender: defaultGender,
    calendarType: '公历',
    country: '中国',
    province: '',
    city: '',
    district: '',
  }
}

function personStateToUserInput(p: PersonState): UserInput {
  return {
    name: p.name.trim(),
    birth: p.birth,
    gender: p.gender,
    calendarType: p.calendarType,
    country: p.country,
    province: p.province,
    city: p.city,
    district: p.district || undefined,
    useSolarTime: Boolean(p.province),
    selectedChartSystems: ['八字'],
  }
}

function isPersonValid(p: PersonState): boolean {
  return p.name.trim().length >= 2 && p.name.trim().length <= 20 && isValidDate(p.birth)
}

// ── 历史记录选择弹窗 ──────────────────────────────────────────────
function HistoryPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (item: ReadingListItem) => void
  onClose: () => void
}) {
  const [list, setList] = useState<ReadingListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoggedIn(false)
        setLoading(false)
        return
      }
      setIsLoggedIn(true)
      try {
        const rows = await getReadings()
        setList(rows)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <Modal title="选择历史档案" onClose={onClose}>
      {isLoggedIn === false ? (
        <p className="text-center text-sm text-slate-400 py-4">请先登录后才能使用历史档案功能</p>
      ) : loading ? (
        <p className="text-center text-sm text-slate-400 py-4">加载中…</p>
      ) : error ? (
        <p className="text-center text-sm text-rose-400 py-4">{error}</p>
      ) : !list || list.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-4">暂无历史记录，先去做一次单人测算吧</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {list.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => { onSelect(row); onClose() }}
                className="w-full rounded-xl border border-amber-400/20 bg-white/[0.04] px-4 py-3 text-left transition hover:border-amber-400/40 hover:bg-white/[0.07]"
              >
                <div className="font-medium text-amber-100/95 text-sm">{row.name ?? '未命名'}</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  出生：{row.birth_date ?? '—'}
                  <span className="mx-2">·</span>
                  {row.created_at ? new Date(row.created_at).toLocaleDateString() : '—'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

// ── 单人信息卡片（字段布局与 Step1Input 完全一致） ─────────────────
function PersonCard({
  label,
  index,
  value,
  onChange,
  onSelectFromHistory,
}: {
  label: string
  index: number
  value: PersonState
  onChange: (patch: Partial<PersonState>) => void
  onSelectFromHistory?: () => void
}) {
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  return (
    <>
      {showTimePicker && (
        <BirthTimePicker birth={value.birth} onChange={(b) => onChange({ birth: b })} onClose={() => setShowTimePicker(false)} />
      )}
      {showLocationPicker && value.country === '中国' && (
        <BirthLocationPicker
          province={value.province} city={value.city} district={value.district}
          onChange={(p, c, d) => { onChange({ province: p, city: c, district: d }) }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      <Card
        icon={
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-200">
            {index}
          </span>
        }
        title={label}
        headerRight={
          onSelectFromHistory ? (
            <button
              type="button"
              onClick={onSelectFromHistory}
              className="flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-200/80 transition hover:border-amber-400/50 hover:bg-amber-400/15 hover:text-amber-100"
            >
              <span>📋</span>
              <span>从历史选取</span>
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-3">

          {/* 姓名 + 性别 同行 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs text-slate-300/70">姓名</div>
              <input
                value={value.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="例如：林明"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-200/40 focus:border-amber-400/40"
              />
            </div>
            <div className="shrink-0">
              <div className="mb-1 text-xs text-slate-300/70">性别</div>
              <div className="flex gap-1.5">
                {(['男', '女'] as Gender[]).map((g) => (
                  <button key={g} type="button" onClick={() => onChange({ gender: g })}
                    className={['rounded-xl border px-3.5 py-2 text-sm transition', value.gender === g ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20'].join(' ')}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 历法 + 出生时间 同行 */}
          <div className="flex gap-2">
            <div className="shrink-0">
              <div className="mb-1 text-xs text-slate-300/70">历法</div>
              <div className="flex gap-1.5">
                {(['公历', '农历'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => onChange({ calendarType: t })}
                    className={['rounded-xl border px-2.5 py-2 text-xs transition', value.calendarType === t ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20'].join(' ')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1 text-xs text-slate-300/70">出生时间</div>
              <button
                type="button"
                onClick={() => setShowTimePicker(true)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-100 hover:border-amber-400/30 hover:bg-white/10 transition flex items-center justify-between"
              >
                <span>{formatBirth(value.birth)}</span>
                <span className="ml-1 shrink-0 text-slate-400">▾</span>
              </button>
            </div>
          </div>

          {/* 出生地 */}
          <div>
            <div className="mb-1 text-xs text-slate-300/70">出生地</div>
            <div className="flex gap-2">
              <select
                value={value.country}
                onChange={(e) => onChange({ country: e.target.value })}
                className="w-[5.5rem] shrink-0 rounded-xl border border-white/10 bg-slate-900 px-2 py-2 text-xs text-slate-100 outline-none focus:border-amber-400/40"
              >
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {value.country === '中国' ? (
                <button
                  type="button"
                  onClick={() => setShowLocationPicker(true)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-100 hover:border-amber-400/30 hover:bg-white/10 transition flex items-center justify-between"
                >
                  <span className={value.province ? 'text-slate-100' : 'text-slate-400'}>
                    {value.province ? formatLocation(value.province, value.city, value.district) : '省 / 市 / 区（选填）'}
                  </span>
                  <span className="ml-1 shrink-0 text-slate-400">▾</span>
                </button>
              ) : (
                <input
                  value={value.city}
                  onChange={(e) => onChange({ city: e.target.value })}
                  placeholder="城市名（选填）"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-200/40 focus:border-amber-400/40"
                />
              )}
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400/80">
              填写具体城市后八字将按经度校正时辰；不填则以国家时区排盘。
            </p>
          </div>

        </div>
      </Card>
    </>
  )
}

// ── 将历史 UserInput 转换为 PersonState ──────────────────────────
function userInputToPersonState(input: UserInput): PersonState {
  return {
    name: input.name ?? '',
    birth: {
      year: input.birth.year,
      month: input.birth.month,
      day: input.birth.day,
      hour: input.birth.hour,
      minute: input.birth.minute ?? 0,
    },
    gender: input.gender ?? '男',
    calendarType: input.calendarType ?? '公历',
    country: input.country ?? '中国',
    province: input.province ?? '',
    city: input.city ?? '',
    district: input.district ?? '',
  }
}

// ── 主组件 ────────────────────────────────────────────────────────
export default function HeBanInputPage({
  onNext,
  isSubmitting = false,
  mode = 'heban',
  onSwitchMode,
}: {
  onNext: (data: HeBanUserInput) => void | Promise<void>
  isSubmitting?: boolean
  mode?: 'single' | 'heban'
  onSwitchMode?: (m: 'single' | 'heban') => void
}) {
  const today = new Date()
  const [personA, setPersonA] = useState<PersonState>(() => defaultPersonState(today, '男'))
  const [personB, setPersonB] = useState<PersonState>(() => defaultPersonState(today, '女'))
  const [relation, setRelation] = useState<HeBanRelationType>('情侣')
  // 历史选取弹窗：null=关闭；'A'=正在选甲方；'B'=正在选乙方
  const [historyPickTarget, setHistoryPickTarget] = useState<'A' | 'B' | null>(null)

  const patchA = (patch: Partial<PersonState>) => setPersonA((p) => ({ ...p, ...patch }))
  const patchB = (patch: Partial<PersonState>) => setPersonB((p) => ({ ...p, ...patch }))

  const allOk = isPersonValid(personA) && isPersonValid(personB)

  const handleNext = () => {
    if (!allOk || isSubmitting) return
    void onNext({ personA: personStateToUserInput(personA), personB: personStateToUserInput(personB), relation })
  }

  // 历史记录选中回调：根据 target 填充对应方
  const handleHistorySelect = async (item: ReadingListItem) => {
    try {
      const detail = await getReading(item.id)
      if (!detail.input_data || isHeBanInputData(detail.input_data)) return
      const state = userInputToPersonState(detail.input_data)
      if (historyPickTarget === 'A') setPersonA(state)
      else if (historyPickTarget === 'B') setPersonB(state)
    } catch {
      // 静默失败，用户可手动重填
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-8">
      {/* 标题区 — 与单人测算宽度和风格完全一致 */}
      <div className="mb-6 px-4 py-5 sm:px-6">
        <p className="text-center font-serif text-2xl font-semibold tracking-wide text-amber-200/95 sm:text-3xl">
          深度自我探索工具
        </p>
        <p className="mx-auto mt-2 px-1 text-center text-xs leading-relaxed text-slate-200/70">
          五行能量对照 · 娱乐参考，不构成任何建议
        </p>
        {/* 单人 / 合盘切换 */}
        {onSwitchMode && (
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center gap-0.5 rounded-xl border border-white/10 p-1">
              <button
                type="button"
                onClick={() => onSwitchMode('single')}
                className={[
                  'rounded-lg px-4 py-1.5 text-xs font-medium transition',
                  mode === 'single'
                    ? 'bg-amber-400/20 border border-amber-400/40 text-amber-100'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                ✦ 单人测算
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('heban')}
                className={[
                  'rounded-lg px-4 py-1.5 text-xs font-medium transition',
                  mode === 'heban'
                    ? 'bg-amber-400/20 border border-amber-400/40 text-amber-100'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                ☯ 合盘测算
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4">

        {/* 历史选取弹窗 */}
        {historyPickTarget && (
          <HistoryPickerModal
            onSelect={(item) => { void handleHistorySelect(item) }}
            onClose={() => setHistoryPickTarget(null)}
          />
        )}

        {/* 甲方信息 */}
        <PersonCard
          label="甲方信息"
          index={1}
          value={personA}
          onChange={patchA}
          onSelectFromHistory={() => setHistoryPickTarget('A')}
        />

        {/* 关系类型 */}
        <Card icon={<IconSparkle className="h-6 w-6" />} title="两人关系">
          <div className="flex flex-wrap gap-2">
            {RELATION_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRelation(opt.key)}
                className={[
                  'flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-sm transition',
                  relation === opt.key
                    ? 'border-amber-400/60 bg-amber-400/20 text-amber-100 font-medium'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-white/20',
                ].join(' ')}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* 乙方信息 */}
        <PersonCard
          label="乙方信息"
          index={2}
          value={personB}
          onChange={patchB}
          onSelectFromHistory={() => setHistoryPickTarget('B')}
        />

        {/* 校验提示 */}
        {!allOk && (personA.name.length > 0 || personB.name.length > 0) && (
          <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-100">
            请检查：双方姓名须 2–20 字，出生日期须完整有效。
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-200/50">输入仅本地计算，不上传。</div>
          <button
            type="button"
            onClick={handleNext}
            disabled={!allOk || isSubmitting}
            className={[
              'rounded-xl border px-5 py-2.5 text-sm font-semibold transition',
              allOk && !isSubmitting
                ? 'border-amber-400/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20'
                : 'border-white/10 bg-white/5 text-slate-200/50 cursor-not-allowed',
            ].join(' ')}
          >
            {isSubmitting ? '正在准备测算…' : '开始合盘测算'}
          </button>
        </div>
      </div>
    </div>
  )
}
