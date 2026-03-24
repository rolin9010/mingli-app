// 城市经纬度数据（经度用于真太阳时校正）
// 真太阳时校正公式: 偏差分钟 = (城市经度 - 标准时区经度) * 4
// 中国标准时区经度: 120°E (UTC+8)

export type GeoInfo = { lon: number; lat: number; tz: number }

const cityGeo: Record<string, GeoInfo> = {
// 直辖市
'北京市': { lon: 116.4, lat: 39.9, tz: 8 },
'上海市': { lon: 121.5, lat: 31.2, tz: 8 },
'天津市': { lon: 117.2, lat: 39.1, tz: 8 },
'重庆市': { lon: 106.5, lat: 29.6, tz: 8 },
// 广东
'广州': { lon: 113.3, lat: 23.1, tz: 8 },
'深圳': { lon: 114.1, lat: 22.5, tz: 8 },
'佛山': { lon: 113.1, lat: 23.0, tz: 8 },
'东莞': { lon: 113.7, lat: 23.0, tz: 8 },
'珠海': { lon: 113.6, lat: 22.3, tz: 8 },
'汕头': { lon: 116.7, lat: 23.4, tz: 8 },
'惠州': { lon: 114.4, lat: 23.1, tz: 8 },
'中山': { lon: 113.4, lat: 22.5, tz: 8 },
// 浙江
'杭州': { lon: 120.2, lat: 30.3, tz: 8 },
'宁波': { lon: 121.6, lat: 29.9, tz: 8 },
'温州': { lon: 120.7, lat: 28.0, tz: 8 },
'嘉兴': { lon: 120.8, lat: 30.7, tz: 8 },
'绍兴': { lon: 120.6, lat: 30.0, tz: 8 },
'金华': { lon: 119.6, lat: 29.1, tz: 8 },
'台州': { lon: 121.4, lat: 28.7, tz: 8 },
// 江苏
'南京': { lon: 118.8, lat: 32.1, tz: 8 },
'苏州': { lon: 120.6, lat: 31.3, tz: 8 },
'无锡': { lon: 120.3, lat: 31.6, tz: 8 },
'常州': { lon: 119.9, lat: 31.8, tz: 8 },
'南通': { lon: 120.9, lat: 32.0, tz: 8 },
'扬州': { lon: 119.4, lat: 32.4, tz: 8 },
'徐州': { lon: 117.2, lat: 34.3, tz: 8 },
// 山东
'济南': { lon: 117.0, lat: 36.7, tz: 8 },
'青岛': { lon: 120.4, lat: 36.1, tz: 8 },
'烟台': { lon: 121.4, lat: 37.5, tz: 8 },
'潍坊': { lon: 119.1, lat: 36.7, tz: 8 },
'临沂': { lon: 118.4, lat: 35.1, tz: 8 },
'淄博': { lon: 118.1, lat: 36.8, tz: 8 },
// 四川
'成都': { lon: 104.1, lat: 30.7, tz: 8 },
'绵阳': { lon: 104.7, lat: 31.5, tz: 8 },
'德阳': { lon: 104.4, lat: 31.1, tz: 8 },
'南充': { lon: 106.1, lat: 30.8, tz: 8 },
'宜宾': { lon: 104.6, lat: 28.8, tz: 8 },
// 湖北
'武汉': { lon: 114.3, lat: 30.6, tz: 8 },
'宜昌': { lon: 111.3, lat: 30.7, tz: 8 },
'襄阳': { lon: 112.1, lat: 32.0, tz: 8 },
'荆州': { lon: 112.2, lat: 30.3, tz: 8 },
// 湖南
'长沙': { lon: 113.0, lat: 28.2, tz: 8 },
'株洲': { lon: 113.1, lat: 27.8, tz: 8 },
'衡阳': { lon: 112.6, lat: 26.9, tz: 8 },
'岳阳': { lon: 113.1, lat: 29.4, tz: 8 },
'常德': { lon: 111.7, lat: 29.0, tz: 8 },
// 河南
'郑州': { lon: 113.6, lat: 34.8, tz: 8 },
'洛阳': { lon: 112.5, lat: 34.7, tz: 8 },
'开封': { lon: 114.3, lat: 34.8, tz: 8 },
'南阳': { lon: 112.5, lat: 33.0, tz: 8 },
// 河北
'石家庄': { lon: 114.5, lat: 38.0, tz: 8 },
'唐山': { lon: 118.2, lat: 39.6, tz: 8 },
'保定': { lon: 115.5, lat: 38.9, tz: 8 },
'邯郸': { lon: 114.5, lat: 36.6, tz: 8 },
// 陕西
'西安': { lon: 108.9, lat: 34.3, tz: 8 },
'咸阳': { lon: 108.7, lat: 34.3, tz: 8 },
'宝鸡': { lon: 107.1, lat: 34.4, tz: 8 },
'渭南': { lon: 109.5, lat: 34.5, tz: 8 },
// 福建
'福州': { lon: 119.3, lat: 26.1, tz: 8 },
'厦门': { lon: 118.1, lat: 24.5, tz: 8 },
'泉州': { lon: 118.6, lat: 24.9, tz: 8 },
'漳州': { lon: 117.6, lat: 24.5, tz: 8 },
// 安徽
'合肥': { lon: 117.3, lat: 31.8, tz: 8 },
'芜湖': { lon: 118.4, lat: 31.3, tz: 8 },
'蚌埠': { lon: 117.4, lat: 32.9, tz: 8 },
'安庆': { lon: 117.1, lat: 30.5, tz: 8 },
// 辽宁
'沈阳': { lon: 123.4, lat: 41.8, tz: 8 },
'大连': { lon: 121.6, lat: 38.9, tz: 8 },
'鞍山': { lon: 123.0, lat: 41.1, tz: 8 },
'抚顺': { lon: 123.9, lat: 41.9, tz: 8 },
// 黑龙江
'哈尔滨': { lon: 126.6, lat: 45.8, tz: 8 },
'齐齐哈尔': { lon: 123.9, lat: 47.4, tz: 8 },
'大庆': { lon: 125.0, lat: 46.6, tz: 8 },
'牡丹江': { lon: 129.6, lat: 44.6, tz: 8 },
// 吉林
'长春': { lon: 125.3, lat: 43.9, tz: 8 },
'吉林': { lon: 126.6, lat: 43.8, tz: 8 },
'四平': { lon: 124.4, lat: 43.2, tz: 8 },
// 云南
'昆明': { lon: 102.7, lat: 25.0, tz: 8 },
'大理': { lon: 100.2, lat: 25.6, tz: 8 },
'丽江': { lon: 100.2, lat: 26.9, tz: 8 },
'曲靖': { lon: 103.8, lat: 25.5, tz: 8 },
// 贵州
'贵阳': { lon: 106.7, lat: 26.6, tz: 8 },
'遵义': { lon: 106.9, lat: 27.7, tz: 8 },
'安顺': { lon: 105.9, lat: 26.2, tz: 8 },
// 广西
'南宁': { lon: 108.3, lat: 22.8, tz: 8 },
'桂林': { lon: 110.3, lat: 25.3, tz: 8 },
'柳州': { lon: 109.4, lat: 24.3, tz: 8 },
'梧州': { lon: 111.3, lat: 23.5, tz: 8 },
// 江西
'南昌': { lon: 115.9, lat: 28.7, tz: 8 },
'赣州': { lon: 114.9, lat: 25.8, tz: 8 },
'九江': { lon: 115.9, lat: 29.7, tz: 8 },
// 山西
'太原': { lon: 112.6, lat: 37.9, tz: 8 },
'大同': { lon: 113.3, lat: 40.1, tz: 8 },
'临汾': { lon: 111.5, lat: 36.1, tz: 8 },
'运城': { lon: 111.0, lat: 35.0, tz: 8 },
// 内蒙古
'呼和浩特': { lon: 111.7, lat: 40.8, tz: 8 },
'包头': { lon: 110.0, lat: 40.7, tz: 8 },
'鄂尔多斯': { lon: 109.8, lat: 39.6, tz: 8 },
// 新疆
'乌鲁木齐': { lon: 87.6, lat: 43.8, tz: 8 },
'喀什': { lon: 75.9, lat: 39.5, tz: 8 },
'克拉玛依': { lon: 84.9, lat: 45.6, tz: 8 },
// 西藏
'拉萨': { lon: 91.1, lat: 29.7, tz: 8 },
'日喀则': { lon: 88.9, lat: 29.3, tz: 8 },
'林芝': { lon: 94.4, lat: 29.6, tz: 8 },
// 青海
'西宁': { lon: 101.8, lat: 36.6, tz: 8 },
'海东': { lon: 102.4, lat: 36.5, tz: 8 },
// 甘肃
'兰州': { lon: 103.8, lat: 36.1, tz: 8 },
'天水': { lon: 105.7, lat: 34.6, tz: 8 },
'张掖': { lon: 100.4, lat: 39.0, tz: 8 },
// 宁夏
'银川': { lon: 106.3, lat: 38.5, tz: 8 },
'石嘴山': { lon: 106.4, lat: 39.0, tz: 8 },
'吴忠': { lon: 106.2, lat: 37.9, tz: 8 },
// 海南
'海口': { lon: 110.3, lat: 20.0, tz: 8 },
'三亚': { lon: 109.5, lat: 18.3, tz: 8 },
// 港澳台
'香港': { lon: 114.2, lat: 22.3, tz: 8 },
'澳门': { lon: 113.5, lat: 22.2, tz: 8 },
'台北': { lon: 121.5, lat: 25.0, tz: 8 },
'高雄': { lon: 120.3, lat: 22.6, tz: 8 },
'台中': { lon: 120.7, lat: 24.2, tz: 8 },
'台南': { lon: 120.2, lat: 23.0, tz: 8 },
}

