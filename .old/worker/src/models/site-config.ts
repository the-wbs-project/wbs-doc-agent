export interface SiteAiConfig {
    gatewayKey: string;
    openAiKey: string;
    anthropicKey: string;
    geminiKey: string;
    skipCache?: boolean;
}

export interface SiteConfig {
    ai: SiteAiConfig;
    diBackendUrl: string;
}
