"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/**
 * Site language (EN / 中文). Remembered per browser; first visit follows the browser's
 * language. Server render is English, then the client switches if needed.
 *
 * Adding a language: copy `en`, translate, add it to DICTS and SITE_LANGS. TypeScript
 * makes every dictionary match `en` key for key.
 *
 * Not translated on purpose: user greetings (they're the sender's words), wallet names,
 * "Powered by CoinGecko API" (attribution wording), and server API error messages.
 */
export type SiteLang = "en" | "zh";
export const SITE_LANGS: { key: SiteLang; label: string }[] = [
  { key: "en", label: "EN" },
  { key: "zh", label: "中文" },
];

const en = {
  brand: { name: "Onchain Angpao", zh: "链上红包" },
  nav: { create: "Create", dashboard: "Dashboard", connect: "Connect Wallet", connectShort: "Connect", language: "Language" },
  mainnetWarning: "⚠️ Mainnet: real money. Use small amounts only and check your local rules.",
  wallet: {
    connecting: "Connecting...",
    balance: "Balance",
    copyAddress: "Copy address",
    copied: "Copied!",
    explorer: "Explorer",
    disconnect: "Disconnect",
    toggleTheme: "Toggle theme",
  },
  footer: {
    openSourceA: "Open source on",
    openSourceB: ". Fork it, star it, make it yours.",
    feedback: "Feedback or ideas? Find me on X:",
  },
  home: {
    pill: "Red packets on Solana",
    mainnetSoon: "Mainnet coming soon this GOAT CNY 2027",
    h1a: "Send an angpao.",
    h1b: "Let friends & family race for blessings.",
    tagline: "发红包，抢好运！",
    sub: "Split SOL into lucky or equal packets. Your friends and family claim in seconds, even if they've never touched crypto.",
    ethos: "Angpao is more than red envelopes. It’s a gesture of care, respect, and blessings.",
    ctaCreate: "Create angpao 🧧",
    ctaMine: "My angpaos",
    newToCrypto: "New to crypto?",
    noWalletTitle: "No wallet? No problem.",
    noWalletSub: "Grandma, your cousins, the office group chat: anyone can claim, even with zero onchain experience.",
    points: {
      walletTitle: "Free wallet in one tap",
      walletSocial: "We create one instantly, linked to their email or Google account.",
      walletBurner: "We create one instantly in their browser. No app or sign-up.",
      feesTitle: "Zero fees to claim",
      feesBody: "We cover the network fee, so a brand-new wallet with 0 SOL works.",
      phoneTitle: "Works on any phone",
      phoneBody: "Scan the QR or tap the link. Nothing to install.",
    },
    howItWorks: "How it works",
    steps: [
      { title: "Fill it", body: "Pick a total, how many packets, Lucky or Equal, and a greeting." },
      { title: "Share it", body: "Send the link or QR to your group chat, or show it at a physical event." },
      { title: "Friends & family rush in", body: "They open the envelope and claim in seconds. No wallet yet? They get a free one instantly. No gas needed." },
    ],
    whatsNext: "What's next",
    idea: "Have an idea? Tell me on X →",
    soon: "Soon",
    roadmap: [
      { title: "Mainnet", body: "Coming for CNY 2027, the Year of the Goat." },
      { title: "USDC packets", body: "Send exact dollar amounts that don't move with the SOL price." },
      { title: "Human-only claims", body: "An optional check so bots can't sweep big angpaos." },
      { title: "Phone app", body: "On the Solana dApp Store, for Seeker phones." },
    ],
  },
  common: {
    lucky: "Lucky",
    equal: "Equal",
    packets: (n: number) => `${n} packet${n === 1 ? "" : "s"}`,
    confirmInWallet: "Confirm in your wallet…",
    viewOnchain: "View onchain",
    justNow: "just now",
    ago: (n: number, unit: "s" | "m" | "h" | "d") => `${n}${unit} ago`,
    expired: "Expired",
  },
  themes: ["Chinese New Year", "Hari Raya", "Deepavali", "Christmas", "Birthday", "Wedding", "Graduation", "Custom"],
  expiry: ["1 hour", "24 hours", "3 days"],
  create: {
    title: "Create an angpao",
    totalAmount: "Total amount",
    currency: "Currency",
    atPrice: (sol: string, price: string) => `≈ ${sol} at ${price} / SOL`,
    fetchingPrice: "Fetching SOL price…",
    atCreation: (fiat: string) => `≈ ${fiat} at creation`,
    packets: "Packets",
    avg: "avg",
    split: "Split",
    theme: "Theme",
    greeting: "Greeting",
    bytes: "bytes",
    expiresIn: "Expires in",
    expiryNote: "Unclaimed packets come back to you after expiry.",
    whoCanClaim: "Who can claim",
    gateOpen: "Anyone",
    gatePass: "🔑 Passphrase",
    gateList: "📋 Invite list",
    openNote: "Anyone with the link, first come first served.",
    passPlaceholder: "e.g. huat-ah-2027",
    passNote: "Guests type it to claim. It isn't in the link. Use something hard to guess: a hash of it is stored onchain.",
    passUnavailable: "This server has no gatekeeper key, so passphrase gates are unavailable.",
    listPlaceholder: "Paste wallet addresses, one per line",
    listInvited: "Invited wallets",
    listCount: (n: number, max: number) => `${n}/${max} wallets · only these wallets can claim (checked onchain).`,
    listOnce: " Saved in the same transaction, so you approve once.",
    listMany: (n: number) => ` The list is too long for one transaction, so your wallet will ask you to approve ${n} times.`,
    connectToCreate: "Connect a wallet to create",
    createFund: (amount: string) => `Create & fund ${amount}`,
    preview: "Preview",
    youPay: (total: string, deposit: string) => `You pay ${total} plus a small refundable deposit (≈ ${deposit} SOL).`,
    theTotal: "the total",
    err: {
      waitingPrice: "Waiting for price…",
      enterAmount: "Enter an amount",
      packetRange: (max: number) => `Packets must be between 1 and ${max}`,
      packetMin: (minTotal: string) => `Each packet needs at least 0.001 SOL (min total ${minTotal} SOL)`,
      messageBytes: (n: number, max: number) => `Message is ${n}/${max} bytes`,
      noGatekeeper: "Passphrase gates need a server gatekeeper key",
      passShort: (n: number) => `Passphrase needs at least ${n} characters`,
      badAddress: (a: string) => `Not a wallet address: ${a}`,
      listEmpty: "Add at least one wallet address",
      listTooLong: (max: number, n: number) => `At most ${max} wallets (you have ${n})`,
      connectFirst: "Connect a wallet first",
    },
    toastCreated: "Angpao created!",
    toastListSaved: "Invite list saved",
    toastListFailed: (why: string) => `Couldn't save the invite list: ${why}`,
    oneMore: "One more approval",
    oneMoreBody: (n: number) =>
      `Your angpao is funded, but ${n} invited wallet${n === 1 ? " isn't" : "s aren't"} on the list yet. Until they are, they can't claim.`,
    saveList: "Save invite list",
    liveTitle: "Your angpao is live 🎉",
    liveSub: "Share it before the packets run out.",
    passphrase: "Passphrase",
    passTell: "Not in the link. Tell your guests separately.",
    createAnother: "Create another",
    shareText: (emoji: string, amount: string, packets: number, mode: string, message: string) =>
      `${emoji} ${amount} · ${packets} packets (${mode}). ${message}`,
  },
  share: {
    cameraQr: "Camera QR",
    walletQr: "Wallet QR (Solana Pay)",
    walletQrHint: "Scan inside Phantom, Solflare or Backpack to claim straight into that wallet. No gas.",
    copy: "Copy",
    copied: "Copied!",
    more: "More…",
    openAngpao: "Open angpao",
    viewTx: "View transaction on Solana Explorer",
  },
  claim: {
    badLink: "That link doesn't look right.",
    offline: "Couldn't reach the Solana network. Retrying…",
    loading: "Loading angpao…",
    goneTitle: "This angpao is gone 🍃",
    goneBody: "It doesn't exist, or the sender has already closed it.",
    soldOut: "Sold out",
    left: (left: number, total: number) => `${left} / ${total} left`,
    tapToOpen: "Tap to open",
    openAria: "Open the angpao",
    youGot: "You got",
    luckiest: "👑 Luckiest packet!",
    inYourWallet: "in your wallet",
    inviteOnly: "🔒 Invite-only: only wallets on the sender's list can claim.",
    passPlaceholder: "Passphrase from the sender",
    claiming: "Claiming…",
    claimMine: "Claim my packet 🧧",
    into: (label: string, addr: string) => `into ${label} ${addr}`,
    noGas: " · no gas needed",
    instantCta: "⚡ Claim with a free instant wallet",
    instantBusy: "Creating wallet & claiming…",
    instantSocial: "New to crypto? Free wallet with your email or Google. No fees.",
    instantBurner: "New to crypto? Free wallet in 1 second. No app, no fees.",
    orWallet: "or use your wallet",
    weCoverFees: "No SOL needed for fees. We cover them.",
    allClaimed: "All packets claimed. Better luck next time!",
    hasExpired: "This angpao has expired.",
    solTotal: (sol: string) => `${sol} SOL total`,
    atCreation: (v: string) => ` · ${v} at creation`,
    now: (v: string) => ` · ${v} now`,
    liveClaims: "Live claims",
    live: "live",
    noClaims: "No claims yet. Be the first! 🏃",
    you: "YOU",
    luckiestTag: "LUCKIEST",
    youSent: "You sent this angpao · ",
    refundOnDash: "Refund & close on your dashboard →",
    manageOnDash: "Manage on your dashboard →",
    enterPassFirst: "Enter the passphrase first",
    slowConfirm: "Submitted! It's taking a while to confirm, so hang tight.",
    alreadyClaimed: "You already claimed this one 😉",
    soClose: "So close! The last packet was just taken.",
    justExpired: "This angpao just expired.",
    walletFailed: "Couldn't create a wallet",
    instantLabel: "Instant wallet",
  },
  burner: {
    title: "⚠️ This is an instant wallet saved in this browser",
    body: "It's for small demo amounts only. Clearing your browser data deletes it. Back up the key, or send the funds to a wallet you control.",
    keyNote: "Private key (import it in Phantom/Solflare). Never share it.",
    copyKey: "Copy key",
    copied: "Copied",
    backup: "Back up key",
    yourWallet: (a: string) => `Your wallet: ${a}…`,
    realWallet: "Your real wallet address",
    sending: "Sending…",
    send: "Send to my real wallet",
    invalid: "Enter a valid Solana address",
    sent: "Sent! It'll show in your wallet in a few seconds.",
    failed: "Couldn't send",
  },
  dash: {
    title: "Your angpaos",
    connect: "Connect the wallet you created angpaos with to see claims and refund leftovers.",
    new: "+ New",
    loadError: "Couldn't load from the network. Retrying…",
    loading: "Loading…",
    empty: "No angpaos yet.",
    createOne: "Create one",
    closed: "Closed",
    refunded: "Refunded & closed",
    soldOut: "Sold out",
    expired: "Expired",
    claimed: (c: number, n: number) => `${c}/${n} claimed`,
    atCreationNow: (now: string) => ` at creation · ${now} now`,
    refund: (sol: string) => `Refund & close · ${sol} SOL`,
    confirming: "Confirm in wallet…",
    cancel: "Cancel & refund",
    refundAtExpiry: "Refund opens at expiry",
    cancelConfirm: "Cancel this angpao and take the full amount back? The link will stop working.",
    returned: (sol: string) => `${sol} SOL returned to your wallet`,
    share: "Share",
    hideShare: "Hide sharing",
  },
};

