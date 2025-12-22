export interface SiteAiConfig {
    gatewayKey: string;
    openAiKey: string;
    anthropicKey: string;
    geminiKey: string;
}

export interface SiteConfig {
    ai: SiteAiConfig;
    diBackendUrl: string;
}
