import type { ToolDefinition } from '../types';

// PRICING DATA — verified from official pages, May 2026
// Sources documented in PRICING_DATA.md

export const TOOLS: ToolDefinition[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    logo: '⬡',
    color: '#6366f1',
    category: 'ide',
    url: 'https://cursor.sh',
    pricingUrl: 'https://cursor.sh/pricing',
    plans: [
      { id: 'hobby', name: 'Hobby', pricePerSeat: 0, features: ['2000 completions/mo', '50 slow requests'], useCaseFit: ['coding'] },
      { id: 'pro', name: 'Pro', pricePerSeat: 20, features: ['Unlimited completions', '500 fast requests', 'GPT-4 access'], useCaseFit: ['coding'] },
      { id: 'business', name: 'Business', pricePerSeat: 40, features: ['All Pro', 'Team features', 'Admin panel', 'SSO'], useCaseFit: ['coding'] },
      { id: 'enterprise', name: 'Enterprise', pricePerSeat: 0, features: ['Custom pricing', 'Dedicated support'], useCaseFit: ['coding'] },
    ],
  },
  {
    id: 'github_copilot',
    name: 'GitHub Copilot',
    logo: '◎',
    color: '#8b5cf6',
    category: 'ide',
    url: 'https://github.com/features/copilot',
    pricingUrl: 'https://github.com/features/copilot#pricing',
    plans: [
      { id: 'individual', name: 'Individual', pricePerSeat: 10, features: ['Code completions', 'Chat in IDE', 'CLI support'], useCaseFit: ['coding'] },
      { id: 'business', name: 'Business', pricePerSeat: 19, features: ['All Individual', 'Admin console', 'Policy controls'], useCaseFit: ['coding'] },
      { id: 'enterprise', name: 'Enterprise', pricePerSeat: 39, features: ['All Business', 'Customisation', 'Fine-tuning'], useCaseFit: ['coding'] },
    ],
  },
  {
    id: 'claude',
    name: 'Claude',
    logo: '✦',
    color: '#f97316',
    category: 'chat',
    url: 'https://claude.ai',
    pricingUrl: 'https://claude.ai/upgrade',
    plans: [
      { id: 'free', name: 'Free', pricePerSeat: 0, features: ['Limited messages', 'Claude 3 Sonnet'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'pro', name: 'Pro', pricePerSeat: 20, features: ['5x more usage', 'Claude 3 Opus', 'Priority access'], useCaseFit: ['writing', 'research', 'coding', 'mixed'] },
      { id: 'max', name: 'Max', pricePerSeat: 100, features: ['20x more usage', 'Extended context', 'Early features'], useCaseFit: ['data', 'research', 'mixed'] },
      { id: 'team', name: 'Team', pricePerSeat: 30, minSeats: 5, features: ['Pro features', 'Team workspace', 'Admin tools'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'enterprise', name: 'Enterprise', pricePerSeat: 0, features: ['Custom limits', 'SSO', 'Audit logs'], useCaseFit: ['writing', 'research', 'data', 'coding', 'mixed'] },
      { id: 'api', name: 'API Direct', pricePerSeat: 0, features: ['Pay per token', 'Full API access'], useCaseFit: ['coding', 'data'] },
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    logo: '◐',
    color: '#10a37f',
    category: 'chat',
    url: 'https://chat.openai.com',
    pricingUrl: 'https://openai.com/chatgpt/pricing',
    plans: [
      { id: 'free', name: 'Free', pricePerSeat: 0, features: ['GPT-4o mini', 'Limited GPT-4o'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'plus', name: 'Plus', pricePerSeat: 20, features: ['GPT-4o unlimited', 'DALL-E', 'Browse'], useCaseFit: ['writing', 'research', 'coding', 'mixed'] },
      { id: 'team', name: 'Team', pricePerSeat: 30, minSeats: 2, features: ['All Plus', 'Workspace', 'Admin console'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'enterprise', name: 'Enterprise', pricePerSeat: 0, features: ['Custom limits', 'SSO', 'SOC 2'], useCaseFit: ['writing', 'research', 'data', 'coding', 'mixed'] },
      { id: 'api', name: 'API Direct', pricePerSeat: 0, features: ['Pay per token', 'Full API access'], useCaseFit: ['coding', 'data'] },
    ],
  },
  {
    id: 'anthropic_api',
    name: 'Anthropic API',
    logo: '∿',
    color: '#f97316',
    category: 'api',
    url: 'https://console.anthropic.com',
    pricingUrl: 'https://www.anthropic.com/api',
    plans: [
      { id: 'payg', name: 'Pay-as-you-go', pricePerSeat: 0, features: ['Token-based billing', 'All Claude models'], useCaseFit: ['coding', 'data', 'research'] },
      { id: 'committed', name: 'Committed Use', pricePerSeat: 0, features: ['Discounted tokens', 'Priority throughput'], useCaseFit: ['coding', 'data', 'research'] },
    ],
  },
  {
    id: 'openai_api',
    name: 'OpenAI API',
    logo: '◌',
    color: '#10a37f',
    category: 'api',
    url: 'https://platform.openai.com',
    pricingUrl: 'https://openai.com/api/pricing',
    plans: [
      { id: 'payg', name: 'Pay-as-you-go', pricePerSeat: 0, features: ['Token-based billing', 'All GPT models', 'DALL-E API'], useCaseFit: ['coding', 'data', 'research'] },
      { id: 'committed', name: 'Committed Use', pricePerSeat: 0, features: ['Volume discounts', 'Priority access'], useCaseFit: ['coding', 'data', 'research'] },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    logo: '✧',
    color: '#4285f4',
    category: 'chat',
    url: 'https://gemini.google.com',
    pricingUrl: 'https://one.google.com/about/plans',
    plans: [
      { id: 'free', name: 'Free', pricePerSeat: 0, features: ['Gemini 1.5 Flash', 'Basic usage'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'advanced', name: 'Advanced', pricePerSeat: 20, features: ['Gemini 1.5 Pro', '2M context', 'Google Workspace'], useCaseFit: ['writing', 'research', 'data', 'mixed'] },
      { id: 'business', name: 'Business (Workspace)', pricePerSeat: 30, features: ['All Advanced', 'Admin controls', 'Data protection'], useCaseFit: ['writing', 'research', 'mixed'] },
      { id: 'api', name: 'API (AI Studio)', pricePerSeat: 0, features: ['Pay per token', 'Vertex AI access'], useCaseFit: ['coding', 'data'] },
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    logo: '≈',
    color: '#06b6d4',
    category: 'ide',
    url: 'https://codeium.com/windsurf',
    pricingUrl: 'https://codeium.com/pricing',
    plans: [
      { id: 'free', name: 'Free', pricePerSeat: 0, features: ['5 user prompts/day', 'Basic completions'], useCaseFit: ['coding'] },
      { id: 'pro', name: 'Pro', pricePerSeat: 15, features: ['Unlimited flows', 'GPT-4o + Claude', 'Priority models'], useCaseFit: ['coding'] },
      { id: 'teams', name: 'Teams', pricePerSeat: 30, minSeats: 3, features: ['All Pro', 'Team admin', 'Analytics'], useCaseFit: ['coding'] },
    ],
  },
];

export const TOOL_MAP = new Map(TOOLS.map(t => [t.id, t]));