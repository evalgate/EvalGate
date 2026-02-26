import { db } from "@/db";
import { evaluationTestCases } from "@/db/schema";

async function main() {
  const sampleTestCases = [
    {
      evaluationId: 1,
      input: "What is the capital of France?",
      expectedOutput: "Paris",
      metadata: JSON.stringify({ category: "geography", difficulty: "easy" }),
      createdAt: new Date("2024-01-15"),
    },
    {
      evaluationId: 1,
      input: "Explain the process of photosynthesis in plants.",
      expectedOutput:
        "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar. This occurs primarily in the chloroplasts of plant cells, where chlorophyll absorbs light energy to drive the chemical reactions.",
      metadata: JSON.stringify({ category: "biology", difficulty: "medium" }),
      createdAt: new Date("2024-01-15"),
    },
    {
      evaluationId: 1,
      input: "What are the health benefits of regular exercise?",
      expectedOutput:
        "Regular exercise provides numerous health benefits including improved cardiovascular health, stronger muscles and bones, better weight management, enhanced mental health and mood, increased energy levels, improved sleep quality, and reduced risk of chronic diseases such as diabetes, heart disease, and certain cancers.",
      metadata: JSON.stringify({ category: "health", difficulty: "medium" }),
      createdAt: new Date("2024-01-16"),
    },
    {
      evaluationId: 2,
      input: "Customer says: I cannot log into my account. What should I do?",
      expectedOutput:
        'I understand you are having trouble logging in. Let me help you with that. First, please verify that you are using the correct email address. If you have forgotten your password, click on the "Forgot Password" link on the login page to reset it. If you continue to experience issues, please clear your browser cache and cookies, or try using a different browser. If the problem persists, I can assist you further with account recovery.',
      metadata: JSON.stringify({ scenario: "login_issue", priority: "high" }),
      createdAt: new Date("2024-01-17"),
    },
    {
      evaluationId: 2,
      input: "Customer says: I want to cancel my subscription immediately.",
      expectedOutput:
        "I understand you would like to cancel your subscription. I am sorry to hear that you are leaving us. To process your cancellation, I will need to verify your account details. May I ask what prompted your decision to cancel? Your feedback is valuable to us. Please note that once cancelled, you will have access to your subscription benefits until the end of your current billing period. Would you like me to proceed with the cancellation?",
      metadata: JSON.stringify({ scenario: "cancellation", priority: "high" }),
      createdAt: new Date("2024-01-17"),
    },
    {
      evaluationId: 2,
      input: "Customer says: Where is my order? I have been waiting for 2 weeks.",
      expectedOutput:
        "I apologize for the delay with your order. I understand how frustrating this must be. Let me look into this for you right away. Could you please provide your order number so I can track its current status? Once I have that information, I will check with our shipping department to find out exactly where your package is and provide you with an updated delivery estimate. If there has been an unusual delay, I will work to resolve this issue as quickly as possible.",
      metadata: JSON.stringify({ scenario: "order_tracking", priority: "medium" }),
      createdAt: new Date("2024-01-18"),
    },
    {
      evaluationId: 3,
      input:
        "Summarize this article: Climate change is one of the most pressing issues of our time. Rising global temperatures are causing ice caps to melt, sea levels to rise, and extreme weather events to become more frequent. Scientists warn that without immediate action to reduce greenhouse gas emissions, the consequences could be catastrophic for future generations. Governments and organizations worldwide are working to implement sustainable practices and transition to renewable energy sources.",
      expectedOutput:
        "Climate change poses a critical threat with rising temperatures causing ice cap melting, rising sea levels, and more frequent extreme weather. Scientists emphasize urgent action is needed to reduce greenhouse gas emissions to prevent catastrophic consequences. Global efforts are underway to adopt sustainable practices and shift to renewable energy.",
      metadata: JSON.stringify({ task: "summarization", word_limit: 50 }),
      createdAt: new Date("2024-01-19"),
    },
    {
      evaluationId: 3,
      input:
        "Write a professional email to decline a job offer: Compunknown: Tech Innovations Inc., Position: Senior Developer, Reason: Accepted another offer",
      expectedOutput:
        "Subject: Job Offer - Senior Developer Position\n\nDear Hiring Manager,\n\nThank you very much for offering me the Senior Developer position at Tech Innovations Inc. I truly appreciate the time you and your team invested in the interview process and the opportunity to learn more about your organization.\n\nAfter careful consideration, I have decided to accept another position that aligns more closely with my current career goals. This was not an easy decision, as I was impressed by your compunknown and the team.\n\nI want to express my gratitude for your consideration and wish Tech Innovations Inc. continued success. I hope our paths may cross again in the future.\n\nBest regards",
      metadata: JSON.stringify({ task: "email_writing", tone: "professional" }),
      createdAt: new Date("2024-01-19"),
    },
    {
      evaluationId: 5,
      input:
        "Translate to French: Hello, how are you today? I hope you are having a wonderful day.",
      expectedOutput:
        "Bonjour, comment allez-vous aujourd'hui ? J'espère que vous passez une merveilleuse journée.",
      metadata: JSON.stringify({ source_language: "English", target_language: "French" }),
      createdAt: new Date("2024-01-20"),
    },
    {
      evaluationId: 5,
      input:
        "Translate to French: The restaurant opens at 7 PM and serves authentic Italian cuisine.",
      expectedOutput: "Le restaurant ouvre à 19 heures et sert une cuisine italienne authentique.",
      metadata: JSON.stringify({ source_language: "English", target_language: "French" }),
      createdAt: new Date("2024-01-20"),
    },
  ];

  await db.insert(evaluationTestCases).values(sampleTestCases);

  console.log("✅ Evaluation test cases seeder completed successfully");
}

main().catch((error) => {
  console.error("❌ Seeder failed:", error);
});
