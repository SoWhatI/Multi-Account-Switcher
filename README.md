# Multi-Account Switcher（Chrome插件）
一款基于Chrome Manifest V3开发的浏览器插件，支持保存网站的不同账号Cookie（包括httpOnly类型）和LocalStorage数据，并一键切换账号数据，实现多账号快速登录。

## 功能特点
- 🚀 **自动识别域名**：自动获取当前标签页的网站域名，无需手动输入
- 💾 **保存Cookie和LocalStorage**：将当前网站的所有Cookie（含httpOnly）和LocalStorage数据绑定到自定义账号名称，持久化存储在Chrome本地
- 🔄 **切换账号数据**：一键切换到指定账号的Cookie和LocalStorage数据，自动删除现有数据并恢复目标数据，刷新页面生效
- ❌ **删除账号数据**：删除已保存的账号Cookie和LocalStorage数据，操作简单
- 🔒 **支持httpOnly Cookie**：完美处理网站的httpOnly类型登录Cookie（大部分网站的登录凭证为该类型）
- 📱 **简洁界面**：轻量化弹窗界面，操作流程清晰

## 技术栈
- Chrome Extension Manifest V3
- JavaScript（异步API处理）
- Chrome Cookies API / Storage API / Tabs API
- HTML + CSS（原生界面）

## 安装步骤
### 方式二：打包安装（可选）
1. **下载插件包**：从[Release页面](https://github.com/SoWhatI/Multi-Account-Switcher/releases)下载最新版本的插件包。
2. **打开Chrome扩展页面**：在Chrome浏览器地址栏输入 `chrome://extensions/` 并回车。
3. **开启开发者模式**：点击页面右上角的「开发者模式」开关，使其处于开启状态。
4. **拖放安装**：将下载的插件包（`.zip`文件）直接拖放到Chrome扩展页面，页面会自动识别并安装插件。

## 使用说明
### 1. 保存账号数据
1. 打开目标网站并登录你的账号（如账号1）。
2. 点击Chrome扩展栏中的插件图标，打开插件弹窗。
3. 在「账号名称」输入框中输入标识名称（如「工作账号」「账号1」）。
4. 点击「保存当前Cookie和LocalStorage到该账号」按钮，提示保存成功即完成。

### 2. 切换账号数据
1. 确保目标网站处于当前标签页。
2. 打开插件弹窗，在「选择要切换的账号」下拉框中选择已保存的账号。
3. 点击「切换到选中账号的Cookie和LocalStorage」按钮，插件会自动删除当前网站的Cookie和LocalStorage、恢复目标账号数据，并刷新页面使登录状态生效。

### 3. 删除账号数据
1. 打开插件弹窗，在下拉框中选择要删除的账号。
2. 点击「删除选中账号的数据」按钮，确认后即可删除该账号的Cookie和LocalStorage数据（不可恢复）。

## 注意事项
1. **插件图标**：项目中需自行准备一张128x128像素的图片作为`icon.png`，替换示例图标。
2. **权限说明**：插件声明了`<all_urls>`主机权限，可操作所有网站的Cookie；若仅需操作特定网站，可修改`manifest.json`中的`host_permissions`为具体域名（如`"https://*.baidu.com/*"`）。
3. **Cookie兼容性**：
   - 部分网站的登录凭证可能包含多个Cookie，插件会完整保存和恢复所有Cookie。
   - HTTP协议的网站无法设置`secure: true`的Cookie，插件会自动适配协议调整该属性。
4. **日志查看**：若操作失败，可右键插件弹窗→「检查」→「Console」标签查看详细错误日志。
5. **数据存储**：Cookie数据存储在Chrome的`chrome.storage.local`中，清除Chrome本地数据会导致保存的账号Cookie丢失。

## 常见问题
### Q1：切换Cookie失败，提示“请查看控制台日志”？
A1：原因及解决方法：
- 插件弹窗有独立控制台，需右键插件弹窗→「检查」→「Console」查看具体错误。
- 常见原因：Cookie的`sameSite`属性无效、`secure`属性与网站协议不匹配（插件已做兼容处理，若仍报错可查看日志定位）。

### Q2：无法保存httpOnly类型的Cookie？
A2：插件通过Chrome Cookies API操作Cookie，不受httpOnly限制，若无法保存请检查：
- 插件是否声明了`cookies`权限和对应网站的`host_permissions`。
- 当前网站是否有httpOnly Cookie（可通过浏览器开发者工具→Application→Cookies查看）。

### Q3：切换后网站未登录？
A3：可能原因：
- Cookie的过期时间已失效，需重新保存账号数据。
- 网站使用了额外的安全机制（如IP绑定、设备指纹等）导致账号切换失败。

## 许可证
本项目为开源学习用途，可自由修改和分发，禁止用于商业或恶意用途。