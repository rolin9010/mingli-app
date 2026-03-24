import { useMemo, useState, useRef, useEffect } from 'react'
import type { BirthDateInput, BloodType, Gender, MBTI, UserInput } from '../lib/types'
import { hasBirthLocationForTrueSolar } from '../lib/geo'
import Card from '../components/Card'
import FormField from '../components/FormField'
import { IconBookOpen, IconCompass, IconMoonStars, IconSparkle, IconSun, IconUserBust } from '../components/icons'

/**
 * 可选排盘体系；与 Step2 `switch (sysKey)` 对齐。
 * 说明：界面「西洋占星」对应内部 key `太阳星座`（西洋本命星盘卡片）。
 */
const CHART_SYSTEMS = [
  { key: '八字', label: '四柱八字', defaultSelected: true },
  { key: '紫微', label: '紫微斗数', defaultSelected: true },
  { key: 'MBTI', label: 'MBTI', defaultSelected: false },
  { key: '人类图', label: '人类图', defaultSelected: true },
  { key: '太阳星座', label: '西洋占星', defaultSelected: false },
  { key: '生命灵数', label: '生命灵数', defaultSelected: false },
  { key: '塔罗', label: '塔罗', defaultSelected: false },
  { key: '血型', label: '血型', defaultSelected: false },
] as const

const ALL_CHART_SYSTEM_KEYS: string[] = CHART_SYSTEMS.map((s) => s.key)

function getDefaultSelectedChartSystems(): string[] {
  return CHART_SYSTEMS.filter((s) => s.defaultSelected).map((s) => s.key)
}

const LAST_INPUT_STORAGE_KEY = 'mingli_last_input'

const genderOptions: Gender[] = ['男', '女']
const bloodOptions: BloodType[] = ['A', 'B', 'O', 'AB']
const mbtiOptions: MBTI[] = ['INTJ','INFJ','ISTJ','ISFJ','INFP','INTP','ENTJ','ENFJ','ENTP','ENFP','ISTP','ISFP','ESTP','ESFP','ESTJ','ESFJ']

const countries = ['中国', '美国', '英国', '日本', '韩国', '加拿大', '澳大利亚', '新加坡', '马来西亚', '其他']