export type Dict = typeof en;

const zh: Dict = {
  brand: { name: "Onchain Angpao", zh: "链上红包" },
  nav: { create: "发红包", dashboard: "我的红包", connect: "连接钱包", connectShort: "连接", language: "语言" },
  mainnetWarning: "⚠️ 主网：使用真实资金。请只用小额，并遵守当地法规。",
  wallet: {
    connecting: "连接中…",
    balance: "余额",
    copyAddress: "复制地址",
    copied: "已复制！",
    explorer: "浏览器",
    disconnect: "断开连接",
    toggleTheme: "切换深浅色",
  },
  footer: {
    openSourceA: "已在",
    openSourceB: " 开源。欢迎 Fork、点星，打造你自己的版本。",
    feedback: "有反馈或想法？在 X 上找我：",
  },
  home: {
    pill: "Solana 上的红包",
    mainnetSoon: "主网即将上线，2027 羊年春节见",
    h1a: "发个红包。",
    h1b: "让亲朋好友一起抢福气！",
    tagline: "发红包，抢好运！",
    sub: "把 SOL 分成拼手气或普通红包。亲朋好友几秒就能领取，就算从没接触过加密货币也没问题。",
    ethos: "红包不只是红色的信封，更是一份关怀、尊重与祝福的心意。",
    ctaCreate: "发红包 🧧",
    ctaMine: "我的红包",
    newToCrypto: "第一次接触加密货币？",
    noWalletTitle: "没有钱包？没关系。",
    noWalletSub: "奶奶、表兄弟姐妹、公司群：谁都能领，完全不需要链上经验。",
    points: {
      walletTitle: "一键免费钱包",
      walletSocial: "我们会立即为他们创建一个钱包，绑定邮箱或 Google 账号。",
      walletBurner: "我们会立即在浏览器里为他们创建钱包，无需下载应用或注册。",
      feesTitle: "领取零手续费",
      feesBody: "网络手续费由我们承担，余额为 0 的新钱包也能领。",
      phoneTitle: "任何手机都能用",
      phoneBody: "扫二维码或点链接即可，无需安装任何东西。",
    },
    howItWorks: "怎么玩",
    steps: [
      { title: "包红包", body: "设定总金额、红包个数、拼手气或普通红包，再写一句祝福。" },
      { title: "发出去", body: "把链接或二维码发到群里，或在线下活动现场展示。" },
      { title: "亲朋好友来抢", body: "打开红包，几秒就领到。还没有钱包？立即免费送一个，无需手续费。" },
    ],
    whatsNext: "接下来",
    idea: "有好点子？在 X 上告诉我 →",
    soon: "即将推出",
    roadmap: [
      { title: "主网", body: "2027 羊年春节上线。" },
      { title: "USDC 红包", body: "发固定美元金额，不随 SOL 价格波动。" },
      { title: "真人领取", body: "可选的真人验证，防止机器人抢走大红包。" },
      { title: "手机应用", body: "上架 Solana dApp Store，支持 Seeker 手机。" },
    ],
  },
  common: {
    lucky: "拼手气",
    equal: "普通",
    packets: (n: number) => `${n} 个红包`,
    confirmInWallet: "请在钱包中确认…",
    viewOnchain: "在链上查看",
    justNow: "刚刚",
    ago: (n: number, unit: "s" | "m" | "h" | "d") => `${n}${{ s: " 秒", m: " 分钟", h: " 小时", d: " 天" }[unit]}前`,
    expired: "已过期",
  },
  themes: ["春节", "开斋节", "屠妖节", "圣诞节", "生日", "婚礼", "毕业", "自定义"],
  expiry: ["1 小时", "24 小时", "3 天"],
  create: {
    title: "发红包",
    totalAmount: "总金额",
    currency: "币种",
    atPrice: (sol: string, price: string) => `≈ ${sol}，按 ${price} / SOL 计算`,
    fetchingPrice: "正在获取 SOL 价格…",
    atCreation: (fiat: string) => `≈ 创建时价值 ${fiat}`,
    packets: "红包个数",
    avg: "平均",
    split: "分配方式",
    theme: "主题",
    greeting: "祝福语",
    bytes: "字节",
    expiresIn: "有效期",
    expiryNote: "过期后未领取的红包会退回给你。",
    whoCanClaim: "谁能领取",
    gateOpen: "所有人",
    gatePass: "🔑 口令",
    gateList: "📋 邀请名单",
    openNote: "拿到链接的人都能领，先到先得。",
    passPlaceholder: "例如 huat-ah-2027",
    passNote: "领取时需要输入口令，链接里不含口令。请设得难猜一些：口令的哈希值会存在链上。",
    passUnavailable: "此服务器没有设置守门人密钥，暂不支持口令红包。",
    listPlaceholder: "粘贴钱包地址，每行一个",
    listInvited: "受邀钱包",
    listCount: (n: number, max: number) => `${n}/${max} 个钱包 · 只有这些钱包能领取（链上校验）。`,
    listOnce: "名单会在同一笔交易中保存，你只需确认一次。",
    listMany: (n: number) => `名单太长，一笔交易放不下，钱包会请你确认 ${n} 次。`,
    connectToCreate: "连接钱包后即可发红包",
    createFund: (amount: string) => `发出红包 ${amount}`,
    preview: "预览",
    youPay: (total: string, deposit: string) => `你需要支付 ${total}，外加一小笔可退还的押金（≈ ${deposit} SOL）。`,
    theTotal: "总金额",
    err: {
      waitingPrice: "正在获取价格…",
      enterAmount: "请输入金额",
      packetRange: (max: number) => `红包个数需在 1 到 ${max} 之间`,
      packetMin: (minTotal: string) => `每个红包至少 0.001 SOL（总额至少 ${minTotal} SOL）`,
      messageBytes: (n: number, max: number) => `祝福语 ${n}/${max} 字节，超出上限`,
      noGatekeeper: "口令红包需要服务器的守门人密钥",
      passShort: (n: number) => `口令至少需要 ${n} 个字符`,
      badAddress: (a: string) => `不是有效的钱包地址：${a}`,
      listEmpty: "请至少添加一个钱包地址",
      listTooLong: (max: number, n: number) => `最多 ${max} 个钱包（当前 ${n} 个）`,
      connectFirst: "请先连接钱包",
    },
    toastCreated: "红包已发出！",
    toastListSaved: "邀请名单已保存",
    toastListFailed: (why: string) => `邀请名单保存失败：${why}`,
    oneMore: "还需确认一次",
    oneMoreBody: (n: number) => `红包已存入资金，但还有 ${n} 个受邀钱包未加入名单。加入之前，他们无法领取。`,
    saveList: "保存邀请名单",
    liveTitle: "红包已发出 🎉",
    liveSub: "趁红包还没被抢完，快分享出去吧。",
    passphrase: "口令",
    passTell: "链接里不含口令，请另外告诉你的亲友。",
    createAnother: "再发一个",
    shareText: (emoji: string, amount: string, packets: number, mode: string, message: string) =>
      `${emoji} ${amount} · ${packets} 个${mode}红包。${message}`,
  },
  share: {
    cameraQr: "相机二维码",
    walletQr: "钱包二维码（Solana Pay）",
    walletQrHint: "用 Phantom、Solflare 或 Backpack 扫码，直接领到该钱包，免手续费。",
    copy: "复制",
    copied: "已复制！",
    more: "更多…",
    openAngpao: "打开红包",
    viewTx: "在 Solana 浏览器中查看交易",
  },
  claim: {
    badLink: "这个链接好像不对。",
    offline: "无法连接 Solana 网络，正在重试…",
    loading: "红包加载中…",
    goneTitle: "这个红包已经不在了 🍃",
    goneBody: "它不存在，或者发红包的人已经关闭了它。",
    soldOut: "已抢完",
    left: (left: number, total: number) => `剩 ${left} / ${total} 个`,
    tapToOpen: "点击拆红包",
    openAria: "拆红包",
    youGot: "你抢到了",
    luckiest: "👑 手气最佳！",
    inYourWallet: "已到账",
    inviteOnly: "🔒 仅限受邀：只有名单上的钱包才能领取。",
    passPlaceholder: "输入发红包的人给你的口令",
    claiming: "领取中…",
    claimMine: "领取红包 🧧",
    into: (label: string, addr: string) => `领到 ${label} ${addr}`,
    noGas: " · 免手续费",
    instantCta: "⚡ 用免费钱包立即领取",
    instantBusy: "正在创建钱包并领取…",
    instantSocial: "第一次接触加密货币？用邮箱或 Google 免费开通钱包，零手续费。",
    instantBurner: "第一次接触加密货币？1 秒开通免费钱包，无需应用，零手续费。",
    orWallet: "或使用你的钱包",
    weCoverFees: "无需 SOL 支付手续费，由我们承担。",
    allClaimed: "红包已被抢完，下次手快点！",
    hasExpired: "这个红包已过期。",
    solTotal: (sol: string) => `共 ${sol} SOL`,
    atCreation: (v: string) => ` · 创建时 ${v}`,
    now: (v: string) => ` · 现值 ${v}`,
    liveClaims: "实时领取",
    live: "实时",
    noClaims: "还没有人领取，快来抢第一个！🏃",
    you: "你",
    luckiestTag: "手气最佳",
    youSent: "这是你发的红包 · ",
    refundOnDash: "到“我的红包”退款并关闭 →",
    manageOnDash: "到“我的红包”管理 →",
    enterPassFirst: "请先输入口令",
    slowConfirm: "已提交！确认需要一点时间，请稍候。",
    alreadyClaimed: "你已经领过这个红包啦 😉",
    soClose: "差一点！最后一个红包刚被抢走。",
    justExpired: "这个红包刚刚过期。",
    walletFailed: "无法创建钱包",
    instantLabel: "免费钱包",
  },
  burner: {
    title: "⚠️ 这是保存在本浏览器里的免费钱包",
    body: "仅适合小额体验。清除浏览器数据会把它删除。请备份私钥，或把资金转到你自己掌控的钱包。",
    keyNote: "私钥（可导入 Phantom/Solflare）。切勿分享给任何人。",
    copyKey: "复制私钥",
    copied: "已复制",
    backup: "备份私钥",
    yourWallet: (a: string) => `你的钱包：${a}…`,
    realWallet: "你的正式钱包地址",
    sending: "转账中…",
    send: "转到我的正式钱包",
    invalid: "请输入有效的 Solana 地址",
    sent: "已转出！几秒后会出现在你的钱包里。",
    failed: "转账失败",
  },
  dash: {
    title: "我的红包",
    connect: "连接你发红包时用的钱包，即可查看领取情况并退回剩余金额。",
    new: "+ 发红包",
    loadError: "无法从网络加载，正在重试…",
    loading: "加载中…",
    empty: "还没有发过红包。",
    createOne: "发一个",
    closed: "已关闭",
    refunded: "已退款并关闭",
    soldOut: "已抢完",
    expired: "已过期",
    claimed: (c: number, n: number) => `已领 ${c}/${n}`,
    atCreationNow: (now: string) => `（创建时）· 现值 ${now}`,
    refund: (sol: string) => `退款并关闭 · ${sol} SOL`,
    confirming: "请在钱包中确认…",
    cancel: "取消并退款",
    refundAtExpiry: "过期后可退款",
    cancelConfirm: "确定取消这个红包并取回全部金额吗？链接将会失效。",
    returned: (sol: string) => `${sol} SOL 已退回你的钱包`,
    share: "分享",
    hideShare: "收起分享",
  },
};

