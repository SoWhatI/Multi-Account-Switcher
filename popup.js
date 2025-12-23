// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async () => {
  // 1. 获取当前标签页的域名并显示
  await initCurrentDomain();
  // 2. 加载已保存的账号列表
  await loadAccountList();
  // 3. 绑定按钮事件
  bindEvents();
});

/**
 * 获取当前标签页的域名
 */
async function initCurrentDomain() {
  try {
    // 获取当前激活的标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url) {
      document.getElementById('domain').value = '无法获取域名（非网页页面）';
      return;
    }
    // 解析URL获取域名（如：https://www.baidu.com → baidu.com）
    const url = new URL(tab.url);
    const domain = url.hostname;
    document.getElementById('domain').value = domain;
  } catch (error) {
    document.getElementById('domain').value = '获取域名失败';
    console.error('获取当前标签页域名失败：', error);
  }
}

/**
 * 加载已保存的账号列表到下拉框
 */
async function loadAccountList() {
  const domain = document.getElementById('domain').value;
  if (!domain || domain.includes('无法获取') || domain.includes('获取失败')) {
    return;
  }

  // 从Chrome存储中获取所有账号的Cookie数据
  const storedData = await chrome.storage.local.get('cookieAccounts');
  const cookieAccounts = storedData.cookieAccounts || {};
  const accountSelect = document.getElementById('accountSelect');

  // 清空下拉框
  accountSelect.innerHTML = '';

  // 获取当前域名下的所有账号
  const domainAccounts = cookieAccounts[domain] || {};
  const accountNames = Object.keys(domainAccounts);

  if (accountNames.length === 0) {
    accountSelect.innerHTML = '<option value="">-- 暂无保存的账号 --</option>';
    return;
  }

  // 填充下拉框
  accountNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    accountSelect.appendChild(option);
  });
}

/**
 * 绑定按钮的点击事件
 */
function bindEvents() {
  // 保存Cookie按钮
  document.getElementById('saveBtn').addEventListener('click', saveCurrentCookie);
  // 切换Cookie按钮
  document.getElementById('switchBtn').addEventListener('click', switchToSelectedAccount);
  // 删除Cookie按钮
  document.getElementById('deleteBtn').addEventListener('click', deleteSelectedAccount);
}

/**
 * 保存当前页面的Cookie和localStorage到指定账号
 */
async function saveCurrentCookie() {
  const domain = document.getElementById('domain').value;
  const accountName = document.getElementById('accountName').value.trim();

  // 校验参数
  if (!domain || domain.includes('无法获取') || domain.includes('获取失败')) {
    alert('当前页面无法获取有效域名，无法保存Cookie和LocalStorage！');
    return;
  }
  if (!accountName) {
    alert('请输入账号名称！');
    return;
  }

  try {
    // 1. 读取当前域名和其父域名的Cookie（不包括其他子域名）
    // 获取当前域名的Cookie（如 www.v2ex.com）
    let allCookies = [];
    
    // 获取父域名的Cookie（如 .v2ex.com），但排除其他子域名的Cookie
    const parentDomain = domain.split('.').slice(1).join('.');
    if (parentDomain && parentDomain.includes('.')) { // 确保是有效的父域名
      // 获取父域名的所有Cookie
      const allParentCookies = await chrome.cookies.getAll({ domain: `.${parentDomain}` });
      // 过滤出当前域名可能共享的父域名Cookie
      allCookies = allParentCookies.filter(cookie => {
        // 只保留没有特定子域名限制的父域名Cookie，或明确适用于当前域名的Cookie
        return !cookie.domain || cookie.domain === `.${parentDomain}` || 
               cookie.domain === parentDomain || 
               domain.endsWith(cookie.domain.replace(/^\./, ''));
      });
    }
    
    // 2. 获取当前页面的localStorage数据
    const localStorageData = await getCurrentLocalStorage();
    
    // 3. 检查是否有数据可保存
    if (allCookies.length === 0 && Object.keys(localStorageData).length === 0) {
      alert('当前网站暂无Cookie和LocalStorage数据可保存！');
      return;
    }

    // 4. 从存储中获取现有数据
    const storedData = await chrome.storage.local.get('cookieAccounts');
    const cookieAccounts = storedData.cookieAccounts || {};

    // 5. 保存当前域名的账号数据（结构：{ 域名: { 账号名: { cookies: [cookie数组], localStorage: { key: value } } } }）
    if (!cookieAccounts[domain]) {
      cookieAccounts[domain] = {};
    }
    cookieAccounts[domain][accountName] = {
      cookies: allCookies,
      localStorage: localStorageData
    };

    // 6. 存储到Chrome本地存储
    await chrome.storage.local.set({ cookieAccounts: cookieAccounts });

    alert(`成功保存“${accountName}”的Cookie和LocalStorage数据！`);
    // 刷新账号列表
    await loadAccountList();
    // 清空账号名称输入框
    document.getElementById('accountName').value = '';
  } catch (error) {
    console.error('保存Cookie和LocalStorage失败：', error);
    alert('保存Cookie和LocalStorage失败，请查看控制台日志！');
  }
}

