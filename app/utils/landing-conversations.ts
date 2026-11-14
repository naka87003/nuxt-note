export const landingFetchExample = `\`\`\`ts
const { data } = await useFetch('/api/notes')
\`\`\``;

export const landingConversations = {
  savedNotes: {
    title: "Exploring my Nuxt notes",
    summary: "A summary based on my saved Nuxt notes.",
    question: "Find my Nuxt notes and summarize the main points.",
    answer: `Your note “Nuxt data fetching” compares two approaches.

Use useFetch for URL-based requests. Use useAsyncData for custom async logic.

${landingFetchExample}`,
  },
  useFetch: {
    title: "Understanding useFetch",
    summary: "When to use useFetch and useAsyncData.",
    question: "When should I use useFetch instead of useAsyncData?",
    answer: `Use useFetch when your data comes from a URL.

It combines fetching with Nuxt’s async data handling. For custom async logic, use useAsyncData.

${landingFetchExample}`,
  },
};
