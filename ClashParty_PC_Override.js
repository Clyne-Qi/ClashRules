// Clash Party / Mihomo PC 端覆写
// 与路由器端当前逻辑同步：地区组、三层 AI 分流、统一游戏平台分流。
// PC 专用：PS Remote Play（RemotePlay.exe）强制 DIRECT。
// 不写死家庭内网 hosts，避免离开家庭网络后受影响。

function main(config) {
  if (!config || typeof config !== 'object') return config;

  const rawProxies = Array.isArray(config.proxies) ? config.proxies : [];
  const proxyNames = rawProxies
    .map(function (p) { return p && typeof p === 'object' ? p.name : null; })
    .filter(Boolean);

  const oldGroups = Array.isArray(config['proxy-groups']) ? config['proxy-groups'] : [];

  const REGION_NAMES = [
    '🇭🇰 香港节点',
    '🇺🇸 美国节点',
    '🇯🇵 日本节点',
    '🇨🇳 台湾节点',
    '🇸🇬 新加坡节点',
    '🇲🇾 马来西亚节点',
    '🇰🇷 韩国节点'
  ];

  const OLD_GAME_GROUPS = [
    '🎮 Steam',
    '🎮 Epic Games',
    '⚡ EA / Origin',
    '🟩 Xbox',
    '🎮 PlayStation',
    '🕹️ Nintendo'
  ];

  const CUSTOM_GROUPS = [
    '💬 OpenAI',
    '🤖 AI 服务',
    '🌐 AI 宽松',
    '🔎 Google',
    '📹 油管视频',
    '💻 GitHub',
    '🎨 Pixiv',
    '🎮 游戏服务'
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
    let group = groups.find(function (g) { return g && g.name === exactName; });
    if (!group && fallbackPattern) {
      group = groups.find(function (g) {
        return g && fallbackPattern.test(String(g.name || ''));
      });
    }
    return group || null;
  }

  function nodesForRegion(pattern) {
    return proxyNames.filter(function (name) { return pattern.test(name); });
  }

  function isRegionNode(name) {
    return REGION_NAMES.some(function (regionName) {
      return regionPatterns[regionName].test(name);
    });
  }

  const managedNames = new Set(REGION_NAMES.concat(CUSTOM_GROUPS).concat(OLD_GAME_GROUPS));

  const groups = oldGroups
    .filter(function (g) { return !g || !managedNames.has(g.name); })
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

  const regionGroups = REGION_NAMES.map(function (name) {
    const nodes = nodesForRegion(regionPatterns[name]);
    return { name: name, type: 'select', proxies: nodes.length ? nodes : ['REJECT'] };
  });
  groups.push.apply(groups, regionGroups);

  if (mainGroup) {
    const extraNodes = proxyNames.filter(function (name) {
      return !isRegionNode(name) && !subscriptionInfoPattern.test(name);
    });
    mainGroup.proxies = unique([autoGroupName].concat(REGION_NAMES).concat(extraNodes).concat(['DIRECT']));
  }

  const groupNames = new Set(groups.filter(function (g) { return g && g.name; }).map(function (g) { return g.name; }));
  function existing(name) { return groupNames.has(name) ? name : null; }
  function setGroupChoices(name, choices) {
    const group = groups.find(function (g) { return g && g.name === name; });
    if (group) group.proxies = unique(choices);
  }

  setGroupChoices('🌍 国外媒体', [mainGroupName].concat(REGION_NAMES).concat([autoGroupName, existing('🎯 全球直连')]));
  setGroupChoices('🌏 国内媒体', [existing('🎯 全球直连'), mainGroupName].concat(REGION_NAMES).concat([autoGroupName]));
  setGroupChoices('Ⓜ️ 微软服务', [existing('🎯 全球直连'), mainGroupName].concat(REGION_NAMES).concat([autoGroupName]));
  setGroupChoices('📲 电报信息', [mainGroupName].concat(REGION_NAMES).concat([autoGroupName, existing('🎯 全球直连')]));
  setGroupChoices('🍎 苹果服务', [mainGroupName].concat(REGION_NAMES).concat([autoGroupName, existing('🎯 全球直连')]));
  setGroupChoices('🎯 全球直连', ['DIRECT', mainGroupName].concat(REGION_NAMES));
  setGroupChoices('🛑 全球拦截', ['REJECT', 'DIRECT', mainGroupName, autoGroupName].concat(REGION_NAMES));
  setGroupChoices('🐟 漏网之鱼', [mainGroupName].concat(REGION_NAMES).concat([autoGroupName, existing('🎯 全球直连')]));

  const strictAi = ['🇺🇸 美国节点','🇯🇵 日本节点','🇸🇬 新加坡节点','🇨🇳 台湾节点','🇰🇷 韩国节点'];
  const relaxedAi = ['🇭🇰 香港节点'].concat(strictAi);
  const commonChoices = unique([mainGroupName].concat(REGION_NAMES).concat([autoGroupName, 'DIRECT']));
  const gameChoices = ['🇭🇰 香港节点','🇯🇵 日本节点','🇺🇸 美国节点','🇨🇳 台湾节点','🇸🇬 新加坡节点','🇲🇾 马来西亚节点','🇰🇷 韩国节点',mainGroupName,autoGroupName,'DIRECT'];

  groups.push({ name:'💬 OpenAI', type:'select', proxies:strictAi.slice() });
  groups.push({ name:'🤖 AI 服务', type:'select', proxies:strictAi.slice() });
  groups.push({ name:'🌐 AI 宽松', type:'select', proxies:relaxedAi.slice() });
  groups.push({ name:'🔎 Google', type:'select', proxies:commonChoices.slice() });
  groups.push({ name:'📹 油管视频', type:'select', proxies:commonChoices.slice() });
  groups.push({ name:'💻 GitHub', type:'select', proxies:commonChoices.slice() });
  groups.push({ name:'🎨 Pixiv', type:'select', proxies:commonChoices.slice() });
  groups.push({ name:'🎮 游戏服务', type:'select', proxies:unique(gameChoices) });

  // 显示顺序：把所有地区组移动到“♻️ 自动选择”后面，方便直接测速/切换。
  const regionalGroupSet = new Set(REGION_NAMES);
  const movedRegionGroups = groups.filter(function (g) {
    return g && regionalGroupSet.has(g.name);
  });
  const otherGroups = groups.filter(function (g) {
    return !g || !regionalGroupSet.has(g.name);
  });
  const autoIndex = otherGroups.findIndex(function (g) {
    return g && g.name === autoGroupName;
  });
  const orderedGroups = autoIndex >= 0
    ? otherGroups.slice(0, autoIndex + 1)
        .concat(movedRegionGroups)
        .concat(otherGroups.slice(autoIndex + 1))
    : otherGroups.concat(movedRegionGroups);

  config['proxy-groups'] = orderedGroups;

  config['find-process-mode'] = 'strict';

  const prependRules = [
    'PROCESS-NAME,RemotePlay.exe,DIRECT',

    'DOMAIN-SUFFIX,openai.com,💬 OpenAI',
    'DOMAIN-SUFFIX,chatgpt.com,💬 OpenAI',
    'DOMAIN-SUFFIX,chat.com,💬 OpenAI',
    'DOMAIN-SUFFIX,oaistatic.com,💬 OpenAI',
    'DOMAIN-SUFFIX,oaiusercontent.com,💬 OpenAI',
    'DOMAIN-SUFFIX,sora.com,💬 OpenAI',
    'GEOSITE,openai,💬 OpenAI',

    'DOMAIN-SUFFIX,gemini.google.com,🌐 AI 宽松',
    'DOMAIN-SUFFIX,bard.google.com,🌐 AI 宽松',
    'DOMAIN-SUFFIX,x.ai,🌐 AI 宽松',
    'DOMAIN-SUFFIX,grok.com,🌐 AI 宽松',
    'DOMAIN-SUFFIX,poe.com,🌐 AI 宽松',
    'DOMAIN-SUFFIX,poecdn.net,🌐 AI 宽松',

    'DOMAIN-SUFFIX,anthropic.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,claude.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,claude.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,claudeusercontent.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,clau.de,🤖 AI 服务',
    'DOMAIN-SUFFIX,aistudio.google.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,makersuite.google.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,notebooklm.google.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,notebooklm.google,🤖 AI 服务',
    'DOMAIN-SUFFIX,generativelanguage.googleapis.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,alkalimakersuite-pa.clients6.google.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,proactivebackend-pa.googleapis.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,ai.google.dev,🤖 AI 服务',
    'DOMAIN-SUFFIX,deepmind.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,deepmind.google,🤖 AI 服务',
    'DOMAIN-SUFFIX,perplexity.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,pplx.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,cursor.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,cursor.sh,🤖 AI 服务',
    'DOMAIN-SUFFIX,cursorapi.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,githubcopilot.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,copilot.microsoft.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,character.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,midjourney.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,huggingface.co,🤖 AI 服务',
    'DOMAIN-SUFFIX,mistral.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,openrouter.ai,🤖 AI 服务',
    'DOMAIN-SUFFIX,elevenlabs.io,🤖 AI 服务',
    'DOMAIN-SUFFIX,suno.com,🤖 AI 服务',
    'DOMAIN-SUFFIX,suno.ai,🤖 AI 服务',

    'GEOSITE,youtube,📹 油管视频',
    'GEOSITE,google,🔎 Google',

    'DOMAIN-SUFFIX,github.com,💻 GitHub',
    'DOMAIN-SUFFIX,githubusercontent.com,💻 GitHub',
    'DOMAIN-SUFFIX,githubassets.com,💻 GitHub',
    'GEOSITE,github,💻 GitHub',

    'DOMAIN-SUFFIX,pixiv.net,🎨 Pixiv',
    'DOMAIN-SUFFIX,pximg.net,🎨 Pixiv',
    'DOMAIN-SUFFIX,fanbox.cc,🎨 Pixiv',
    'DOMAIN-SUFFIX,ads-pixiv.net,🎨 Pixiv',

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

    'GEOSITE,steam,🎮 游戏服务',
    'GEOSITE,epicgames,🎮 游戏服务',
    'GEOSITE,origin,🎮 游戏服务',
    'GEOSITE,ea,🎮 游戏服务',
    'GEOSITE,xbox,🎮 游戏服务',
    'GEOSITE,sony,🎮 游戏服务',
    'GEOSITE,playstation,🎮 游戏服务',
    'GEOSITE,nintendo,🎮 游戏服务'
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
