// Clash Party / Mihomo PC 端覆写
// 基于路由器端自用规则整理，保留原订阅节点、策略组和 rules。
// 额外处理：PS Remote Play（RemotePlay.exe）强制 DIRECT，避免 TUN/代理接管后远程游玩连接异常。

function main(config) {
  if (!config || typeof config !== 'object') return config

  const rawProxies = Array.isArray(config.proxies) ? config.proxies : []
  const proxyNames = rawProxies
    .map((p) => (p && typeof p === 'object' ? p.name : null))
    .filter(Boolean)

  const oldGroups = Array.isArray(config['proxy-groups']) ? config['proxy-groups'] : []
  const fallbackGroup =
    oldGroups.find((g) => g && typeof g === 'object' && /节点选择/.test(String(g.name || '')))
      ?.name || 'DIRECT'

  const highMultiplier = /(v3|10倍|5倍|5x)/i

  function selectNodes(regex, excludeHighMultiplier = true) {
    const names = proxyNames.filter((name) => {
      if (!regex.test(name)) return false
      if (excludeHighMultiplier && highMultiplier.test(name)) return false
      return true
    })
    return names.length ? names : [fallbackGroup]
  }

  const us = /美国|美國|United States/i
  const hk = /香港|Hong Kong|HongKong/i
  const jp = /日本|东京|東京|大阪|Japan/i
  const hkJp = /香港|Hong Kong|HongKong|日本|东京|東京|大阪|Japan/i
  const hkUs = /香港|Hong Kong|HongKong|美国|美國|United States/i
  const hkJpUs = /香港|Hong Kong|HongKong|日本|东京|東京|大阪|Japan|美国|美國|United States/i

  const customGroups = [
    {
      name: 'OpenAI-US',
      type: 'select',
      proxies: selectNodes(us)
    },
    {
      name: 'Google-US',
      type: 'select',
      proxies: selectNodes(us)
    },
    {
      name: 'YouTube',
      type: 'select',
      proxies: selectNodes(hkJpUs)
    },
    {
      name: 'GitHub',
      type: 'select',
      proxies: selectNodes(hkUs)
    },
    {
      // Pixiv 当前保留全部节点，方便手动测试可用出口。
      name: 'Pixiv-All',
      type: 'select',
      proxies: proxyNames.length ? proxyNames : [fallbackGroup]
    },
    {
      name: 'Steam-HK-JP',
      type: 'select',
      proxies: selectNodes(hkJp)
    },
    {
      name: 'Game-HK-JP',
      type: 'select',
      proxies: selectNodes(hkJp)
    }
  ]

  const customGroupNames = new Set(customGroups.map((g) => g.name))
  config['proxy-groups'] = [
    ...oldGroups.filter((g) => !g || !customGroupNames.has(g.name)),
    ...customGroups
  ]

  // PROCESS-NAME 规则需要进程识别；strict 足够用于 Windows RemotePlay.exe。
  config['find-process-mode'] = 'strict'

  const prependRules = [
    // ========================================================
    // PC 专用：PS Remote Play 全进程直连
    // 放在最前面，RemotePlay.exe 的 TCP/UDP 均不进入代理。
    // ========================================================
    'PROCESS-NAME,RemotePlay.exe,DIRECT',

    // OpenAI / ChatGPT
    'DOMAIN-SUFFIX,chatgpt.com,OpenAI-US',
    'DOMAIN-SUFFIX,openai.com,OpenAI-US',
    'DOMAIN-SUFFIX,oaistatic.com,OpenAI-US',
    'DOMAIN-SUFFIX,oaiusercontent.com,OpenAI-US',
    'GEOSITE,openai,OpenAI-US',

    // YouTube 必须放在 Google 前面
    'GEOSITE,youtube,YouTube',

    // Google
    'GEOSITE,google,Google-US',

    // GitHub
    'DOMAIN-SUFFIX,github.com,GitHub',
    'DOMAIN-SUFFIX,githubusercontent.com,GitHub',
    'DOMAIN-SUFFIX,githubassets.com,GitHub',
    'GEOSITE,github,GitHub',

    // Pixiv / FANBOX
    'DOMAIN-SUFFIX,pixiv.net,Pixiv-All',
    'DOMAIN-SUFFIX,pximg.net,Pixiv-All',
    'DOMAIN-SUFFIX,fanbox.cc,Pixiv-All',
    'DOMAIN-SUFFIX,ads-pixiv.net,Pixiv-All',

    // Steam 国内下载 / CDN：直连
    'DOMAIN,csgo.wmsj.cn,DIRECT',
    'DOMAIN,dl.steam.clngaa.com,DIRECT',
    'DOMAIN,dl.steam.ksyna.com,DIRECT',
    'DOMAIN,dota2.wmsj.cn,DIRECT',
    'DOMAIN,st.dl.bscstorage.net,DIRECT',
    'DOMAIN,st.dl.eccdnx.com,DIRECT',
    'DOMAIN,st.dl.pinyuncloud.com,DIRECT',
    'DOMAIN,steampipe.steamcontent.tnkjmec.com,DIRECT',
    'DOMAIN,steampowered.com.8686c.com,DIRECT',
    'DOMAIN,steamstatic.com.8686c.com,DIRECT',
    'DOMAIN,wmsjsteam.com,DIRECT',
    'DOMAIN,xz.pphimalayanrt.com,DIRECT',
    'DOMAIN-SUFFIX,cm.steampowered.com,DIRECT',
    'DOMAIN-SUFFIX,steamchina.com,DIRECT',
    'DOMAIN-SUFFIX,steamcontent.com,DIRECT',
    'DOMAIN-SUFFIX,steamusercontent.com,DIRECT',

    // Steam 商店 / 社区 / 创意工坊页面等
    'GEOSITE,steam,Steam-HK-JP',

    // 其他游戏平台
    'GEOSITE,epicgames,Game-HK-JP',
    'GEOSITE,origin,Game-HK-JP',
    'GEOSITE,ea,Game-HK-JP',
    'GEOSITE,sony,Game-HK-JP',
    'GEOSITE,playstation,Game-HK-JP',
    'GEOSITE,nintendo,Game-HK-JP'
  ]

  const oldRules = Array.isArray(config.rules) ? config.rules : []
  const seen = new Set()
  config.rules = [...prependRules, ...oldRules].filter((rule) => {
    if (seen.has(rule)) return false
    seen.add(rule)
    return true
  })

  return config
}