const DICTS: Record<SiteLang, Dict> = { en, zh };
const KEY = "angpao:lang";
const listeners = new Set<() => void>();

function readLang(): SiteLang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "en" || v === "zh") return v;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== "undefined" && /^zh/i.test(navigator.language) ? "zh" : "en";
}

export function useLang(): [SiteLang, (l: SiteLang) => void] {
  const lang = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readLang,
    () => "en" as SiteLang,
  );
  const setLang = useCallback((l: SiteLang) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn());
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en";
  }, [lang]);
  return [lang, setLang];
}

/** The current language's strings. */
export function useT(): Dict {
  return DICTS[useLang()[0]];
}

/** "5m ago" / "5 分钟前", from unix seconds. */
export function timeAgoT(t: Dict, ts: number, now: number): string {
  const s = Math.max(0, now - ts);
  if (s < 10) return t.common.justNow;
  if (s < 60) return t.common.ago(s, "s");
  if (s < 3600) return t.common.ago(Math.floor(s / 60), "m");
  if (s < 86400) return t.common.ago(Math.floor(s / 3600), "h");
  return t.common.ago(Math.floor(s / 86400), "d");
}

/** Countdown: "2d 3h" / "2天3小时". */
export function countdownT(t: Dict, secondsLeft: number, lang: SiteLang): string {
  if (secondsLeft <= 0) return t.common.expired;
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const sec = secondsLeft % 60;
  const u = lang === "zh" ? { d: "天", h: "小时", m: "分", s: "秒" } : { d: "d ", h: "h ", m: "m ", s: "s" };
  if (d > 0) return `${d}${u.d}${h}${u.h}`.trim();
  if (h > 0) return `${h}${u.h}${m}${u.m}`.trim();
  return `${m}${u.m}${sec.toString().padStart(2, "0")}${u.s}`;
}