// ── 省/市/区 数据（精简版，含主要城市和区县） ──────────────────────
const locationData: Record<string, Record<string, string[]>> = {
  '北京': { '北京市': ['东城区','西城区','朝阳区','丰台区','石景山区','海淀区','顺义区','通州区','大兴区','昌平区','房山区','门头沟区','平谷区','怀柔区','密云区','延庆区'] },
  '上海': { '上海市': ['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','浦东新区','闵行区','宝山区','嘉定区','金山区','松江区','青浦区','奉贤区','崇明区'] },
  '天津': { '天津市': ['和平区','河东区','河西区','南开区','河北区','红桥区','滨海新区','东丽区','西青区','津南区','北辰区','武清区','宝坻区','静海区','宁河区','蓟州区'] },
  '重庆': { '重庆市': ['渝中区','大渡口区','江北区','沙坪坝区','九龙坡区','南岸区','北碚区','渝北区','巴南区','万州区','涪陵区','黔江区','长寿区','江津区','合川区','永川区','其他'] },
  '广东': {
    '广州': ['天河区','越秀区','荔湾区','海珠区','白云区','黄埔区','番禺区','花都区','南沙区','增城区','从化区'],
    '深圳': ['福田区','罗湖区','盐田区','南山区','宝安区','龙岗区','龙华区','坪山区','光明区','大鹏新区'],
    '佛山': ['禅城区','南海区','顺德区','三水区','高明区'],
    '东莞': ['莞城区','南城区','万江区','石碣镇','其他'],
    '珠海': ['香洲区','斗门区','金湾区'],
    '汕头': ['金平区','龙湖区','濠江区','潮阳区','潮南区','澄海区','南澳县'],
    '惠州': ['惠城区','惠阳区','博罗县','惠东县','龙门县'],
    '中山': ['石岐街道','东区街道','西区街道','南区街道','其他'],
    '其他': ['其他'],
  },
  '浙江': {
    '杭州': ['上城区','拱墅区','西湖区','滨江区','萧山区','余杭区','临平区','钱塘区','富阳区','临安区','桐庐县','淳安县','建德市'],
    '宁波': ['海曙区','江北区','北仑区','镇海区','鄞州区','奉化区','余姚市','慈溪市','象山县','宁海县'],
    '温州': ['鹿城区','龙湾区','瓯海区','洞头区','瑞安市','乐清市','其他'],
    '嘉兴': ['南湖区','秀洲区','嘉善县','海盐县','海宁市','桐乡市','平湖市'],
    '绍兴': ['越城区','柯桥区','上虞区','诸暨市','嵊州市','新昌县'],
    '金华': ['婺城区','金东区','武义县','浦江县','义乌市','东阳市','永康市','兰溪市','其他'],
    '台州': ['椒江区','黄岩区','路桥区','三门县','天台县','温岭市','临海市','玉环市','其他'],
    '其他': ['其他'],
  },
  '江苏': {
    '南京': ['玄武区','秦淮区','建邺区','鼓楼区','浦口区','栖霞区','雨花台区','江宁区','六合区','溧水区','高淳区'],
    '苏州': ['姑苏区','虎丘区','吴中区','相城区','吴江区','常熟市','张家港市','昆山市','太仓市'],
    '无锡': ['梁溪区','锡山区','惠山区','滨湖区','新吴区','江阴市','宜兴市'],
    '常州': ['天宁区','钟楼区','新北区','武进区','金坛区','溧阳市'],
    '南通': ['崇川区','海门区','通州区','启东市','如皋市','海安市','如东县'],
    '扬州': ['广陵区','邗江区','江都区','宝应县','仪征市','高邮市'],
    '徐州': ['鼓楼区','云龙区','贾汪区','泉山区','铜山区','丰县','沛县','睢宁县','邳州市','新沂市'],
    '其他': ['其他'],
  },
  '山东': {
    '济南': ['历下区','市中区','槐荫区','天桥区','历城区','长清区','章丘区','济阳区','莱芜区','钢城区','平阴县','商河县'],
    '青岛': ['市南区','市北区','黄岛区','崂山区','李沧区','城阳区','即墨区','胶州市','平度市','莱西市'],
    '烟台': ['芝罘区','福山区','莱山区','牟平区','龙口市','莱阳市','莱州市','蓬莱区','招远市','栖霞市','海阳市'],
    '潍坊': ['潍城区','寒亭区','坊子区','奎文区','青州市','诸城市','寿光市','安丘市','高密市','昌邑市','临朐县','昌乐县'],
    '临沂': ['兰山区','罗庄区','河东区','沂南县','郯城县','沂水县','兰陵县','费县','平邑县','莒南县','蒙阴县','临沭县'],
    '淄博': ['张店区','淄川区','博山区','临淄区','周村区','桓台县','高青县','沂源县'],
    '其他': ['其他'],
  },
  '四川': {
    '成都': ['锦江区','青羊区','金牛区','武侯区','成华区','龙泉驿区','青白江区','新都区','温江区','双流区','郫都区','新津区','金堂县','大邑县','蒲江县','都江堰市','彭州市','邛崃市','崇州市','简阳市'],
    '绵阳': ['涪城区','游仙区','安州区','三台县','盐亭县','梓潼县','北川县','平武县','江油市'],
    '德阳': ['旌阳区','罗江区','中江县','广汉市','什邡市','绵竹市'],
    '南充': ['顺庆区','高坪区','嘉陵区','南部县','营山县','蓬安县','仪陇县','西充县','阆中市'],
    '宜宾': ['翠屏区','南溪区','叙州区','江安县','长宁县','高县','珙县','筠连县','兴文县','屏山县'],
    '其他': ['其他'],
  },
  '湖北': {
    '武汉': ['江岸区','江汉区','硚口区','汉阳区','武昌区','青山区','洪山区','东西湖区','蔡甸区','江夏区','黄陂区','新洲区'],
    '宜昌': ['西陵区','伍家岗区','点军区','猇亭区','夷陵区','远安县','兴山县','秭归县','长阳县','五峰县','宜都市','当阳市','枝江市'],
    '襄阳': ['襄城区','樊城区','襄州区','南漳县','谷城县','保康县','老河口市','枣阳市','宜城市'],
    '荆州': ['沙市区','荆州区','公安县','监利市','江陵县','石首市','洪湖市','松滋市'],
    '其他': ['其他'],
  },
  '湖南': {
    '长沙': ['芙蓉区','天心区','岳麓区','开福区','雨花区','望城区','长沙县','浏阳市','宁乡市'],
    '株洲': ['荷塘区','芦淞区','石峰区','天元区','渌口区','攸县','茶陵县','炎陵县','醴陵市'],
    '衡阳': ['珠晖区','雁峰区','石鼓区','蒸湘区','南岳区','衡阳县','衡南县','衡山县','衡东县','祁东县','耒阳市','常宁市'],
    '岳阳': ['岳阳楼区','云溪区','君山区','岳阳县','华容县','湘阴县','平江县','汨罗市','临湘市'],
    '常德': ['武陵区','鼎城区','安乡县','汉寿县','澧县','临澧县','桃源县','石门县','津市市'],
    '其他': ['其他'],
  },
  '河南': {
    '郑州': ['中原区','二七区','管城回族区','金水区','上街区','惠济区','中牟县','巩义市','荥阳市','新密市','新郑市','登封市'],
    '洛阳': ['老城区','西工区','瀍河回族区','涧西区','洛龙区','孟津区','新安县','栾川县','嵩县','汝阳县','宜阳县','洛宁县','伊川县','偃师区','汝州市'],
    '开封': ['鼓楼区','龙亭区','顺河回族区','禹王台区','祥符区','杞县','通许县','尉氏县','兰考县'],
    '南阳': ['宛城区','卧龙区','南召县','方城县','西峡县','镇平县','内乡县','淅川县','社旗县','唐河县','新野县','桐柏县','邓州市'],
    '其他': ['其他'],
  },
  '河北': {
    '石家庄': ['长安区','桥西区','新华区','裕华区','藁城区','鹿泉区','栾城区','井陉县','正定县','行唐县','灵寿县','高邑县','赞皇县','无极县','平山县','元氏县','赵县','辛集市','晋州市','新乐市'],
    '唐山': ['路南区','路北区','古冶区','开平区','丰南区','丰润区','曹妃甸区','滦州市','迁安市','遵化市','迁西县','玉田县','滦南县','乐亭县'],
    '保定': ['竞秀区','莲池区','满城区','清苑区','徐水区','涞水县','阜平县','定兴县','唐县','高阳县','容城县','易县','曲阳县','蠡县','顺平县','博野县','雄县','涿州市','定州市','安国市','高碑店市'],
    '邯郸': ['邯山区','丛台区','复兴区','峰峰矿区','肥乡区','永年区','临漳县','成安县','大名县','涉县','磁县','邱县','鸡泽县','广平县','馆陶县','魏县','曲周县','武安市'],
    '其他': ['其他'],
  },
  '陕西': {
    '西安': ['新城区','碑林区','莲湖区','灞桥区','未央区','雁塔区','阎良区','临潼区','长安区','高陵区','鄠邑区','蓝田县','周至县'],
    '咸阳': ['秦都区','渭城区','兴平市','三原县','泾阳县','乾县','礼泉县','永寿县','彬州市','长武县','旬邑县','淳化县'],
    '宝鸡': ['渭滨区','金台区','陈仓区','凤翔区','岐山县','扶风县','眉县','陇县','千阳县','麟游县','凤县','太白县'],
    '渭南': ['临渭区','华州区','潼关县','大荔县','合阳县','澄城县','蒲城县','白水县','富平县','韩城市','华阴市'],
    '其他': ['其他'],
  },
  '福建': {
    '福州': ['鼓楼区','台江区','仓山区','马尾区','晋安区','长乐区','闽侯县','连江县','罗源县','闽清县','永泰县','平潭县','福清市'],
    '厦门': ['思明区','海沧区','湖里区','集美区','同安区','翔安区'],
    '泉州': ['鲤城区','丰泽区','洛江区','泉港区','惠安县','安溪县','永春县','德化县','石狮市','晋江市','南安市'],
    '漳州': ['芗城区','龙文区','龙海区','云霄县','漳浦县','诏安县','长泰区','东山县','南靖县','平和县','华安县'],
    '其他': ['其他'],
  },
  '安徽': {
    '合肥': ['庐阳区','瑶海区','蜀山区','包河区','长丰县','肥东县','肥西县','庐江县','巢湖市'],
    '芜湖': ['镜湖区','弋江区','鸠江区','湾沚区','繁昌区','南陵县','无为市'],
    '蚌埠': ['龙子湖区','蚌山区','禹会区','淮上区','怀远县','五河县','固镇县'],
    '安庆': ['迎江区','大观区','宜秀区','怀宁县','太湖县','宿松县','望江县','岳西县','桐城市','潜山市'],
    '其他': ['其他'],
  },
  '辽宁': {
    '沈阳': ['和平区','沈河区','大东区','皇姑区','铁西区','苏家屯区','浑南区','沈北新区','于洪区','辽中区','康平县','法库县','新民市'],
    '大连': ['中山区','西岗区','沙河口区','甘井子区','旅顺口区','金州区','普兰店区','长海县','瓦房店市','庄河市'],
    '鞍山': ['铁东区','铁西区','立山区','千山区','台安县','岫岩满族自治县','海城市'],
    '抚顺': ['新抚区','东洲区','望花区','顺城区','抚顺县','新宾满族自治县','清原满族自治县'],
    '其他': ['其他'],
  },
  '黑龙江': {
    '哈尔滨': ['道里区','道外区','南岗区','香坊区','平房区','松北区','呼兰区','阿城区','双城区','依兰县','方正县','宾县','巴彦县','木兰县','通河县','延寿县','尚志市','五常市'],
    '齐齐哈尔': ['建华区','龙沙区','铁锋区','昂昂溪区','富拉尔基区','碾子山区','梅里斯达斡尔族区','龙江县','依安县','泰来县','甘南县','富裕县','克山县','克东县','拜泉县','讷河市'],
    '大庆': ['萨尔图区','龙凤区','让胡路区','红岗区','大同区','肇州县','肇源县','林甸县','杜尔伯特蒙古族自治县'],
    '牡丹江': ['东安区','西安区','爱民区','阳明区','林口县','穆棱市','绥芬河市','宁安市','海林市','东宁市'],
    '其他': ['其他'],
  },
  '吉林': {
    '长春': ['南关区','宽城区','朝阳区','二道区','绿园区','双阳区','九台区','农安县','榆树市','德惠市'],
    '吉林市': ['昌邑区','龙潭区','船营区','丰满区','永吉县','磐石市','蛟河市','桦甸市','舒兰市'],
    '四平': ['铁西区','铁东区','梨树县','伊通满族自治县','公主岭市','双辽市'],
    '其他': ['其他'],
  },
  '云南': {
    '昆明': ['五华区','盘龙区','官渡区','西山区','东川区','呈贡区','晋宁区','富民县','宜良县','石林彝族自治县','嵩明县','安宁市'],
    '大理': ['大理市','漾濞彝族自治县','祥云县','宾川县','弥渡县','南涧彝族自治县','巍山彝族回族自治县','永平县','云龙县','洱源县','剑川县','鹤庆县'],
    '丽江': ['古城区','玉龙纳西族自治县','永胜县','华坪县','宁蒗彝族自治县'],
    '曲靖': ['麒麟区','沾益区','马龙区','陆良县','师宗县','罗平县','富源县','会泽县','宣威市'],
    '其他': ['其他'],
  },
  '贵州': {
    '贵阳': ['南明区','云岩区','花溪区','乌当区','白云区','观山湖区','开阳县','息烽县','修文县','清镇市'],
    '遵义': ['红花岗区','汇川区','播州区','桐梓县','绥阳县','正安县','务川仡佬族苗族自治县','凤冈县','湄潭县','余庆县','习水县','赤水市','仁怀市'],
    '安顺': ['西秀区','平坝区','普定县','镇宁布依族苗族自治县','关岭布依族苗族自治县','紫云苗族布依族自治县'],
    '其他': ['其他'],
  },
  '广西': {
    '南宁': ['兴宁区','青秀区','江南区','西乡塘区','良庆区','邕宁区','武鸣区','隆安县','马山县','上林县','宾阳县','横州市'],
    '桂林': ['秀峰区','叠彩区','象山区','七星区','雁山区','临桂区','阳朔县','灵川县','全州县','灌阳县','龙胜各族自治县','资源县','平乐县','恭城瑶族自治县','荔浦市'],
    '柳州': ['城中区','鱼峰区','柳南区','柳北区','柳江区','柳城县','鹿寨县','融安县','融水苗族自治县','三江侗族自治县'],
    '梧州': ['万秀区','长洲区','龙圩区','苍梧县','藤县','蒙山县','岑溪市'],
    '其他': ['其他'],
  },
  '江西': {
    '南昌': ['东湖区','西湖区','青云谱区','青山湖区','新建区','红谷滩区','南昌县','安义县','进贤县'],
    '赣州': ['章贡区','南康区','赣县区','信丰县','大余县','上犹县','崇义县','安远县','龙南市','定南县','全南县','宁都县','于都县','兴国县','会昌县','寻乌县','石城县','瑞金市'],
    '九江': ['浔阳区','柴桑区','武宁县','修水县','永修县','德安县','庐山市','都昌县','湖口县','彭泽县','瑞昌市','共青城市'],
    '其他': ['其他'],
  },
  '山西': {
    '太原': ['小店区','迎泽区','杏花岭区','尖草坪区','万柏林区','晋源区','清徐县','阳曲县','娄烦县','古交市'],
    '大同': ['平城区','云冈区','云州区','阳高县','天镇县','广灵县','灵丘县','浑源县','左云县'],
    '临汾': ['尧都区','曲沃县','翼城县','襄汾县','洪洞县','古县','安泽县','浮山县','吉县','乡宁县','大宁县','隰县','永和县','蒲县','汾西县','侯马市','霍州市'],
    '运城': ['盐湖区','临猗县','万荣县','闻喜县','稷山县','新绛县','绛县','垣曲县','夏县','平陆县','芮城县','永济市','河津市'],
    '其他': ['其他'],
  },
  '内蒙古': {
    '呼和浩特': ['回民区','玉泉区','新城区','赛罕区','土默特左旗','托克托县','和林格尔县','清水河县','武川县'],
    '包头': ['东河区','昆都仑区','青山区','石拐区','白云鄂博矿区','九原区','土默特右旗','固阳县','达尔罕茂明安联合旗'],
    '鄂尔多斯': ['东胜区','康巴什区','达拉特旗','准格尔旗','鄂托克前旗','鄂托克旗','杭锦旗','乌审旗','伊金霍洛旗'],
    '其他': ['其他'],
  },
  '新疆': {
    '乌鲁木齐': ['天山区','沙依巴克区','新市区','水磨沟区','头屯河区','达坂城区','米东区','乌鲁木齐县'],
    '喀什': ['喀什市','疏附县','疏勒县','英吉沙县','泽普县','莎车县','叶城县','麦盖提县','岳普湖县','伽师县','巴楚县','塔什库尔干塔吉克自治县'],
    '克拉玛依': ['独山子区','克拉玛依区','白碱滩区','乌尔禾区'],
    '其他': ['其他'],
  },
  '西藏': {
    '拉萨': ['城关区','堆龙德庆区','达孜区','林周县','当雄县','尼木县','曲水县','墨竹工卡县'],
    '日喀则': ['桑珠孜区','南木林县','江孜县','定日县','萨迦县','拉孜县','昂仁县','谢通门县','白朗县','仁布县','康马县','定结县','仲巴县','亚东县','吉隆县','聂拉木县','萨嘎县','岗巴县'],
    '林芝': ['巴宜区','工布江达县','米林市','墨脱县','波密县','察隅县','朗县'],
    '其他': ['其他'],
  },
  '青海': {
    '西宁': ['城东区','城中区','城西区','城北区','大通回族土族自治县','湟中区','湟源县'],
    '海东': ['乐都区','平安区','民和回族土族自治县','互助土族自治县','化隆回族自治县','循化撒拉族自治县'],
    '其他': ['其他'],
  },
  '甘肃': {
    '兰州': ['城关区','七里河区','西固区','安宁区','红古区','永登县','皋兰县','榆中县'],
    '天水': ['秦州区','麦积区','清水县','秦安县','甘谷县','武山县','张家川回族自治县'],
    '张掖': ['甘州区','肃南裕固族自治县','民乐县','临泽县','高台县','山丹县'],
    '其他': ['其他'],
  },
  '宁夏': {
    '银川': ['兴庆区','西夏区','金凤区','永宁县','贺兰县','灵武市'],
    '石嘴山': ['大武口区','惠农区','平罗县'],
    '吴忠': ['利通区','红寺堡区','盐池县','同心县','青铜峡市'],
    '其他': ['其他'],
  },
  '海南': {
    '海口': ['秀英区','龙华区','琼山区','美兰区'],
    '三亚': ['海棠区','吉阳区','天涯区','崖州区'],
    '其他': ['其他'],
  },
  '香港': { '香港': ['中西区','湾仔区','东区','南区','油尖旺区','深水埗区','九龙城区','黄大仙区','观塘区','荃湾区','屯门区','元朗区','北区','大埔区','西贡区','沙田区','葵青区','离岛区'] },
  '澳门': { '澳门': ['澳门半岛','氹仔','路环','路氹城'] },
  '台湾': {
    '台北': ['中正区','大同区','中山区','松山区','大安区','万华区','信义区','士林区','北投区','内湖区','南港区','文山区'],
    '高雄': ['新兴区','前金区','苓雅区','盐埕区','鼓山区','旗津区','前镇区','三民区','楠梓区','小港区','左营区','其他'],
    '台中': ['中区','东区','南区','西区','北区','北屯区','西屯区','南屯区','太平区','大里区','雾峰区','乌日区','其他'],
    '台南': ['中西区','东区','南区','北区','安平区','安南区','永康区','归仁区','新化区','左镇区','其他'],
    '其他': ['其他'],
  },
}

