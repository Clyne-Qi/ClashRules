# ClashRules

自用 Clash / OpenClash 分流规则。

## 路由器端（OpenClash）

远程覆写订阅：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ACL4SSR_Online_Full_%E8%B7%AF%E7%94%B1%E5%99%A8%E8%87%AA%E7%94%A8%E4%BF%AE%E6%94%B9%E7%89%88.yaml

## Android 端（FlClash / Mihomo）

JavaScript 覆写：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/FlClash_Android_Override.js

Android 端版本基于当前路由器端分流逻辑整理，保留机场原有节点、策略组与规则，动态生成地区节点组并前置个人分流规则。

与路由器端相比，Android 端不包含 PS5 局域网源地址直连规则，也不写死 `clyne.top -> 192.168.6.100` 的家庭内网解析，避免手机离开家庭网络后受到影响。

## PC 端（Clash Party / Mihomo）

JavaScript 覆写：

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ClashParty_PC_Override.js

PC 端当前仍为旧版分流逻辑，后续将按新版路由器端规则更新；目前额外包含 PS Remote Play 的 `RemotePlay.exe` 强制直连。

## 旧版完整配置

https://raw.githubusercontent.com/Clyne-Qi/ClashRules/main/ACL4SSR_Online_Full_%E8%87%AA%E7%94%A8%E4%BF%AE%E6%94%B9%E7%89%88.yaml
