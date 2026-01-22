export type AiModelProvider = "openai" | "anthropic" | "gemini";

export const AI_MODELS = {
    openai: {
        small: 'gpt-5-mini',
        large: 'gpt-5.2'
    },
    anthropic: {
        small: 'claude-haiku-4-5',
        large: 'claude-opus-4-5'
    },
    gemini: {
        small: 'gemini-3-flash-preview',
        medium: 'gemini-3-flash-preview',
        large: 'gemini-3-flash-preview',
    }
};

export function getModel(provider: keyof typeof AI_MODELS, size: 'small' | 'large') {
    return AI_MODELS[provider][size as keyof typeof AI_MODELS[typeof provider]];
}