// ── 年/月/日/时/分 选项 ───────────────────────────────────────────
const years = Array.from({ length: 120 }, (_, i) => 2025 - i)  // 2025 ~ 1906
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)

function getDaysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate()
}

// ── 弹窗通用容器 ──────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
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
function PickerColumn<T extends string | number>({
  items, value, onChange, format,
}: {
  items: T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const itemH = 40

  useEffect(() => {
    const idx = items.indexOf(value)
    if (idx >= 0 && listRef.current) {
      // 前置一个空 li（高度 itemH），所以选中项的 scrollTop = idx * itemH
      listRef.current.scrollTo({ top: idx * itemH, behavior: 'smooth' })
    }
  }, [value, items])

  return (
    <ul
      ref={listRef}
      className="flex-1 overflow-y-auto overscroll-contain"
      style={{ height: itemH * 3, scrollSnapType: 'y mandatory' }}
      onScroll={(e) => {
        // scrollTop = idx * itemH 对应第 idx 项（0-based）
        const idx = Math.round(e.currentTarget.scrollTop / itemH)
        const clamped = Math.max(0, Math.min(items.length - 1, idx))
        if (items[clamped] !== value) onChange(items[clamped])
      }}
    >
      <li style={{ height: itemH }} />
      {items.map((item) => (
        <li
          key={String(item)}
          style={{ height: itemH, scrollSnapAlign: 'center' }}
          className={['flex cursor-pointer items-center justify-center text-sm transition select-none', item === value ? 'text-amber-300 font-bold text-base' : 'text-slate-300'].join(' ')}
          onClick={() => onChange(item)}
        >
          {format ? format(item) : String(item).padStart(2, '0')}
        </li>
      ))}
      <li style={{ height: itemH }} />
    </ul>
  )
}

// ── 出生时间弹窗 ──────────────────────────────────────────────────
function BirthTimePicker({
  birth, onChange, onClose,
}: {
  birth: BirthDateInput; onChange: (b: BirthDateInput) => void; onClose: () => void
}) {
  const [local, setLocal] = useState(birth)
  const maxDay = getDaysInMonth(local.year, local.month)
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)

  const update = (patch: Partial<BirthDateInput>) => {
    setLocal(prev => {
      const next = { ...prev, ...patch }
      const md = getDaysInMonth(next.year, next.month)
      if (next.day > md) next.day = md
      return next
    })
  }

  return (
    <Modal title="选择出生时间" onClose={onClose}>
      <div className="mb-3 flex gap-1 text-center text-xs text-slate-400">
        <div className="flex-1">年</div>
        <div className="flex-1">月</div>
        <div className="flex-1">日</div>
        <div className="flex-1">时</div>
        <div className="flex-1">分</div>
      </div>
      {/* 分隔线高亮中间行 */}
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
      <button
        onClick={() => { onChange(local); onClose() }}
        className="mt-4 w-full rounded-xl bg-amber-400/20 border border-amber-400/40 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/30 transition"
      >
        确认
      </button>
    </Modal>
  )
}

