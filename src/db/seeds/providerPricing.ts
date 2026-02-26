import { db } from "@/db";
import { providerPricing } from "@/db/schema";

async function main() {
  const now = new Date();
  const effectiveDate = "2024-01-01";

  // Current pricing data for major LLM providers (prices per million tokens)
  // Updated February 2026 with latest OpenAI GPT-5 and Claude 4.5 pricing
  const pricingData = [
    // OpenAI Models - Updated 2025-2026
    {
      provider: "openai",
      model: "gpt-5",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5-mini",
      inputPricePerMillion: "0.25",
      outputPricePerMillion: "2.00",
    },
    {
      provider: "openai",
      model: "gpt-5-nano",
      inputPricePerMillion: "0.05",
      outputPricePerMillion: "0.40",
    },
    {
      provider: "openai",
      model: "gpt-4.1",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "12.00",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      inputPricePerMillion: "5.00",
      outputPricePerMillion: "20.00",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      inputPricePerMillion: "0.60",
      outputPricePerMillion: "2.40",
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo",
      inputPricePerMillion: "0.50",
      outputPricePerMillion: "1.50",
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo-16k",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "4.00",
    },
    {
      provider: "openai",
      model: "o1-preview",
      inputPricePerMillion: "15.00",
      outputPricePerMillion: "60.00",
    },
    {
      provider: "openai",
      model: "o1-mini",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "12.00",
    },
    // OpenAI o3/o4 Reasoning Models - Latest 2025
    {
      provider: "openai",
      model: "o3",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "8.00",
    },
    {
      provider: "openai",
      model: "o3-mini",
      inputPricePerMillion: "0.55",
      outputPricePerMillion: "2.20",
    },
    {
      provider: "openai",
      model: "o3-mini-high",
      inputPricePerMillion: "0.55",
      outputPricePerMillion: "2.20",
    },
    {
      provider: "openai",
      model: "o3-pro",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "8.00",
    },
    {
      provider: "openai",
      model: "o3-deep-research",
      inputPricePerMillion: "10.00",
      outputPricePerMillion: "40.00",
    },
    {
      provider: "openai",
      model: "o4-mini",
      inputPricePerMillion: "1.10",
      outputPricePerMillion: "4.40",
    },
    {
      provider: "openai",
      model: "o4-mini-high",
      inputPricePerMillion: "1.10",
      outputPricePerMillion: "4.40",
    },
    {
      provider: "openai",
      model: "o4-mini-deep-research",
      inputPricePerMillion: "1.10",
      outputPricePerMillion: "4.40",
    },
    // OpenAI GPT-5.x Extended Family - Latest 2025-2026
    {
      provider: "openai",
      model: "gpt-5.1",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.1-chat",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.1-codex",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.1-codex-mini",
      inputPricePerMillion: "0.25",
      outputPricePerMillion: "2.00",
    },
    {
      provider: "openai",
      model: "gpt-5.1-codex-max",
      inputPricePerMillion: "2.50",
      outputPricePerMillion: "20.00",
    },
    {
      provider: "openai",
      model: "gpt-5.2",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.2-chat",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.2-codex",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5.2-pro",
      inputPricePerMillion: "2.50",
      outputPricePerMillion: "20.00",
    },
    // OpenAI GPT-5 Chat & Codex Variants
    {
      provider: "openai",
      model: "gpt-5-chat",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5-codex",
      inputPricePerMillion: "1.25",
      outputPricePerMillion: "10.00",
    },
    // OpenAI GPT-4.1 Extended Family
    {
      provider: "openai",
      model: "gpt-4.1-mini",
      inputPricePerMillion: "0.60",
      outputPricePerMillion: "2.40",
    },
    {
      provider: "openai",
      model: "gpt-4.1-nano",
      inputPricePerMillion: "0.15",
      outputPricePerMillion: "0.60",
    },
    // OpenAI Image & Audio Models
    {
      provider: "openai",
      model: "gpt-5-image",
      inputPricePerMillion: "10.00",
      outputPricePerMillion: "10.00",
    },
    {
      provider: "openai",
      model: "gpt-5-image-mini",
      inputPricePerMillion: "2.50",
      outputPricePerMillion: "2.50",
    },
    {
      provider: "openai",
      model: "gpt-audio",
      inputPricePerMillion: "15.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "openai",
      model: "gpt-audio-mini",
      inputPricePerMillion: "2.50",
      outputPricePerMillion: "2.50",
    },
    {
      provider: "openai",
      model: "gpt-4o-audio-preview",
      inputPricePerMillion: "5.00",
      outputPricePerMillion: "20.00",
    },
    // OpenAI Search Preview Models
    {
      provider: "openai",
      model: "gpt-4o-search-preview",
      inputPricePerMillion: "5.00",
      outputPricePerMillion: "20.00",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini-search-preview",
      inputPricePerMillion: "0.60",
      outputPricePerMillion: "2.40",
    },
    // OpenAI Open Source Models
    {
      provider: "openai",
      model: "gpt-oss-20b",
      inputPricePerMillion: "0.10",
      outputPricePerMillion: "0.10",
    },
    {
      provider: "openai",
      model: "gpt-oss-120b",
      inputPricePerMillion: "0.50",
      outputPricePerMillion: "0.50",
    },
    {
      provider: "openai",
      model: "gpt-oss-safeguard-20b",
      inputPricePerMillion: "0.10",
      outputPricePerMillion: "0.10",
    },

    // OpenAI Embeddings
    {
      provider: "openai",
      model: "text-embedding-3-small",
      inputPricePerMillion: "0.02",
      outputPricePerMillion: "0.00",
    },
    {
      provider: "openai",
      model: "text-embedding-3-large",
      inputPricePerMillion: "0.13",
      outputPricePerMillion: "0.00",
    },
    {
      provider: "openai",
      model: "text-embedding-ada-002",
      inputPricePerMillion: "0.10",
      outputPricePerMillion: "0.00",
    },

    // Anthropic Models - Updated 2025-2026
    {
      provider: "anthropic",
      model: "claude-3-opus",
      inputPricePerMillion: "15.00",
      outputPricePerMillion: "75.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-opus-20240229",
      inputPricePerMillion: "15.00",
      outputPricePerMillion: "75.00",
    },
    {
      provider: "anthropic",
      model: "claude-3.5-sonnet",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20240620",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-5-haiku",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "5.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-haiku",
      inputPricePerMillion: "0.25",
      outputPricePerMillion: "1.25",
    },
    {
      provider: "anthropic",
      model: "claude-3-haiku-20240307",
      inputPricePerMillion: "0.25",
      outputPricePerMillion: "1.25",
    },
    {
      provider: "anthropic",
      model: "claude-3-sonnet",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-3-sonnet-20240229",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    // Claude 4.5 Series - Latest 2025
    {
      provider: "anthropic",
      model: "claude-sonnet-4.5",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-haiku-4.5",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "5.00",
    },
    // Claude 4.6 Series - Latest 2026
    {
      provider: "anthropic",
      model: "claude-sonnet-4.6",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4.5",
      inputPricePerMillion: "5.00",
      outputPricePerMillion: "25.00",
    },
    {
      provider: "anthropic",
      model: "claude-opus-4.6",
      inputPricePerMillion: "5.00",
      outputPricePerMillion: "25.00",
    },
    // Claude 4.1 Series
    {
      provider: "anthropic",
      model: "claude-opus-4.1",
      inputPricePerMillion: "15.00",
      outputPricePerMillion: "75.00",
    },

    // Google Models - Updated 2025-2026
    {
      provider: "google",
      model: "gemini-pro",
      inputPricePerMillion: "0.50",
      outputPricePerMillion: "1.50",
    },
    {
      provider: "google",
      model: "gemini-1.5-pro",
      inputPricePerMillion: "3.50",
      outputPricePerMillion: "10.50",
    },
    {
      provider: "google",
      model: "gemini-1.5-flash",
      inputPricePerMillion: "0.075",
      outputPricePerMillion: "0.30",
    },
    {
      provider: "google",
      model: "gemini-1.5-flash-8b",
      inputPricePerMillion: "0.0375",
      outputPricePerMillion: "0.15",
    },
    {
      provider: "google",
      model: "gemini-2.0-flash-exp",
      inputPricePerMillion: "0.00",
      outputPricePerMillion: "0.00",
    }, // Free during preview
    {
      provider: "google",
      model: "gemini-2.0-flash-thinking-exp",
      inputPricePerMillion: "0.00",
      outputPricePerMillion: "0.00",
    }, // Free during preview
    {
      provider: "google",
      model: "gemini-2.0-flash-thinking",
      inputPricePerMillion: "0.075",
      outputPricePerMillion: "0.30",
    }, // Latest Gemini 2.0
    // Gemini 3.0/3.1 Series - Latest 2025-2026
    {
      provider: "google",
      model: "gemini-3-pro",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "6.00",
    },
    {
      provider: "google",
      model: "gemini-3-pro-preview",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "6.00",
    },
    {
      provider: "google",
      model: "gemini-3.1-pro",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "6.00",
    },
    {
      provider: "google",
      model: "gemini-3.1-pro-preview",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "6.00",
    },
    {
      provider: "google",
      model: "gemini-3-pro-image-preview",
      inputPricePerMillion: "2.50",
      outputPricePerMillion: "7.50",
    },

    // Mistral Models
    {
      provider: "mistral",
      model: "mistral-large",
      inputPricePerMillion: "4.00",
      outputPricePerMillion: "12.00",
    },
    {
      provider: "mistral",
      model: "mistral-large-latest",
      inputPricePerMillion: "4.00",
      outputPricePerMillion: "12.00",
    },
    {
      provider: "mistral",
      model: "mistral-medium",
      inputPricePerMillion: "2.70",
      outputPricePerMillion: "8.10",
    },
    {
      provider: "mistral",
      model: "mistral-small",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "3.00",
    },
    {
      provider: "mistral",
      model: "mistral-small-latest",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "3.00",
    },
    {
      provider: "mistral",
      model: "open-mixtral-8x7b",
      inputPricePerMillion: "0.70",
      outputPricePerMillion: "0.70",
    },
    {
      provider: "mistral",
      model: "open-mixtral-8x22b",
      inputPricePerMillion: "2.00",
      outputPricePerMillion: "6.00",
    },
    {
      provider: "mistral",
      model: "codestral-latest",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "3.00",
    },

    // Cohere Models
    {
      provider: "cohere",
      model: "command-r-plus",
      inputPricePerMillion: "3.00",
      outputPricePerMillion: "15.00",
    },
    {
      provider: "cohere",
      model: "command-r",
      inputPricePerMillion: "0.50",
      outputPricePerMillion: "1.50",
    },
    {
      provider: "cohere",
      model: "command",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "2.00",
    },
    {
      provider: "cohere",
      model: "command-light",
      inputPricePerMillion: "0.30",
      outputPricePerMillion: "0.60",
    },

    // Cohere Embeddings
    {
      provider: "cohere",
      model: "embed-english-v3.0",
      inputPricePerMillion: "0.10",
      outputPricePerMillion: "0.00",
    },
    {
      provider: "cohere",
      model: "embed-multilingual-v3.0",
      inputPricePerMillion: "0.10",
      outputPricePerMillion: "0.00",
    },

    // Groq (fast inference)
    {
      provider: "groq",
      model: "llama-3.1-70b-versatile",
      inputPricePerMillion: "0.59",
      outputPricePerMillion: "0.79",
    },
    {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      inputPricePerMillion: "0.05",
      outputPricePerMillion: "0.08",
    },
    {
      provider: "groq",
      model: "mixtral-8x7b-32768",
      inputPricePerMillion: "0.24",
      outputPricePerMillion: "0.24",
    },
    {
      provider: "groq",
      model: "gemma2-9b-it",
      inputPricePerMillion: "0.20",
      outputPricePerMillion: "0.20",
    },

    // Together AI
    {
      provider: "together",
      model: "llama-3-70b-chat",
      inputPricePerMillion: "0.90",
      outputPricePerMillion: "0.90",
    },
    {
      provider: "together",
      model: "llama-3-8b-chat",
      inputPricePerMillion: "0.20",
      outputPricePerMillion: "0.20",
    },
    {
      provider: "together",
      model: "mixtral-8x7b-instruct",
      inputPricePerMillion: "0.60",
      outputPricePerMillion: "0.60",
    },

    // Fireworks AI
    {
      provider: "fireworks",
      model: "llama-v3-70b-instruct",
      inputPricePerMillion: "0.90",
      outputPricePerMillion: "0.90",
    },
    {
      provider: "fireworks",
      model: "mixtral-8x7b-instruct",
      inputPricePerMillion: "0.50",
      outputPricePerMillion: "0.50",
    },

    // Perplexity
    {
      provider: "perplexity",
      model: "llama-3.1-sonar-large-128k-online",
      inputPricePerMillion: "1.00",
      outputPricePerMillion: "1.00",
    },
    {
      provider: "perplexity",
      model: "llama-3.1-sonar-small-128k-online",
      inputPricePerMillion: "0.20",
      outputPricePerMillion: "0.20",
    },
  ];

  const valuesToInsert = pricingData.map((p) => ({
    ...p,
    effectiveDate,
    isActive: true,
    createdAt: now,
  }));

  await db.insert(providerPricing).values(valuesToInsert);

  console.log(`✅ Provider pricing seeder completed - ${valuesToInsert.length} records inserted`);
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
