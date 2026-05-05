const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log("========================================");
    console.log("正在访问百度...");
    console.log("========================================");

    // 1. 访问百度
    await page.goto("https://www.baidu.com", { waitUntil: "domcontentloaded" });

    console.log("✓ 百度页面已加载");

    // 等待页面完全加载，尝试关闭可能的弹窗
    await page.waitForTimeout(2000);

    // 尝试按 Escape 键关闭可能的弹窗
    try {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
    } catch (e) {}

    // 2. 直接使用原生选择器输入搜索词
    try {
        await page.fill("#kw", "AI新闻");
        console.log("✓ 已输入搜索词: AI新闻");
    } catch (e) {
        console.log("尝试使用 JavaScript 输入");
        await page.evaluate(() => {
            document.querySelector("#kw").value = "AI新闻";
        });
    }

    await page.waitForTimeout(1000);

    // 3. 按 Enter 键提交搜索
    await page.keyboard.press("Enter");

    console.log("✓ 正在搜索...");

    // 4. 等待结果加载
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    console.log("✓ 搜索结果已加载");

    // 5. 截图
    await page.screenshot({
        path: "baidu-ai-news-search.png",
        fullPage: true,
    });

    // 6. 获取结果
    const results = [];
    const resultElements = await page.locator("div.result").all();

    console.log(`========================================`);
    console.log(`百度 "AI新闻" 搜索结果 - 前十条`);
    console.log(`========================================`);
    console.log(`总共找到 ${resultElements.length} 条结果\n`);

    const maxResults = Math.min(10, resultElements.length);

    for (let i = 0; i < maxResults; i++) {
        try {
            const result = resultElements[i];

            const titleElement = result.locator("h3 a").first();
            const title = await titleElement.textContent();
            const link = await titleElement.getAttribute("href");

            let summary = "";
            let source = "";

            try {
                summary = (await result.locator(".c-abstract").first().textContent()) || "";
            } catch (e) {}

            try {
                source = (await result.locator(".c-color-gray").first().textContent()) || "";
            } catch (e) {}

            const resultData = {
                index: i + 1,
                title: title?.trim() || "无标题",
                link: link || "无链接",
                summary: summary?.trim() || "",
                source: source?.trim() || "",
            };

            results.push(resultData);

            console.log(`${i + 1}. ${title?.trim()}`);
            console.log(`   链接: ${link}`);
            if (source) {
                console.log(`   来源: ${source?.trim()}`);
            }
            if (summary && summary.length > 0) {
                console.log(`   摘要: ${summary?.trim().substring(0, 80)}...`);
            }
            console.log("");
        } catch (error) {
            console.log(`${i + 1}. [解析错误: ${error.message}]`);
        }
    }

    console.log(`========================================`);
    console.log(`搜索完成！共获取 ${maxResults} 条结果`);
    console.log(`截图已保存: baidu-ai-news-search.png`);
    console.log(`========================================`);

    // 7. 保存 JSON 结果
    fs.writeFileSync("baidu-ai-news-results.json", JSON.stringify(results, null, 2), "utf-8");
    console.log(`✓ 结果已保存到: baidu-ai-news-results.json`);

    await browser.close();
    console.log("✓ 浏览器已关闭");
})();
