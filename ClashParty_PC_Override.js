// Clash Party / Mihomo PC 端覆写
// 基于 ACL4SSR_Online_Full_路由器自用修改版.yaml 的当前分流逻辑整理。
// 保留机场订阅原有节点、策略组与 rules；动态生成地区组，并前置个人分流规则。
// PC 专用差异：PS Remote Play（RemotePlay.exe）强制 DIRECT，避免 TUN/代理接管后远程游玩连接异常。
// 不写死 clyne.top -> 192.168.6.100，避免在非家庭网络环境下受到影响。

function main(config) {
  if (!config || typeof config !== 'object') return config;

  const rawProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const proxyNames = rawProxies
    .map(function (p) {
      return p && typeof p === 'object' ? p.name : null;
    })
    .filter(Boolean);

  const oldGroups = Array.isArray(config['proxy-groups'])
    ? config['proxy-groups']
    : [];

  const REGION_NAMES = [
    '🇭🇰 香港节点',
    '🇺🇸 美国节点',
    '🇯🇵 日本节点',
    '🇨🇳 台湾节点',
    '🇸🇬 新加坡节点',
    '🇲🇾 马来西亚节点',
    '🇰🇷 韩国节点'
  ];

  const BUSINESS_NAMES = [
    '💬 OpenAI',
    '🔎 Google',
    '📹 油管视频',
    '💻 GitHub',
    '🎨 Pixiv',
    '🎮 Steam',
    '🎮 Epic Games',
    '⚡ EA / Origin',
    '🟩 Xbox',
    '🎮 PlayStation',
    '🕹️ Nintendo'
  ];

  const regionPatterns = {
    '🇭🇰 香港节点': /🇭🇰|香港|Hong.?Kong|(?:^|[^A-Za-z])HK(?:[^A-Za-z]|$)/i,
    '🇺🇸 美国节点': /🇺🇸|美国|美國|United States|(?:^|[^A-Za-z])US(?:[^A-Za-z]|$)/i,
    '🇯🇵 日本节点': /🇯🇵|日本|Japan|(?:^|[^A-Za-z])JP(?:[^A-Za-z]|$)/i,
    '🇨🇳 台湾节点': /🇹🇼|台湾|臺灣|Taiwan|(?:^|[^A-Za-z])TW(?:[^A-Za-z]|$)/i,
    '🇸🇬 新加坡节点': /🇸🇬|新加坡|狮城|獅城|Singapore|(?:^|[^A-Za-z])SG(?:[^A-Za-z]|$)/i,
    '🇲🇾 马来西亚节点': /🇲🇾|马来西亚|馬來西亞|Malaysia|(?:^|[^A-Za-z])MY(?:[^A-Za-z]|$)/i,
    '🇰🇷 韩国节点': /🇰🇷|韩国|韓國|Korea|(?:^|[^A-Za-z])KR(?:[^A-Za-z]|$)/i
  };

  const subscriptionInfoPattern = /剩余|流量|到期|套餐|官网|订阅|客服/i;

  function unique(items) {
    return items.filter(function (item, index) {
      return item && items.indexOf(item) === index;
    });
  }

  function findGroup(groups, exactName, fallbackPattern) {
    let group = groups.find(function (g) {
      return g && g.name === exactName;
    });
    if (!group && fallbackPattern) {
      group = groups.find(function (g) {
        return g && fallbackPattern.test(String(g.name || ''));
      });
    }
    return group || null;
  }

  function nodesForRegion(pattern) {
    return proxyNames.filter(function (name) {
      return pattern.test(name);
    });
  }

  function isRegionNode(name) {
    return REGION_NAMES.some(function (regionName) {
      return regionPatterns[regionName].test(name);
    });
  }

  const managedNames = new Set(REGION_NAMES.concat(BUSINESS_NAMES));

  // 保留机场原有组，仅移除旧的同名自定义组，避免重复。
  const groups = oldGroups
    .filter(function (g) {
      return !g || !managedNames.has(g.name);
    })
    .map(function (g) {
      if (!g || typeof g !== 'object') return g;
      const copy = Object.assign({}, g);
      if (Array.isArray(g.proxies)) copy.proxies = g.proxies.slice();
      return copy;
    });

  const mainGroup = findGroup(groups, '🔰 节点选择', /节点选择/);
  const mainGroupName = mainGroup ? mainGroup.name : null;

  const autoGroup = findGroup(groups, '♻️ 自动选择', /自动选择|auto/i);
  const autoGroupName = autoGroup ? autoGroup.name : null;

  // 动态生成地区组。
  const regionGroups = REGION_NAMES.map(function (name) {
    const nodes = nodesForRegion(regionPatterns[name]);
    return {
      name: name,
      type: 'select',
      proxies: nodes.length ? nodes : ['REJECT']
    };
  });

  groups.push.apply(groups, regionGroups);

  // “节点选择”：地区组 + 其他地区真实节点 + DIRECT。
  if (mainGroup) {
    const extraNodes = proxyNames.filter(function (name) {
      return !isRegionNode(name) && !subscriptionInfoPattern.test(name);
    });

    mainGroup.proxies = unique(
      [autoGroupName]
        .concat(REGION_NAMES)
        .concat(extraNodes)
        .concat(['DIRECT'])
    );
  }

  const groupNames = new Set(
    groups
      .filter(function (g) {
        return g && g.name;
      })
      .map(function (g) {
        return g.name;
      })
  );

  function existing(name) {
    return groupNames.has(name) ? name : null;
  }

  function setGroupChoices(name, choices) {
    const group = groups.find(function (g) {
      return g && g.name === name;
    });
    if (!group) return;
    group.proxies = unique(choices);
  }

  // 对齐路由器端原订阅策略组的可选项。
  setGroupChoices(
    '🌍 国外媒体',
    [mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName, existing('🎯 全球直连')])
  );

  setGroupChoices(
    '🌏 国内媒体',
    [existing('🎯 全球直连'), mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName])
  );

  setGroupChoices(
    'Ⓜ️ 微软服务',
    [existing('🎯 全球直连'), mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName])
  );

  setGroupChoices(
    '📲 电报信息',
    [mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName, existing('🎯 全球直连')])
  );

  setGroupChoices(
    '🍎 苹果服务',
    [mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName, existing('🎯 全球直连')])
  );

  setGroupChoices(
    '🎯 全球直连',
    ['DIRECT', mainGroupName].concat(REGION_NAMES)
  );

  setGroupChoices(
    '🛑 全球拦截',
    [mainGroupName, 'REJECT', 'DIRECT'].concat(REGION_NAMES)
  );

  setGroupChoices(
    '🐟 漏网之鱼',
    [mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName, existing('🎯 全球直连')])
  );

  // 新增业务分流组；默认第一项跟随“节点选择”。
  const commonChoices = unique(
    [mainGroupName]
      .concat(REGION_NAMES)
      .concat([autoGroupName, 'DIRECT'])
  );

  BUSINESS_NAMES.forEach(function (name) {
    groups.push({
      name: name,
      type: 'select',
      proxies: commonChoices.slice()
    });
  });

  config['proxy-groups'] = groups;

  // PROCESS-NAME 规则需要进程识别；strict 足够用于 Windows RemotePlay.exe。
  config['find-process-mode'] = 'strict';

  // 前置规则：优先于机场订阅原有 rules。
  const prependRules = [
    // PC 专用：PS Remote Play 全进程直连
    'PROCESS-NAME,RemotePlay.exe,DIRECT',

    // OpenAI / ChatGPT
    'DOMAIN-SUFFIX,chatgpt.com,💬 OpenAI',
    'DOMAIN-SUFFIX,openai.com,💬 OpenAI',
    'DOMAIN-SUFFIX,oaistatic.com,💬 OpenAI',
    'DOMAIN-SUFFIX,oaiusercontent.com,💬 OpenAI',
    'GEOSITE,openai,💬 OpenAI',

    // YouTube 必须放在 Google 前面
    'GEOSITE,youtube,📹 油管视频',

    // Google
    'GEOSITE,google,🔎 Google',

    // GitHub
    'DOMAIN-SUFFIX,github.com,💻 GitHub',
    'DOMAIN-SUFFIX,githubusercontent.com,💻 GitHub',
    'DOMAIN-SUFFIX,githubassets.com,💻 GitHub',
    'GEOSITE,github,💻 GitHub',

    // Pixiv / FANBOX
    'DOMAIN-SUFFIX,pixiv.net,🎨 Pixiv',
    'DOMAIN-SUFFIX,pximg.net,🎨 Pixiv',
    'DOMAIN-SUFFIX,fanbox.cc,🎨 Pixiv',
    'DOMAIN-SUFFIX,ads-pixiv.net,🎨 Pixiv',

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

    // Steam 商店 / 社区 / 创意工坊
    'GEOSITE,steam,🎮 Steam',

    // 其他游戏平台
    'GEOSITE,epicgames,🎮 Epic Games',
    'GEOSITE,origin,⚡ EA / Origin',
    'GEOSITE,ea,⚡ EA / Origin',
    'GEOSITE,xbox,🟩 Xbox',
    'GEOSITE,sony,🎮 PlayStation',
    'GEOSITE,playstation,🎮 PlayStation',
    'GEOSITE,nintendo,🕹️ Nintendo'
  ];

  const oldRules = Array.isArray(config.rules) ? config.rules : [];
  const seenRules = new Set();

  config.rules = prependRules.concat(oldRules).filter(function (rule) {
    if (seenRules.has(rule)) return false;
    seenRules.add(rule);
    return true;
  });

  return config;
}