const countryGeo: Record<string, GeoInfo> = {
'美国': { lon: -98.6, lat: 39.5, tz: -5 },
'英国': { lon: -0.1, lat: 51.5, tz: 0 },
'日本': { lon: 139.7, lat: 35.7, tz: 9 },
'韩国': { lon: 126.9, lat: 37.5, tz: 9 },
'加拿大': { lon: -75.7, lat: 45.4, tz: -5 },
'澳大利亚': { lon: 151.2, lat: -33.9, tz: 10 },
'新加坡': { lon: 103.8, lat: 1.4, tz: 8 },
'马来西亚': { lon: 101.7, lat: 3.1, tz: 8 },
}

/** 根据城市/国家查经纬度，找不到返回 null */
export function lookupGeo(country?: string, city?: string): GeoInfo | null {
  const c = city?.trim()
  if (c && cityGeo[c]) return cityGeo[c]
  const co = country?.trim()
  if (co && countryGeo[co]) return countryGeo[co]
  return null
}

/**
 * 真太阳时专用：只用「城市表」里的精确经纬度，避免用国家中心误校正（如美国任意城市却用本土中心经度）
 */
export function lookupGeoForTrueSolar(city?: string): GeoInfo | null {
  const c = city?.trim()
  if (!c) return null
  return cityGeo[c] ?? null
}