/**
 * 切换到选中账号的Cookie和localStorage
 */
async function switchToSelectedAccount() {
  const domain = document.getElementById('domain').value;
  const accountSelect = document.getElementById('accountSelect');
  const selectedAccount = accountSelect.value;

  // 校验参数
  if (!domain || domain.includes('无法获取') || domain.includes('获取失败')) {
    alert('当前页面无法获取有效域名，无法切换Cookie和LocalStorage！');
    return;
  }
  if (!selectedAccount) {
    alert('请选择要切换的账号！');
    return;
  }

  try {
    // 1. 从存储中获取该账号的数据
    const storedData = await chrome.storage.local.get('cookieAccounts');
    const cookieAccounts = storedData.cookieAccounts || {};
    const targetAccountData = cookieAccounts[domain]?.[selectedAccount];

    if (!targetAccountData || 
        (targetAccountData.cookies.length === 0 && Object.keys(targetAccountData.localStorage).length === 0)) {
      alert(`未找到“${selectedAccount}”的Cookie和LocalStorage数据！`);
      return;
    }

    // 2. 删除当前域名的所有Cookie
    await deleteAllDomainCookies(domain);
    
    // 3. 清空当前页面的localStorage
    await clearCurrentLocalStorage();

    // 4. 逐个添加目标账号的Cookie
    for (const cookie of targetAccountData.cookies) {
      // 构建Cookie配置（过滤掉不需要的属性，避免set方法报错）
      const cookieConfig = {
        name: cookie.name,
        value: cookie.value,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      };
      
      // 构造url参数（这是cookies.set方法必需的）
      const protocol = cookie.secure ? 'https://' : 'http://';
      // 处理通配符域名的问题（如：.baidu.com → baidu.com）
      let cookieDomain = cookie.domain;
      if (cookieDomain.startsWith('.')) {
        cookieConfig.domain = cookieDomain;
        // URL中不能包含开头的点，但cookie的domain属性需要保留
        cookieDomain = cookieDomain.substring(1);
      }
      cookieConfig.url = `${protocol}${cookieDomain}${cookie.path || '/'}`;
      await chrome.cookies.set(cookieConfig);
    }
    
    // 5. 设置目标账号的localStorage数据
    await setCurrentLocalStorage(targetAccountData.localStorage);

    // 6. 刷新当前标签页使Cookie和LocalStorage生效
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.reload(tab.id);

    alert(`已成功切换到“${selectedAccount}”的Cookie和LocalStorage，页面已刷新！`);
  } catch (error) {
    console.error('切换Cookie和LocalStorage失败：', error);
    alert('切换Cookie和LocalStorage失败，请查看控制台日志！');
  }
}

/**
 * 删除选中账号的Cookie和localStorage数据
 */
