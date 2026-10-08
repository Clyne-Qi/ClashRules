# ClashRules

自用 Clash / OpenClash 分流规则。

## 路由器端（OpenClash）

远程覆写订阅：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ACL4SSR_Online_Full_%E8%B7%AF%E7%94%B1%E5%99%A8%E8%87%AA%E7%94%A8%E4%BF%AE%E6%94%B9%E7%89%88.yaml

### 美国 / 香港节点守护器

脚本：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/OpenClash_Node_Watchdog.lua

只监控 `🇺🇸 美国节点` 与 `🇭🇰 香港节点`。建议通过 cron 每分钟运行一次。

当前逻辑：

- 读取地区组当前手动选中的节点。
- 连续测速 3 次，每次间隔 3 秒。
- 只有 3 次全部高于 800ms 或测速失败，才触发该地区全量测速。
- 全量测速后，仅在存在不高于 800ms 的节点时，切换到延迟最低者。
- 如果整个地区都不可用或都高于 800ms，则保持原节点，不跨地区切换。

安装示例：

```sh
wget -O /etc/openclash/openclash_node_watchdog.lua \
  https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/OpenClash_Node_Watchdog.lua

chmod +x /etc/openclash/openclash_node_watchdog.lua

grep -q 'openclash_node_watchdog.lua' /etc/crontabs/root || \
  echo '* * * * * /etc/openclash/openclash_node_watchdog.lua >/dev/null 2>&1' >> /etc/crontabs/root

/etc/init.d/cron restart
```

脚本自动读取 OpenClash 的 Dashboard 端口（`cn_port`）和密钥（`dashboard_password`），通过本机 Mihomo REST API 测速和切换，不需要额外在脚本内填写密码。

查看切换记录：

```sh
logread | grep openclash-watchdog
```

### 当前分流结构

- `💬 OpenAI`：独立保障，默认美国。
- `🤖 AI 服务`：严格 AI，默认美国；用于 Claude、AI Studio / Gemini API、NotebookLM 及尚未确认香港支持的 AI。
- `🌐 AI 宽松`：默认香港；用于 Gemini 网页版、Grok、Poe 等已确认香港可用的服务。
- `🎮 游戏服务`：Steam / Epic / EA / Xbox / PlayStation / Nintendo 统一分组，默认香港；Steam 下载/CDN 与 PS5 游戏/系统更新继续按前置规则直连。
- `🔎 Google` 与 `📹 油管视频` 继续独立。

## Android 端（FlClash / Mihomo）

JavaScript 覆写：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/FlClash_Android_Override.js

Android 端版本基于当前路由器端分流逻辑整理，保留机场原有节点、策略组与规则，动态生成地区节点组并前置个人分流规则。

与路由器端相比，Android 端不包含 PS5 局域网源地址直连规则，也不写死 `clyne.top -> 192.168.6.100` 的家庭内网解析，避免手机离开家庭网络后受到影响。

## PC 端（Clash Party / Mihomo）

JavaScript 覆写：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ClashParty_PC_Override.js

PC 端已同步当前路由器端分流逻辑：OpenAI 独立保障；AI 分为严格与香港宽松两组；Steam / Epic / EA / Xbox / PlayStation / Nintendo 统一并入 `🎮 游戏服务`，默认香港；并额外将 PS Remote Play 的 `RemotePlay.exe` 强制直连。

## 旧版完整配置

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ACL4SSR_Online_Full_%E8%87%AA%E7%94%A8%E4%BF%AE%E6%94%B9%E7%89%88.yaml
