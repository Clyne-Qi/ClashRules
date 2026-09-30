#!/usr/bin/lua
-- OpenClash / Mihomo 节点守护器
-- 仅监控美国、香港两个手动选择组。
--
-- 逻辑：
-- 1. 每次运行读取地区组当前选中的节点。
-- 2. 对当前节点连续测速 3 次，间隔 3 秒。
-- 3. 只有 3 次全部 > 800ms 或测速失败，才触发该地区全量测速。
-- 4. 全量测速后，仅当存在 <= 800ms 的可用节点时，切换到其中延迟最低者。
-- 5. 若整个地区都不可用或都 > 800ms，则保持当前选择，不跨地区切换。
--
-- 建议由 cron 每分钟调用一次：
-- * * * * * /usr/share/openclash/openclash_node_watchdog.lua >/dev/null 2>&1

local sys = require "luci.sys"
local json = require "luci.jsonc"
local uci = require("luci.model.uci").cursor()

local GROUPS = {
  "🇺🇸 美国节点",
  "🇭🇰 香港节点"
}

local THRESHOLD_MS = 800
local CHECK_COUNT = 3
local CHECK_INTERVAL_SEC = 3
local TEST_TIMEOUT_MS = 5000
local CURL_TIMEOUT_SEC = 7
local TEST_URL = "https://www.gstatic.com/generate_204"

local controller_port = uci:get("openclash", "config", "cn_port") or "9090"
local dashboard_secret = uci:get("openclash", "config", "dashboard_password") or ""
local base_url = "http://127.0.0.1:" .. controller_port

local function shell_quote(value)
  value = tostring(value or "")
  return "'" .. value:gsub("'", "'\\''") .. "'"
end

local function urlencode(value)
  value = tostring(value or "")
  return (value:gsub("([^%w%-_%.~])", function(c)
    return string.format("%%%02X", string.byte(c))
  end))
end

local function log(message)
  sys.call("logger -t openclash-watchdog " .. shell_quote(message))
end

local function auth_args()
  if dashboard_secret == "" then
    return ""
  end
  return " -H " .. shell_quote("Authorization: Bearer " .. dashboard_secret)
end

local function http_get_json(path)
  local cmd =
    "curl -fsS -m " .. tostring(CURL_TIMEOUT_SEC) ..
    auth_args() ..
    " -H " .. shell_quote("Accept: application/json") ..
    " " .. shell_quote(base_url .. path) ..
    " 2>/dev/null"

  local body = sys.exec(cmd)
  if not body or body == "" then
    return nil
  end

  local ok, parsed = pcall(json.parse, body)
  if not ok then
    return nil
  end
  return parsed
end

local function http_put_json(path, payload)
  local body = json.stringify(payload)
  local cmd =
    "curl -fsS -m " .. tostring(CURL_TIMEOUT_SEC) ..
    auth_args() ..
    " -H " .. shell_quote("Content-Type: application/json") ..
    " -X PUT --data " .. shell_quote(body) ..
    " " .. shell_quote(base_url .. path) ..
    " >/dev/null 2>&1"

  return sys.call(cmd) == 0
end

local function get_group_current(group_name)
  local info = http_get_json("/proxies/" .. urlencode(group_name))
  if type(info) ~= "table" then
    return nil
  end
  if type(info.now) ~= "string" or info.now == "" then
    return nil
  end
  return info.now
end

local function test_node(node_name)
  local path =
    "/proxies/" .. urlencode(node_name) ..
    "/delay?url=" .. urlencode(TEST_URL) ..
    "&timeout=" .. tostring(TEST_TIMEOUT_MS) ..
    "&expected=204"

  local result = http_get_json(path)
  if type(result) ~= "table" then
    return nil
  end

  local delay = tonumber(result.delay)
  if not delay or delay <= 0 then
    return nil
  end
  return delay
end

local function full_group_test(group_name)
  local path =
    "/group/" .. urlencode(group_name) ..
    "/delay?url=" .. urlencode(TEST_URL) ..
    "&timeout=" .. tostring(TEST_TIMEOUT_MS) ..
    "&expected=204"

  local result = http_get_json(path)
  if type(result) ~= "table" then
    return nil
  end
  return result
end

local function choose_best_acceptable(delays)
  local best_name = nil
  local best_delay = nil

  for name, delay_value in pairs(delays or {}) do
    local delay = tonumber(delay_value)
    if delay and delay > 0 and delay <= THRESHOLD_MS then
      if not best_delay or delay < best_delay then
        best_name = name
        best_delay = delay
      end
    end
  end

  return best_name, best_delay
end

local function monitor_group(group_name)
  local current = get_group_current(group_name)
  if not current then
    log(group_name .. "：无法读取当前节点，跳过")
    return
  end

  local bad_count = 0
  local samples = {}

  for i = 1, CHECK_COUNT do
    local delay = test_node(current)
    if delay then
      samples[#samples + 1] = tostring(delay) .. "ms"
      if delay > THRESHOLD_MS then
        bad_count = bad_count + 1
      end
    else
      samples[#samples + 1] = "失败"
      bad_count = bad_count + 1
    end

    if i < CHECK_COUNT then
      sys.call("sleep " .. tostring(CHECK_INTERVAL_SEC))
    end
  end

  -- 三次没有全部异常：保持当前节点，避免测速波动导致误切换。
  if bad_count < CHECK_COUNT then
    return
  end

  log(
    group_name .. " 当前节点 [" .. current .. "] 连续异常：" ..
    table.concat(samples, ", ") .. "，开始全组测速"
  )

  local delays = full_group_test(group_name)
  if not delays then
    log(group_name .. "：全组测速失败，保持当前节点 [" .. current .. "]")
    return
  end

  local best_name, best_delay = choose_best_acceptable(delays)
  if not best_name then
    log(group_name .. "：没有 <= " .. tostring(THRESHOLD_MS) .. "ms 的可用节点，保持 [" .. current .. "]")
    return
  end

  if best_name == current then
    log(group_name .. "：全组测速时当前节点恢复为 " .. tostring(best_delay) .. "ms，保持 [" .. current .. "]")
    return
  end

  local ok = http_put_json(
    "/proxies/" .. urlencode(group_name),
    { name = best_name }
  )

  if ok then
    log(
      group_name .. "：已从 [" .. current .. "] 切换到 [" ..
      best_name .. "]，全组测速延迟 " .. tostring(best_delay) .. "ms"
    )
  else
    log(group_name .. "：切换到 [" .. best_name .. "] 失败，保持 [" .. current .. "]")
  end
end

-- OpenClash 未运行或 API 不可达时直接退出。
local version = http_get_json("/version")
if not version then
  os.exit(0)
end

for _, group_name in ipairs(GROUPS) do
  monitor_group(group_name)
end