// ── 出生地点弹窗 ──────────────────────────────────────────────────
function BirthLocationPicker({
  province, city, district, onChange, onClose,
}: {
  province: string; city: string; district: string
  onChange: (p: string, c: string, d: string) => void
  onClose: () => void
}) {
  const firstProvince = Object.keys(locationData)[0] ?? ''
  const defaultProvince = province || firstProvince
  const defaultCity = city || Object.keys(locationData[defaultProvince] ?? {})[0] || ''
  const defaultDistrict = district || locationData[defaultProvince]?.[defaultCity]?.[0] || ''
  const [selProvince, setSelProvince] = useState(defaultProvince)
  const [selCity, setSelCity] = useState(defaultCity)
  const [selDistrict, setSelDistrict] = useState(defaultDistrict)

  const provinces = Object.keys(locationData)
  const cities = Object.keys(locationData[selProvince] ?? {})
  const districts = locationData[selProvince]?.[selCity] ?? []

  const onProvinceChange = (p: string) => {
    setSelProvince(p)
    const firstCity = Object.keys(locationData[p] ?? {})[0] ?? ''
    setSelCity(firstCity)
    const firstDist = locationData[p]?.[firstCity]?.[0] ?? ''
    setSelDistrict(firstDist)
  }
  const onCityChange = (c: string) => {
    setSelCity(c)
    const firstDist = locationData[selProvince]?.[c]?.[0] ?? ''
    setSelDistrict(firstDist)
  }

  return (
    <Modal title="选择出生地点" onClose={onClose}>
      <div className="mb-3 flex gap-1 text-center text-xs text-slate-400">
        <div className="flex-1">省份</div>
        <div className="flex-1">城市</div>
        <div className="flex-1">区县</div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-[40px] h-[40px] rounded-lg border-y border-amber-400/30 bg-amber-400/5" />
        <div className="flex gap-1">
          <PickerColumn items={provinces} value={selProvince} onChange={onProvinceChange} format={v => v} />
          <PickerColumn items={cities} value={selCity} onChange={onCityChange} format={v => v} />
          <PickerColumn items={districts.length ? districts : ['—']} value={selDistrict || districts[0] || '—'} onChange={setSelDistrict} format={v => v} />
        </div>
      </div>
      <button
        onClick={() => { onChange(selProvince, selCity, selDistrict); onClose() }}
        className="mt-4 w-full rounded-xl bg-amber-400/20 border border-amber-400/40 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-400/30 transition"
      >
        确认
      </button>
    </Modal>
  )
}

