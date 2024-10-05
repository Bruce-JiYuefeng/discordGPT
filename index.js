// 引入 dotenv/config 模块，加载环境变量
require('dotenv/config');

// 从 discord.js 库中导入必要的类和方法
const { Client, resolveBase64, messageLink } = require("discord.js");

// 从 openai 库中导入 OpenAI 类
const { OpenAI } = require('openai');

// 创建一个新的 Discord 客户端实例，指定需要的意图
const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent'],
});

// 当客户端成功登录并准备就绪时，输出一条日志信息
client.on('ready', () => {
    console.log('The bot is online now.');
});

// 定义忽略的消息前缀，即以该字符开头的消息将被机器人忽略
const IGNORE_PREFIX = '!';

// 定义允许机器人的频道 ID 列表，只有这些频道的消息会被处理
const CHANNELS_ID = ['1182565937128419418'];

// 创建一个新的 OpenAI 客户端实例，使用环境变量中的 API 密钥
const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

// 监听消息创建事件，当有新的消息时触发
client.on('messageCreate', async (message) => {
    // 如果消息的作者是机器人，直接返回不处理
    if (message.author.bot) 
        return;
    // 如果消息以忽略前缀开头，直接返回不处理
    if (message.content.startsWith(IGNORE_PREFIX)) 
        return;
    // 如果消息不在指定的频道，且没有提到机器人，直接返回不处理
    if (!CHANNELS_ID.includes(message.channelId) && !message.mentions.users.has(client.user.id))
        return;

    // 在频道中显示机器人正在输入的状态
    await message.channel.sendTyping();

    // 设置一个定时器，每隔 5 秒发送一次正在输入的状态，防止状态消失
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    },5000);

    // 初始化对话数组，用于存储聊天记录
    let conversation = [];
    conversation.push({
        role:'system',
        content:'chat gpt is a friendly chatbot.'
    });

    // 获取频道中最近的 10 条消息，构建对话上下文
    let prevMessages = await message.channel.messages.fetch({ limit: 10});

    // 遍历之前的消息，添加到对话数组中
    prevMessages.forEach((msg) => {
        // 如果消息来自机器人且不是本机器人，直接返回不处理
        if (msg.author.bot && msg.author.id !== client.user.id) return;
        // 如果消息以忽略前缀开头，直接返回不处理
        if (msg.content.startsWith(IGNORE_PREFIX)) return;

        // 获取用户名，并替换空格和特殊字符
        const username = msg.author.username.replace(/\s+/g,'_').replace(/[^\w\s]/gi,'');

        if (msg.author.id === client.user.id) {
            // 如果是机器人的消息，作为助手的回复添加到对话中
            conversation.push({
                role: 'assistant',
                name: username,
                content: msg.content,
            });
            return;
        }

        // 将用户的消息添加到对话中
        conversation.push({
            role: 'user',
            name: username,
            content: msg.content,
        });
    });

    // 向 OpenAI 发送请求，获取聊天回复
    const response = await openai.chat.completions
        .create({
            model:'gpt-4',
            messages: conversation,
        })
        .catch((error) => console.error('OpenAI error:\n', error));

    // 清除定时器，停止发送正在输入的状态
    clearInterval(sendTypingInterval);

    // 如果没有得到 OpenAI 的回复，提示用户稍后再试
    if (!response){
        message.reply("I'm having trouble with the openAI API. Try again in a moment.");
        return;
    }

    // 获取 OpenAI 的回复内容
    const responseMessage = response.choices[0].message.content;
    const chunkSizeLimit = 2000; // Discord 消息的最大长度限制

    // 如果回复过长，进行分段发送
    for (let i = 0; i < responseMessage.length; i += chunkSizeLimit){
        const chunk = responseMessage.substring(i,i + chunkSizeLimit);
        await message.reply(chunk);
    }
});

// 使用环境变量中的令牌登录 Discord 客户端
client.login(process.env.TOKEN);