/**
 * 是否已「明确选择/填写」出生地（满足后才自动启用真太阳时经度修正）
 * - 中国：省、市、区都非空
 * - 非中国：城市名非空（用于粗略定位；找不到经纬度则仍不做修正）
 */
export function hasBirthLocationForTrueSolar(input: {
  country?: string
  province?: string
  city?: string
  district?: string
}): boolean {
  const country = input.country?.trim() ?? ''
  if (!country) return false
  if (country === '中国') {
    return Boolean(input.province?.trim() && input.city?.trim() && input.district?.trim())
  }
  return Boolean(input.city?.trim())
}

/** @deprecated 请使用 lookupGeo；不再默认北京，避免「未选地」也被悄悄校正 */
export function getGeo(country?: string, city?: string): GeoInfo {
  return lookupGeo(country, city) ?? cityGeo['北京市']
}

/**
* 真太阳时校正
* @param hour 当地标准时间小时
* @param minute 分钟
* @param lon 出生地经度
* @param tz 当地时区（如 8 = UTC+8）
* @returns 校正后的 { hour, minute }
*/
export function toSolarTime(hour: number, minute: number, lon: number, tz: number): { hour: number; minute: number } {
const stdLon = tz * 15
const diffMin = (lon - stdLon) * 4
let totalMin = hour * 60 + minute + diffMin
// 处理跨天
totalMin = ((totalMin % 1440) + 1440) % 1440
return { hour: Math.floor(totalMin / 60), minute: Math.round(totalMin % 60) }
}