// ── 时间显示格式化 ────────────────────────────────────────────────
function formatBirth(b: BirthDateInput) {
  return `${b.year} 年 ${String(b.month).padStart(2,'0')} 月 ${String(b.day).padStart(2,'0')} 日  ${String(b.hour).padStart(2,'0')}:${String(b.minute ?? 0).padStart(2,'0')}`
}
function formatLocation(province: string, city: string, district: string) {
  if (!province) return '点击选择省 / 市 / 区'
  return [province, city, district].filter(Boolean).join(' · ')
}

/** 初始/恢复：显式 false 优先；否则有完整出生地则默认视为启用真太阳时（兼容旧存档） */
function inferUseSolarTime(iv: UserInput | null | undefined): boolean {
  if (!iv) return false
  if (iv.useSolarTime === false) return false
  if (iv.useSolarTime === true) return true
  return hasBirthLocationForTrueSolar({
    country: iv.country,
    province: iv.province,
    city: iv.city,
    district: iv.district,
  })
}

function isValidDate(birth: BirthDateInput) {
  const { year, month, day } = birth
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false
  if (year < 1900 || year > 2100) return false
  if (month < 1 || month > 12) return false
  const maxDay = new Date(year, month, 0).getDate()
  return day >= 1 && day <= maxDay
}