async function deleteSelectedAccount() {
  const domain = document.getElementById('domain').value;
  const accountSelect = document.getElementById('accountSelect');
  const selectedAccount = accountSelect.value;

  // 校验参数
  if (!domain || domain.includes('无法获取') || domain.includes('获取失败')) {
    alert('当前页面无法获取有效域名，无法删除账号数据！');
    return;
  }
  if (!selectedAccount) {
    alert('请选择要删除的账号！');
    return;
  }

  if (!confirm(`确定要删除“${selectedAccount}”的Cookie和LocalStorage数据吗？此操作不可恢复！`)) {
    return;
  }

  try {
    // 1. 从存储中获取现有数据
    const storedData = await chrome.storage.local.get('cookieAccounts');
    const cookieAccounts = storedData.cookieAccounts || {};

    // 2. 删除指定账号的数据
    if (cookieAccounts[domain]?.[selectedAccount]) {
      delete cookieAccounts[domain][selectedAccount];
      // 如果该域名下没有账号了，删除域名节点
      if (Object.keys(cookieAccounts[domain]).length === 0) {
        delete cookieAccounts[domain];
      }
      // 3. 保存修改后的数据
      await chrome.storage.local.set({ cookieAccounts: cookieAccounts });
      alert(`已成功删除“${selectedAccount}”的Cookie和LocalStorage数据！`);
      // 4. 刷新账号列表
      await loadAccountList();
    } else {
      alert(`未找到“${selectedAccount}”的账号数据！`);
    }
  } catch (error) {
    console.error('删除账号数据失败：', error);
    alert('删除账号数据失败，请查看控制台日志！');
  }
}

/**
 * 删除指定域名的所有Cookie
 * @param {string} domain 目标域名
 */
async function deleteAllDomainCookies(domain) {
  // 获取父域名的Cookie（如 .v2ex.com），但排除其他子域名的Cookie
  const parentDomain = domain.split('.').slice(1).join('.');
  let allCookies = [];
  if (parentDomain && parentDomain.includes('.')) { // 确保是有效的父域名
    // 获取父域名的所有Cookie
    const allParentCookies = await chrome.cookies.getAll({ domain: `.${parentDomain}` });
    // 过滤出当前域名可能共享的父域名Cookie
    allCookies = allParentCookies.filter(cookie => {
      // 只删除没有特定子域名限制的父域名Cookie，或明确适用于当前域名的Cookie
      return !cookie.domain || cookie.domain === `.${parentDomain}` || 
             cookie.domain === parentDomain || 
             domain.endsWith(cookie.domain.replace(/^\./, ''));
    });
  }
  
  for (const cookie of allCookies) {
    // 构建删除Cookie的URL（Manifest V3需要url参数）
    // 处理通配符域名的问题（如：.baidu.com → baidu.com）
    let cookieDomain = cookie.domain;
    if (cookieDomain.startsWith('.')) {
      // URL中不能包含开头的点
      cookieDomain = cookieDomain.substring(1);
    }
    const url = `${cookie.secure ? 'https://' : 'http://'}${cookieDomain}${cookie.path}`;
    await chrome.cookies.remove({
      name: cookie.name,
      url: url
    });
  }
}

/**
 * 获取当前标签页的localStorage数据
 * @returns {Promise<Object>} localStorage数据对象
 */
async function getCurrentLocalStorage() {
  try {
    // 获取当前激活的标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 执行脚本获取localStorage
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const localStorageData = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          localStorageData[key] = localStorage.getItem(key);
        }
        return localStorageData;
      }
    });
    
    return results[0].result || {};
  } catch (error) {
    console.error('获取localStorage失败：', error);
    return {};
  }
}

/**
 * 设置当前标签页的localStorage数据
 * @param {Object} localStorageData 要设置的localStorage数据
 */
async function setCurrentLocalStorage(localStorageData) {
  try {
    // 获取当前激活的标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 执行脚本设置localStorage
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [localStorageData],
      func: (data) => {
        // 清空当前localStorage
        localStorage.clear();
        
        // 设置新的localStorage数据
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            localStorage.setItem(key, data[key]);
          }
        }
      }
    });
  } catch (error) {
    console.error('设置localStorage失败：', error);
  }
}

/**
 * 清空当前标签页的localStorage
 */
async function clearCurrentLocalStorage() {
  try {
    // 获取当前激活的标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 执行脚本清空localStorage
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        localStorage.clear();
      }
    });
  } catch (error) {
    console.error('清空localStorage失败：', error);
  }
}