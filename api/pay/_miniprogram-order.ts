import { createSign } from 'crypto'
import type { PurchaseItem } from './_fulfillment.js'
import { buildAttach } from './_fulfillment.js'
import { genOutTradeNo, getWxPayConfig, nonceStr, normalizePem, wxpayRequest } from './_wxpay.js'

export async function createMiniProgramOrder(
  userId: string,
  openid: string,
  item: PurchaseItem,
) {
  const { mchid, notifyUrl, privateKey } = getWxPayConfig()
  const appId = process.env.WX_MINI_APPID ?? 'wxf1d2e889d05100bb'
  const outTradeNo = genOutTradeNo()
  const result = await wxpayRequest<{ prepay_id: string }>('POST', '/v3/pay/transactions/jsapi', {
    appid: appId,
    mchid,
    description: `松眠疗愈 - ${item.label}`,
    out_trade_no: outTradeNo,
    notify_url: notifyUrl,
    amount: { total: item.priceFen, currency: 'CNY' },
    payer: { openid },
    attach: buildAttach(userId, item),
  })

  const timeStamp = Math.floor(Date.now() / 1000).toString()
  const nonce = nonceStr(18)
  const packageValue = `prepay_id=${result.prepay_id}`
  const signMessage = `${appId}\n${timeStamp}\n${nonce}\n${packageValue}\n`
  const signer = createSign('RSA-SHA256')
  signer.update(signMessage)

  return {
    outTradeNo,
    jsapiParams: {
      timeStamp,
      nonceStr: nonce,
      package: packageValue,
      signType: 'RSA',
      paySign: signer.sign(normalizePem(privateKey), 'base64'),
    },
  }
}