// ══════════════════════════════════════════════════════════════════
export default function Step1Input({
  onNext,
  initialValues,
  isSubmitting = false,
}: {
  onNext: (data: UserInput) => void | Promise<void>
  initialValues?: UserInput | null
  /** 动态加载测算模块时禁用「下一步」避免重复提交 */
  isSubmitting?: boolean
}) {
  const today = new Date()
  const [name, setName] = useState(() => initialValues?.name?.trim() ?? '')
  const [birth, setBirth] = useState<BirthDateInput>(
    () =>
      initialValues?.birth ?? {
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
        hour: 12,
        minute: 0,
      },
  )
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const [gender, setGender] = useState<Gender>(() => initialValues?.gender ?? '男')
  const [bloodType, setBloodType] = useState<BloodType>(() => initialValues?.bloodType ?? 'A')
  const [mbti, setMbti] = useState<MBTI | ''>(() => initialValues?.mbti ?? '')
  const [mbtiDimensions, setMbtiDimensions] = useState(() => ({
    ei: (initialValues?.mbtiDimensions?.ei ?? 'I') as 'I' | 'E',
    sn: (initialValues?.mbtiDimensions?.sn ?? 'S') as 'S' | 'N',
    tf: (initialValues?.mbtiDimensions?.tf ?? 'T') as 'T' | 'F',
    jp: (initialValues?.mbtiDimensions?.jp ?? 'J') as 'J' | 'P',
  }))
  const [useMbtiDimensions, setUseMbtiDimensions] = useState(() => Boolean(initialValues?.mbtiDimensions))
  const [hasChosenMbtiDimensions, setHasChosenMbtiDimensions] = useState(() => Boolean(initialValues?.mbtiDimensions))
  const [calendarType, setCalendarType] = useState<'公历' | '农历'>(() => initialValues?.calendarType ?? '公历')
  const [country, setCountry] = useState(() => initialValues?.country ?? '中国')
  const [province, setProvince] = useState(() => initialValues?.province ?? '')
  const [city, setCity] = useState(() => initialValues?.city ?? '')
  const [district, setDistrict] = useState(() => initialValues?.district ?? '')
  const [useSolarTime, setUseSolarTime] = useState(() => inferUseSolarTime(initialValues ?? undefined))
  const [saveData, setSaveData] = useState(() => initialValues?.saveData ?? false)

  const [selectedChartSystems, setSelectedChartSystems] = useState<string[]>(() => {
    const prev = initialValues?.selectedChartSystems
    if (prev?.length) {
      const allowed = new Set<string>(ALL_CHART_SYSTEM_KEYS)
      const filtered = prev.filter((k) => allowed.has(k))
      if (filtered.length > 0) return filtered
    }
    return getDefaultSelectedChartSystems()
  })

  const bloodSystemSelected = selectedChartSystems.includes('血型')
  const mbtiSystemSelected = selectedChartSystems.includes('MBTI')

  useEffect(() => {
    if (bloodSystemSelected) return
    // 不勾选血型体系时不展示输入；这里顺便把值重置为默认，避免缓存/指纹混入无关信息。
    setBloodType('A')
  }, [bloodSystemSelected])

  useEffect(() => {
    if (mbtiSystemSelected) return
    setMbti('')
    setUseMbtiDimensions(false)
    setHasChosenMbtiDimensions(false)
  }, [mbtiSystemSelected])

  const [showLastInputHint, setShowLastInputHint] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_INPUT_STORAGE_KEY)
      setShowLastInputHint(!!saved)
      if (!saved) return
      const parsed = JSON.parse(saved) as Record<string, unknown>

      if (typeof parsed.name === 'string') setName(parsed.name)

      if (parsed.birth && typeof parsed.birth === 'object') {
        const b = parsed.birth as BirthDateInput
        if (isValidDate(b)) {
          const maxDay = getDaysInMonth(b.year, b.month)
          setBirth({
            year: b.year,
            month: b.month,
            day: Math.min(b.day, maxDay),
            hour: Math.min(23, Math.max(0, Number(b.hour) || 0)),
            minute: Math.min(59, Math.max(0, Number(b.minute ?? 0) || 0)),
          })
        }
      }

      if (parsed.gender === '男' || parsed.gender === '女') setGender(parsed.gender)

      if (typeof parsed.bloodType === 'string' && bloodOptions.includes(parsed.bloodType as BloodType)) {
        setBloodType(parsed.bloodType as BloodType)
      }

      if (typeof parsed.calendarType === 'string' && (parsed.calendarType === '公历' || parsed.calendarType === '农历')) {
        setCalendarType(parsed.calendarType)
      }

      if (typeof parsed.country === 'string') setCountry(parsed.country)
      if (typeof parsed.province === 'string') setProvince(parsed.province)
      if (typeof parsed.city === 'string') setCity(parsed.city)
      if (typeof parsed.district === 'string') setDistrict(parsed.district)

      if (typeof parsed.useSolarTime === 'boolean') {
        setUseSolarTime(parsed.useSolarTime)
      } else {
        const co = typeof parsed.country === 'string' ? parsed.country : ''
        const pr = typeof parsed.province === 'string' ? parsed.province : ''
        const ci = typeof parsed.city === 'string' ? parsed.city : ''
        const di = typeof parsed.district === 'string' ? parsed.district : ''
        setUseSolarTime(hasBirthLocationForTrueSolar({ country: co, province: pr, city: ci, district: di }))
      }

      if (typeof parsed.saveData === 'boolean') setSaveData(parsed.saveData)

      if (typeof parsed.useMbtiDimensions === 'boolean') {
        setUseMbtiDimensions(parsed.useMbtiDimensions)
        setHasChosenMbtiDimensions(parsed.useMbtiDimensions ? Boolean(parsed.mbtiDimensions) : false)
      } else if (parsed.mbtiDimensions && typeof parsed.mbtiDimensions === 'object') {
        setUseMbtiDimensions(true)
        setHasChosenMbtiDimensions(true)
      }

      const md = parsed.mbtiDimensions as Record<string, string> | undefined
      if (md && typeof md === 'object') {
        const ei = md.ei === 'E' ? 'E' : 'I'
        const sn = md.sn === 'N' ? 'N' : 'S'
        const tf = md.tf === 'F' ? 'F' : 'T'
        const jp = md.jp === 'P' ? 'P' : 'J'
        setMbtiDimensions({ ei, sn, tf, jp })
        setHasChosenMbtiDimensions(true)
      }

      if (typeof parsed.mbti === 'string' && mbtiOptions.includes(parsed.mbti as MBTI)) {
        setMbti(parsed.mbti as MBTI)
        setUseMbtiDimensions(false)
        setHasChosenMbtiDimensions(false)
      }

      const prevSys = parsed.selectedChartSystems
      if (Array.isArray(prevSys) && prevSys.length > 0) {
        const allowed = new Set<string>(ALL_CHART_SYSTEM_KEYS)
        const filtered = prevSys.filter((k): k is string => typeof k === 'string' && allowed.has(k))
        if (filtered.length > 0) setSelectedChartSystems(filtered)
      }
    } catch {
      /* ignore corrupt localStorage */
    }
  }, [])

  const derivedMbti = `${mbtiDimensions.ei}${mbtiDimensions.sn}${mbtiDimensions.tf}${mbtiDimensions.jp}` as MBTI

  const toggleChartSystem = (key: string) => {
    setSelectedChartSystems((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const validation = useMemo(() => {
    const nameOk = name.trim().length >= 2 && name.trim().length <= 20
    const birthOk = isValidDate(birth) && birth.hour >= 0 && birth.hour <= 23
    const systemsOk = selectedChartSystems.length >= 1
    const mbtiEnabled = selectedChartSystems.includes('MBTI')
    const mbtiOk =
      !mbtiEnabled ||
      (useMbtiDimensions ? hasChosenMbtiDimensions : mbti !== '')
    return { nameOk, birthOk, systemsOk, mbtiOk, allOk: nameOk && birthOk && systemsOk && mbtiOk }
  }, [name, birth, selectedChartSystems, mbti, useMbtiDimensions, hasChosenMbtiDimensions])

  const next = () => {
    if (!validation.allOk || isSubmitting) return
    const mbtiEnabled = selectedChartSystems.includes('MBTI')
    const payloadMbti: MBTI | undefined = mbtiEnabled
      ? useMbtiDimensions
        ? hasChosenMbtiDimensions
          ? derivedMbti
          : undefined
        : mbti !== ''
          ? mbti
          : undefined
      : undefined
    const payloadMbtiDims = mbtiEnabled && useMbtiDimensions && hasChosenMbtiDimensions ? mbtiDimensions : undefined
    const payload = {
      name: name.trim(),
      birth,
      gender,
      bloodType: bloodSystemSelected ? bloodType : undefined,
      mbti: payloadMbti,
      mbtiDimensions: payloadMbtiDims,
      useMbtiDimensions: Boolean(payloadMbtiDims),
      calendarType,
      country,
      province,
      city,
      district: district || undefined,
      useSolarTime,
      saveData,
      selectedChartSystems: [...selectedChartSystems],
    }
    try {
      localStorage.setItem(LAST_INPUT_STORAGE_KEY, JSON.stringify(payload))
      setShowLastInputHint(true)
    } catch {
      /* quota / private mode */
    }
    void onNext({
      name: payload.name,
      birth: payload.birth,
      gender: payload.gender,
      bloodType: payload.bloodType,
      mbti: payload.mbti,
      mbtiDimensions: payload.mbtiDimensions,
      calendarType: payload.calendarType,
      country: payload.country,
      province: payload.province,
      city: payload.city,
      district: payload.district,
      useSolarTime: payload.useSolarTime,
      saveData: payload.saveData,
      selectedChartSystems: payload.selectedChartSystems,
    })
  }

  const toggleDim = (dim: 'ei'|'sn'|'tf'|'jp', val: string) =>
    (() => {
      setHasChosenMbtiDimensions(true)
      setMbtiDimensions((d) => ({ ...d, [dim]: val }))
    })()

  return (
    <>
      {showTimePicker && (
        <BirthTimePicker
          birth={birth}
          onChange={setBirth}
          onClose={() => setShowTimePicker(false)}
        />
      )}
      {showLocationPicker && country === '中国' && (
        <BirthLocationPicker
          province={province} city={city} district={district}
          onChange={(p, c, d) => {
            setProvince(p)
            setCity(c)
            setDistrict(d)
            setUseSolarTime(true)
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      <div className="mx-auto max-w-5xl px-4 pb-12 pt-8">
        <div className="mb-8 rounded-2xl border border-amber-400/20 bg-white/[0.03] px-4 py-6 sm:px-6">
          <p className="text-center font-serif text-2xl font-semibold tracking-wide text-amber-200/95 sm:text-3xl md:text-4xl">
            深度自我探索工具
          </p>
          <p className="mx-auto mt-3 max-w-2xl px-1 text-center text-xs leading-relaxed text-slate-200/80 sm:mt-4 sm:text-sm">
            融合多种分析工具，帮你洞察自己的个性和天赋（娱乐参考，不构成任何建议）
          </p>
          <p className="mt-5 text-sm font-medium text-amber-100/85">
            <span className="mr-1.5 opacity-90">✨</span>
            排盘系统选择：
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {CHART_SYSTEMS.map(({ key, label }) => {
              const on = selectedChartSystems.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleChartSystem(key)}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded-full border px-3 py-2.5 text-left text-xs transition sm:text-[13px]',
                    on
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-50 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)] font-bold'
                      : 'border-white/15 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-300 font-medium',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 leading-snug">{label}</span>
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]',
                      on
                        ? 'border-amber-400/40 bg-amber-400/20 text-amber-100'
                        : 'border-white/10 bg-transparent text-transparent',
                    ].join(' ')}
                    aria-hidden
                  >
                    ✓
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card
              icon={<IconSparkle className="h-6 w-6" />}
              title="填写个人信息"
              headerRight={showLastInputHint ? '✓ 已自动填入上次的信息' : null}
            >
              <div className="grid gap-4">

                {/* 姓名 */}
                <FormField label="姓名">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：林明"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-200/40 focus:border-amber-400/40" />
                </FormField>

                {/* 性别 */}
                <FormField label="性别">
                  <div className="flex gap-3">
                    {genderOptions.map((g) => (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        className={['flex-1 rounded-xl border px-3 py-2 text-sm transition', gender === g ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20'].join(' ')}>
                        {g}
                      </button>
                    ))}
                  </div>
                </FormField>

                {/* 起盘方式 */}
                <FormField label="起盘方式">
                  <div className="flex gap-3">
                    {(['公历', '农历'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setCalendarType(t)}
                        className={['flex-1 rounded-xl border px-3 py-2 text-sm transition', calendarType === t ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/20'].join(' ')}>
                        {t}排盘
                      </button>
                    ))}
                  </div>
                </FormField>

                {/* 出生时间 — 选择器入口 */}
                <Card icon={<IconMoonStars className="h-6 w-6" />} title="出生日期与时间">
                  <button
                    type="button"
                    onClick={() => setShowTimePicker(true)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-100 hover:border-amber-400/30 hover:bg-white/10 transition flex items-center justify-between"
                  >
                    <span>{formatBirth(birth)}</span>
                    <span className="text-slate-400 text-xs">▾ 选择</span>
                  </button>
                  <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs leading-5 text-slate-200/80">
                    八字/紫微时辰：请在「出生地」中勾选<strong className="text-amber-100/90">真太阳时</strong>并选到具体城市后，才按经度校正；关闭勾选则只用国家维度、以钟表时间排盘（例如仅「中国」时多为东八区中心经度，与西安等地会有时辰差异）。
                  </div>
                  <div className="mt-2 text-xs text-slate-200/60">精确分钟用于西洋星盘与紫微斗数计算。</div>
                </Card>

                {/* 出生地 — 选择器入口 */}
                <Card icon={<IconSun className="h-6 w-6" />} title="出生地">
                  {/* 国家选择（不是中国时显示文本输入） */}
                  <FormField label="国家">
                    <select value={country} onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/40">
                      {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FormField>

                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={useSolarTime}
                      onChange={(e) => {
                        const on = e.target.checked
                        setUseSolarTime(on)
                        if (!on) {
                          setProvince('')
                          setCity('')
                          setDistrict('')
                        }
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900 text-amber-500 focus:ring-amber-400/40"
                    />
                    <span className="min-w-0 leading-snug">
                      <span className="font-medium text-amber-100/90">使用真太阳时</span>
                      <span className="mt-0.5 block text-xs font-normal text-slate-400">
                        勾选后可填写具体城市；八字/紫微将按该地经度校正时辰。
                        <strong className="text-slate-300">取消勾选会清空省/市/区（或海外城市）</strong>，仅按国家粗略时区、以您输入的钟表时间排盘。
                      </span>
                    </span>
                  </label>

                  {country === '中国' ? (
                    <button
                      type="button"
                      disabled={!useSolarTime}
                      onClick={() => useSolarTime && setShowLocationPicker(true)}
                      title={!useSolarTime ? '请先勾选「使用真太阳时」再选择省市区' : undefined}
                      className={[
                        'mt-3 w-full rounded-xl border px-4 py-3 text-left text-sm transition flex items-center justify-between',
                        useSolarTime
                          ? 'border-white/10 bg-white/5 text-slate-100 hover:border-amber-400/30 hover:bg-white/10'
                          : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-500',
                      ].join(' ')}
                    >
                      <span>{useSolarTime ? formatLocation(province, city, district) : '未选择具体城市（仅国家 · 钟表时间排盘）'}</span>
                      <span className="text-slate-400 text-xs">{useSolarTime ? '▾ 选择' : '—'}</span>
                    </button>
                  ) : (
                    <div className="mt-3">
                      <div className="mb-2 text-xs text-amber-100/80">城市（用于真太阳时经纬度）</div>
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={!useSolarTime}
                        placeholder={useSolarTime ? '请输入城市名（须与内置城市表匹配才校正）' : '请先勾选「使用真太阳时」'}
                        className={[
                          'w-full rounded-xl border px-3 py-2 text-sm outline-none placeholder:text-slate-200/40',
                          useSolarTime
                            ? 'border-white/10 bg-white/5 text-slate-100 focus:border-amber-400/40'
                            : 'cursor-not-allowed border-white/5 bg-white/[0.02] text-slate-500',
                        ].join(' ')}
                      />
                    </div>
                  )}
                  <div className="mt-2 text-xs text-slate-200/60">
                    西洋星盘仍使用国家/城市估算经纬（与八字真太阳时开关独立）。
                  </div>
                </Card>

                {/* 血型 */}
                {bloodSystemSelected ? (
                  <FormField label="血型">
                    <select
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value as BloodType)}
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/40"
                    >
                      {bloodOptions.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}

                {/* MBTI */}
                {mbtiSystemSelected ? (
                  <FormField label="MBTI">
                    <div className="mb-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUseMbtiDimensions(false)
                        }}
                        className={['flex-1 rounded-xl border px-3 py-2 text-xs transition', !useMbtiDimensions ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100'].join(' ')}
                      >
                        直接选择类型
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUseMbtiDimensions(true)
                          setHasChosenMbtiDimensions(false)
                        }}
                        className={['flex-1 rounded-xl border px-3 py-2 text-xs transition', useMbtiDimensions ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100'].join(' ')}
                      >
                        按维度选择
                      </button>
                    </div>

                    {!useMbtiDimensions ? (
                      <select
                        value={mbti}
                        onChange={(e) => setMbti(e.target.value as MBTI | '')}
                        className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-400/40"
                      >
                        <option value="">未选择</option>
                        {mbtiOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid gap-3">
                        {([['ei', ['I', 'E']], ['sn', ['S', 'N']], ['tf', ['T', 'F']], ['jp', ['J', 'P']]] as const).map(
                          ([dim, opts]) => (
                            <div key={dim} className="flex gap-2">
                              {opts.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => toggleDim(dim, v)}
                                  className={[
                                    'flex-1 rounded-xl border px-3 py-2 text-sm transition',
                                    mbtiDimensions[dim] === v
                                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                                      : 'border-white/10 bg-white/5 text-slate-100',
                                  ].join(' ')}
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          ),
                        )}
                        <div className="text-center text-sm text-amber-100/80">结果：{hasChosenMbtiDimensions ? derivedMbti : '未选择'}</div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-200/60">可随时重置为未选择</span>
                      <button
                        type="button"
                        onClick={() => {
                          setMbti('')
                          setUseMbtiDimensions(false)
                          setHasChosenMbtiDimensions(false)
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:border-amber-400/30 hover:bg-white/10"
                      >
                        重置
                      </button>
                    </div>
                  </FormField>
                ) : null}

                {/* 数据保存 */}
                <FormField label="数据保存">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setSaveData(!saveData)}
                      className={['rounded-xl border px-4 py-2 text-sm transition', saveData ? 'border-amber-400/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-slate-100'].join(' ')}>
                      {saveData ? '✓ 保存数据' : '不保存数据'}
                    </button>
                    <span className="text-xs text-slate-200/60">{saveData ? '结果将保存到本地浏览器' : '仅本次计算，不保存'}</span>
                  </div>
                </FormField>

                {!validation.allOk && (
                  <div className="mt-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-100">
                    请检查：姓名长度、出生日期与时辰是否正确；排盘系统请至少保留 1 项。
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-200/70">输入仅在浏览器本地计算，不上传到服务器。</div>
                  <button
                    type="button"
                    onClick={next}
                    disabled={!validation.allOk || isSubmitting}
                    className={[
                      'rounded-xl border px-5 py-2.5 text-sm font-semibold transition',
                      validation.allOk && !isSubmitting
                        ? 'border-amber-400/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/20'
                        : 'border-white/10 bg-white/5 text-slate-200/50 cursor-not-allowed',
                    ].join(' ')}
                  >
                    {isSubmitting ? '正在准备测算…' : '下一步：查看结果'}
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <div className="grid gap-4">
              <Card icon={<IconSun className="h-6 w-6" />} title="您将获得">
                <div className="flex flex-col gap-6 sm:gap-7">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-100/[0.12] sm:h-14 sm:w-14"
                      aria-hidden
                    >
                      <IconCompass className="h-5 w-5 text-amber-400/95 sm:h-6 sm:w-6" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 leading-snug">
                      <div className="text-[15px] font-semibold tracking-wide text-slate-100/95 sm:text-base">
                        精准排盘
                      </div>
                      <div className="mt-1 text-xs text-slate-400/90 sm:text-sm">多体系算法</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-100/[0.12] sm:h-14 sm:w-14"
                      aria-hidden
                    >
                      <IconBookOpen className="h-5 w-5 text-amber-400/95 sm:h-6 sm:w-6" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 leading-snug">
                      <div className="text-[15px] font-semibold tracking-wide text-slate-100/95 sm:text-base">
                        AI 深度解读
                      </div>
                      <div className="mt-1 text-xs text-slate-400/90 sm:text-sm">智能命理分析</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-100/[0.12] sm:h-14 sm:w-14"
                      aria-hidden
                    >
                      <IconUserBust className="h-5 w-5 text-amber-400/95 sm:h-6 sm:w-6" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 leading-snug">
                      <div className="text-[15px] font-semibold tracking-wide text-slate-100/95 sm:text-base">
                        资深大师咨询
                      </div>
                      <div className="mt-1 text-xs text-slate-400/90 sm:text-sm">名师在线指点</div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
