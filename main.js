/**
 * Pot Translator 插件的主入口函数
 * @param {string} base64 - Pot 截取的图片，以纯 base64 字符串格式传入（不带 data:image 前缀）
 * @param {string} lang - Pot 传递的源语言参数（如 "auto", "en", "zh_cn" 等）
 * @param {object} options - Pot 提供的插件上下文，包含用户的配置项 (config) 和内置工具箱 (utils)
 */
async function recognize(base64, lang, options) {
    // 解构获取配置和工具
    const { config, utils } = options;
    const { http, tauriFetch } = utils;
    
    // 1. 获取并处理 API 接口地址
    let endpoint = config.endpoint;
    if (!endpoint || endpoint.trim() === "") {
        // 如果用户未填写，则默认使用 LM Studio 的本地标准地址
        endpoint = "http://127.0.0.1:1234/v1/chat/completions";
    }
    
    // 2. 获取并处理模型名称
    let model = config.model;
    if (!model || model.trim() === "") {
        // 留空时默认传 local-model，LM Studio 会自动调用当前加载的模型
        model = "local-model";
    }
    
    // 3. 获取并组装提示词 (Prompt)
    let prompt = config.prompt;
    if (!prompt || prompt.trim() === "") {
        // 默认提示词：要求模型只输出提取的文字，不加废话
        prompt = "Please extract the text from the following image. Only output the extracted text, do not include any other explanations or formatting.";
    }

    // 如果 Pot 识别到了具体语言（且不是自动），则在提示词中追加语言要求，帮助模型提高识别率
    if (lang && lang !== "auto") {
        prompt += ` The primary language of the text is ${lang}.`;
    }

    // 4. 将纯 base64 字符串包装为符合 URI 规范的格式，供大模型读取
    base64 = `data:image/png;base64,${base64}`;

    // 5. 组装符合 OpenAI Vision API 标准的请求体
    let reqBody = {
        model: model,
        temperature: 0.1, // 降低温度，使模型输出更稳定、严谨，避免随机幻觉
        max_tokens: 2048, // 最大生成文本长度
        messages: [
            {
                role: "user",
                // Vision 模型要求 content 是一个数组，同时包含文本提示和图片内容
                content: [
                    {
                        type: "text",
                        text: prompt
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: base64
                        }
                    }
                ]
            }
        ]
    };

    // 6. 发送网络请求
    // 兼容 Pot 较新版本的写法：使用 utils.http.fetch
    if (http && http.fetch) {
        const { fetch, Body } = http;
        let res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // 将对象转为 JSON 格式的请求体
            body: Body.json(reqBody)
        });

        if (res.ok) {
            let result = res.data;
            // 判断是否成功获取到模型的回复
            if (result.choices && result.choices.length > 0) {
                // 去除收尾的空白字符并返回，Pot 拿到返回值后会展示在屏幕上
                return result.choices[0].message.content.trim();
            } else {
                throw JSON.stringify(result);
            }
        } else {
            // 请求失败时抛出异常，Pot 会将异常展示为报错提示
            throw JSON.stringify(res.data || res);
        }
    } 
    // 兼容 Pot 较老版本模板的写法：使用 utils.tauriFetch
    else if (tauriFetch) {
        let res = await tauriFetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: {
                type: "Json",
                payload: reqBody
            }
        });

        if (res.ok) {
            let result = res.data;
            if (result.choices && result.choices.length > 0) {
                return result.choices[0].message.content.trim();
            } else {
                throw JSON.stringify(result);
            }
        } else {
            throw JSON.stringify(res.data || res);
        }
    } else {
        // 如果两种请求方式都不存在，说明宿主环境不支持
        throw "No fetch method found in utils.";
    }
}
